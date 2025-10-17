from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
import json
import requests
from .models import WhatsAppUser, WhatsAppSession, WhatsAppMessage, WhatsAppPayment, WhatsAppMenu
from .serializers import (
    WhatsAppUserSerializer, WhatsAppSessionSerializer, WhatsAppMessageSerializer,
    WhatsAppPaymentSerializer, WhatsAppMenuSerializer, WebhookMessageSerializer,
    SendMessageSerializer
)
from academics.models import Student
from finances.models import StudentFee


class WhatsAppUserListView(generics.ListAPIView):
    queryset = WhatsAppUser.objects.all()
    serializer_class = WhatsAppUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ['admin', 'hr']:
            return WhatsAppUser.objects.none()
        return WhatsAppUser.objects.all().order_by('-last_interaction')


class WhatsAppSessionListView(generics.ListAPIView):
    queryset = WhatsAppSession.objects.all()
    serializer_class = WhatsAppSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ['admin', 'hr']:
            return WhatsAppSession.objects.none()
        
        queryset = WhatsAppSession.objects.all()
        is_active = self.request.query_params.get('is_active')
        phone = self.request.query_params.get('phone')
        
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if phone:
            queryset = queryset.filter(whatsapp_user__phone_number__icontains=phone)
            
        return queryset.order_by('-last_activity')


class WhatsAppMessageListView(generics.ListAPIView):
    queryset = WhatsAppMessage.objects.all()
    serializer_class = WhatsAppMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ['admin', 'hr']:
            return WhatsAppMessage.objects.none()
        
        queryset = WhatsAppMessage.objects.all()
        phone = self.request.query_params.get('phone')
        direction = self.request.query_params.get('direction')
        
        if phone:
            queryset = queryset.filter(whatsapp_user__phone_number__icontains=phone)
        if direction:
            queryset = queryset.filter(direction=direction)
            
        return queryset.order_by('-timestamp')


class WhatsAppPaymentListView(generics.ListAPIView):
    queryset = WhatsAppPayment.objects.all()
    serializer_class = WhatsAppPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ['admin', 'accountant']:
            return WhatsAppPayment.objects.none()
        
        queryset = WhatsAppPayment.objects.all()
        status_filter = self.request.query_params.get('status')
        phone = self.request.query_params.get('phone')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if phone:
            queryset = queryset.filter(whatsapp_user__phone_number__icontains=phone)
            
        return queryset.order_by('-initiated_at')


class WhatsAppMenuListCreateView(generics.ListCreateAPIView):
    queryset = WhatsAppMenu.objects.all()
    serializer_class = WhatsAppMenuSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = WhatsAppMenu.objects.all()
        required_role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        
        if required_role:
            queryset = queryset.filter(required_role=required_role)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
            
        return queryset.order_by('menu_key')


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def whatsapp_webhook(request):
    """WhatsApp Business API webhook endpoint"""
    
    if request.method == 'GET':
        # Webhook verification
        verify_token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')
        
        if verify_token == settings.WHATSAPP_VERIFY_TOKEN:
            return HttpResponse(challenge)
        else:
            return HttpResponse('Error, wrong validation token', status=403)
    
    elif request.method == 'POST':
        # Handle incoming messages
        try:
            data = json.loads(request.body)
            
            # Process webhook data
            if 'entry' in data:
                for entry in data['entry']:
                    if 'changes' in entry:
                        for change in entry['changes']:
                            if change.get('field') == 'messages':
                                value = change.get('value', {})
                                messages = value.get('messages', [])
                                
                                for message in messages:
                                    process_incoming_message(message, value.get('contacts', []))
            
            return Response({'status': 'success'})
            
        except Exception as e:
            return Response({'error': str(e)}, status=400)


def process_incoming_message(message_data, contacts_data):
    """Process incoming WhatsApp message"""
    try:
        from_phone = message_data.get('from')
        message_id = message_data.get('id')
        message_type = message_data.get('type', 'text')
        timestamp = message_data.get('timestamp')
        
        # Extract message content based on type
        content = ''
        if message_type == 'text':
            content = message_data.get('text', {}).get('body', '')
        elif message_type == 'button':
            content = message_data.get('button', {}).get('text', '')
        elif message_type == 'interactive':
            interactive = message_data.get('interactive', {})
            if interactive.get('type') == 'button_reply':
                content = interactive.get('button_reply', {}).get('title', '')
            elif interactive.get('type') == 'list_reply':
                content = interactive.get('list_reply', {}).get('title', '')
        
        # Get or create WhatsApp user
        whatsapp_user, created = WhatsAppUser.objects.get_or_create(
            phone_number=from_phone,
            defaults={'whatsapp_id': from_phone}
        )
        
        # Save message
        WhatsAppMessage.objects.create(
            whatsapp_user=whatsapp_user,
            message_id=message_id,
            direction='incoming',
            message_type=message_type,
            content=content
        )
        
        # Process the message and send response
        response_message = handle_user_message(whatsapp_user, content)
        if response_message:
            send_whatsapp_message(from_phone, response_message)
            
    except Exception as e:
        print(f"Error processing message: {str(e)}")


