from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q
from .models import ParentTeacherMessage, Teacher, Student, Parent
from .serializers import ParentTeacherMessageSerializer, TeacherSerializer
from django.utils import timezone


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_messages(request):
    """Get all messages for the logged-in user (parent or teacher)"""
    user = request.user
    
    if user.role not in ['parent', 'teacher']:
        return Response({'error': 'Only parents and teachers can access messages'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    messages = ParentTeacherMessage.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).select_related('sender', 'recipient', 'student__user').order_by('-date_sent')
    
    serializer = ParentTeacherMessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_conversation(request, user_id):
    """Get conversation between logged-in user and another user"""
    user = request.user
    
    if user.role not in ['parent', 'teacher']:
        return Response({'error': 'Only parents and teachers can access conversations'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    messages = ParentTeacherMessage.objects.filter(
        (Q(sender=user) & Q(recipient_id=user_id)) | 
        (Q(sender_id=user_id) & Q(recipient=user))
    ).select_related('sender', 'recipient', 'student__user').order_by('date_sent')
    
    for msg in messages:
        if msg.recipient == user and not msg.is_read:
            msg.is_read = True
            msg.save()
    
    serializer = ParentTeacherMessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_message(request):
    """Send a message from parent to teacher or teacher to parent"""
    user = request.user
    
    if user.role not in ['parent', 'teacher']:
        return Response({'error': 'Only parents and teachers can send messages'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    recipient_id = request.data.get('recipient_id')
    message_text = request.data.get('message')
    subject = request.data.get('subject', '')
    student_id = request.data.get('student_id')
    parent_message_id = request.data.get('parent_message_id')
    
    if not recipient_id or not message_text:
        return Response({'error': 'Recipient and message are required'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from users.models import CustomUser
        recipient = CustomUser.objects.get(id=recipient_id)
        
        if recipient.role not in ['parent', 'teacher']:
            return Response({'error': 'Can only send messages to parents or teachers'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if user.role == recipient.role:
            return Response({'error': 'Cannot send message to same role'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        message = ParentTeacherMessage.objects.create(
            sender=user,
            recipient=recipient,
            subject=subject,
            message=message_text,
            student_id=student_id,
            parent_message_id=parent_message_id
        )
        
        serializer = ParentTeacherMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except CustomUser.DoesNotExist:
        return Response({'error': 'Recipient not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_teachers(request):
    """Search for teachers by name or subject (for parents)"""
    user = request.user
    
    if user.role != 'parent':
        return Response({'error': 'Only parents can search for teachers'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    query = request.GET.get('q', '')
    
    if not query:
        teachers = Teacher.objects.all().select_related('user').prefetch_related('subjects_taught')
    else:
        teachers = Teacher.objects.filter(
            Q(user__first_name__icontains=query) | 
            Q(user__last_name__icontains=query) |
            Q(subjects_taught__name__icontains=query)
        ).distinct().select_related('user').prefetch_related('subjects_taught')
    
    serializer = TeacherSerializer(teachers, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_student_parents(request, student_id):
    """Get parents of a specific student (for teachers)"""
    user = request.user
    
    if user.role != 'teacher':
        return Response({'error': 'Only teachers can access student parent information'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = Student.objects.get(id=student_id)
        parents = student.parents.all().select_related('user')
        
        parent_data = [{
            'id': parent.id,
            'user_id': parent.user.id,
            'name': f"{parent.user.first_name} {parent.user.last_name}",
            'email': parent.user.email,
            'phone': parent.user.phone_number or '',
            'occupation': parent.occupation or ''
        } for parent in parents]
        
        return Response(parent_data)
        
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_as_read(request, message_id):
    """Mark a message as read"""
    user = request.user
    
    try:
        message = ParentTeacherMessage.objects.get(id=message_id, recipient=user)
        message.is_read = True
        message.save()
        
        return Response({'message': 'Message marked as read'})
        
    except ParentTeacherMessage.DoesNotExist:
        return Response({'error': 'Message not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_unread_count(request):
    """Get count of unread messages"""
    user = request.user
    
    if user.role not in ['parent', 'teacher']:
        return Response({'error': 'Only parents and teachers can access messages'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    count = ParentTeacherMessage.objects.filter(recipient=user, is_read=False).count()
    
    return Response({'unread_count': count})