def handle_user_message(whatsapp_user, message_content):
    """Handle user message and return appropriate response"""
    
    # Get or create session
    session, created = WhatsAppSession.objects.get_or_create(
        whatsapp_user=whatsapp_user,
        is_active=True,
        defaults={'session_id': f"session_{whatsapp_user.id}"}
    )
    
    # If user is not verified, handle verification flow
    if not whatsapp_user.is_verified:
        return handle_verification_flow(whatsapp_user, message_content, session)
    
    # Handle menu navigation
    return handle_menu_navigation(whatsapp_user, message_content, session)


def handle_verification_flow(whatsapp_user, message_content, session):
    """Handle user verification flow"""
    current_step = session.session_data.get('verification_step', 'start')
    
    if current_step == 'start':
        session.session_data['verification_step'] = 'waiting_pin'
        session.save()
        return "Welcome! Please enter your 4-6 digit PIN to verify your account:"
    
    elif current_step == 'waiting_pin':
        # Verify PIN
        try:
            from users.models import CustomUser
            user = CustomUser.objects.get(
                phone_number=whatsapp_user.phone_number,
                whatsapp_pin=message_content,
                role__in=['student', 'parent']
            )
            
            # Link WhatsApp user to system user
            whatsapp_user.user = user
            whatsapp_user.is_verified = True
            whatsapp_user.pin_verified = True
            whatsapp_user.save()
            
            # Reset session
            session.session_data = {}
            session.current_menu = 'main'
            session.save()
            
            return f"✅ Verification successful! Welcome {user.full_name}. \n\n" + get_main_menu(user.role)
            
        except CustomUser.DoesNotExist:
            return "❌ Invalid PIN. Please try again:"
    
    return "Please follow the verification steps."


def handle_menu_navigation(whatsapp_user, message_content, session):
    """Handle menu navigation for verified users"""
    user_role = whatsapp_user.user.role
    current_menu = session.current_menu
    
    # Main menu
    if current_menu == 'main' or message_content.lower() in ['menu', 'main', '0']:
        session.current_menu = 'main'
        session.save()
        return get_main_menu(user_role)
    
    # Performance/Results menu
    elif message_content == '1':
        if user_role in ['student', 'parent']:
            return handle_performance_request(whatsapp_user)
        
    # Timetable menu
    elif message_content == '2':
        if user_role in ['student', 'parent']:
            return handle_timetable_request(whatsapp_user)
    
    # Fees menu
    elif message_content == '3':
        if user_role in ['student', 'parent']:
            return handle_fees_request(whatsapp_user)
    
    # Complaints menu
    elif message_content == '4':
        session.current_menu = 'complaint'
        session.save()
        return "Please describe your complaint:"
    
    # Handle complaint submission
    elif current_menu == 'complaint':
        return handle_complaint_submission(whatsapp_user, message_content, session)
    
    return "Invalid option. Type 'menu' to see available options."


def get_main_menu(user_role):
    """Get main menu based on user role"""
    if user_role == 'student':
        return """
📚 *STUDENT PORTAL*

Please select an option:
1️⃣ View Performance
2️⃣ View Timetable  
3️⃣ Check Fees
4️⃣ Submit Complaint

Type the number of your choice.
        """
    elif user_role == 'parent':
        return """
👨‍👩‍👧‍👦 *PARENT PORTAL*

Please select an option:
1️⃣ Child's Performance
2️⃣ Child's Timetable
3️⃣ Pay Fees
4️⃣ Submit Complaint

Type the number of your choice.
        """
    else:
        return "Welcome! Your account type doesn't have WhatsApp access."


def handle_performance_request(whatsapp_user):
    """Handle performance/results request"""
    try:
        if whatsapp_user.user.role == 'student':
            student = whatsapp_user.user.student
            results = student.results.all()[:5]  # Get recent 5 results
            
            if results:
                response = f"📊 *Recent Results for {student.user.full_name}*\n\n"
                for result in results:
                    percentage = (result.score / result.max_score) * 100 if result.max_score > 0 else 0
                    response += f"📚 {result.subject.name}\n"
                    response += f"Score: {result.score}/{result.max_score} ({percentage:.1f}%)\n"
                    response += f"Term: {result.academic_term}\n\n"
                return response
            else:
                return "No results found."
                
        elif whatsapp_user.user.role == 'parent':
            children = whatsapp_user.user.parent.children.all()
            if children.count() == 1:
                child = children.first()
                results = child.results.all()[:3]
                
                response = f"📊 *Recent Results for {child.user.full_name}*\n\n"
                for result in results:
                    percentage = (result.score / result.max_score) * 100 if result.max_score > 0 else 0
                    response += f"📚 {result.subject.name}: {percentage:.1f}%\n"
                return response
            else:
                return "Multiple children found. Please contact school for detailed reports."
                
    except Exception as e:
        return "Error retrieving performance data."


def handle_timetable_request(whatsapp_user):
    """Handle timetable request"""
    try:
        if whatsapp_user.user.role == 'student':
            student = whatsapp_user.user.student
            timetable = student.student_class.timetable.all()
            
            if timetable:
                response = f"📅 *Timetable for {student.student_class.name}*\n\n"
                current_day = None
                for schedule in timetable.order_by('day_of_week', 'start_time'):
                    if schedule.day_of_week != current_day:
                        response += f"\n*{schedule.day_of_week.upper()}*\n"
                        current_day = schedule.day_of_week
                    response += f"{schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')} {schedule.subject.name}\n"
                return response
            else:
                return "No timetable found."
                
    except Exception as e:
        return "Error retrieving timetable."


def handle_fees_request(whatsapp_user):
    """Handle fees request"""
    try:
        if whatsapp_user.user.role == 'student':
            student = whatsapp_user.user.student
        elif whatsapp_user.user.role == 'parent':
            children = whatsapp_user.user.parent.children.all()
            if children.count() == 1:
                student = children.first()
            else:
                return "Multiple children found. Please contact school for fees information."
        
        unpaid_fees = student.fees.filter(is_paid=False)
        
        if unpaid_fees:
            response = f"💰 *Outstanding Fees for {student.user.full_name}*\n\n"
            total_balance = 0
            for fee in unpaid_fees:
                balance = fee.amount_due - fee.amount_paid
                total_balance += balance
                response += f"📋 {fee.fee_type.name}\n"
                response += f"Amount Due: ${fee.amount_due}\n"
                response += f"Balance: ${balance}\n"
                response += f"Due Date: {fee.due_date}\n\n"
            
            response += f"*Total Outstanding: ${total_balance}*\n\n"
            response += "To make a payment, please contact the school office."
            return response
        else:
            return "✅ No outstanding fees found."
            
    except Exception as e:
        return "Error retrieving fees information."


def handle_complaint_submission(whatsapp_user, message_content, session):
    """Handle complaint submission"""
    try:
        from academics.models import Complaint
        
        if whatsapp_user.user.role == 'student':
            student = whatsapp_user.user.student
        elif whatsapp_user.user.role == 'parent':
            children = whatsapp_user.user.parent.children.all()
            if children.count() == 1:
                student = children.first()
            else:
                return "Multiple children found. Please specify which child this complaint is about."
        
        # Create complaint
        complaint = Complaint.objects.create(
            student=student,
            submitted_by=whatsapp_user.user,
            title="WhatsApp Complaint",
            description=message_content,
            status='pending'
        )
        
        # Reset session
        session.current_menu = 'main'
        session.save()
        
        return f"✅ Your complaint has been submitted successfully.\nReference ID: {complaint.id}\n\nType 'menu' to return to main menu."
        
    except Exception as e:
        return "Error submitting complaint. Please try again."


def send_whatsapp_message(to_phone, message_text):
    """Send WhatsApp message using Meta Business API"""
    try:
        url = f"{settings.WHATSAPP_API_URL}/messages"
        headers = {
            'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'messaging_product': 'whatsapp',
            'to': to_phone,
            'type': 'text',
            'text': {'body': message_text}
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            # Save outgoing message
            try:
                whatsapp_user = WhatsAppUser.objects.get(phone_number=to_phone)
                WhatsAppMessage.objects.create(
                    whatsapp_user=whatsapp_user,
                    message_id=f"out_{whatsapp_user.id}_{response.json().get('messages', [{}])[0].get('id', '')}",
                    direction='outgoing',
                    message_type='text',
                    content=message_text
                )
            except:
                pass
                
        return response.status_code == 200
        
    except Exception as e:
        print(f"Error sending WhatsApp message: {str(e)}")
        return False


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_message_view(request):
    """API endpoint to send WhatsApp message"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = SendMessageSerializer(data=request.data)
    if serializer.is_valid():
        success = send_whatsapp_message(
            serializer.validated_data['to_phone'],
            serializer.validated_data['content']
        )
        
        if success:
            return Response({'message': 'Message sent successfully'})
        else:
            return Response({'error': 'Failed to send message'}, status=400)
    
    return Response(serializer.errors, status=400)