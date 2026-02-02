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
        from .models import Timetable
        recipient = CustomUser.objects.get(id=recipient_id)
        
        if recipient.role not in ['parent', 'teacher']:
            return Response({'error': 'Can only send messages to parents or teachers'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if user.role == recipient.role:
            return Response({'error': 'Cannot send message to same role'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if user.role == 'teacher':
            teacher = Teacher.objects.get(user=user)
            # Find all students taught by this teacher through the Timetable
            class_ids = Timetable.objects.filter(teacher=teacher).values_list('class_assigned_id', flat=True)
            student_ids = Student.objects.filter(student_class_id__in=class_ids).values_list('id', flat=True)
            
            parent = Parent.objects.get(user=recipient)
            # Check if any of the parent's children are in the teacher's students
            if not parent.children.filter(id__in=student_ids).exists():
                return Response({'error': 'You can only message parents of students you teach'}, 
                               status=status.HTTP_403_FORBIDDEN)
        else:
            parent = Parent.objects.get(user=user)
            # Get classes of all children linked to this parent
            child_class_ids = parent.children.values_list('student_class_id', flat=True)
            # Get all teachers who have entries in Timetable for these classes
            teacher_ids = Timetable.objects.filter(class_assigned_id__in=child_class_ids).values_list('teacher_id', flat=True)
            
            teacher = Teacher.objects.get(user=recipient)
            if teacher.id not in teacher_ids:
                return Response({'error': 'You can only message teachers who teach your children'}, 
                               status=status.HTTP_403_FORBIDDEN)
        
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
    except (Teacher.DoesNotExist, Parent.DoesNotExist):
        return Response({'error': 'Invalid teacher or parent profile'}, 
                       status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_teachers(request):
    """Search for teachers who teach the parent's children"""
    user = request.user
    
    if user.role != 'parent':
        return Response({'error': 'Only parents can search for teachers'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    query = request.GET.get('q', '')
    
    try:
        parent = Parent.objects.get(user=user)
        # Get all children (Student records) linked to this parent
        children = parent.children.all()
        # Get the IDs of classes these children belong to
        child_class_ids = children.values_list('student_class_id', flat=True)
        
        from .models import Timetable
        # Find all teachers assigned to these classes in the Timetable
        teacher_ids = Timetable.objects.filter(
            class_assigned_id__in=child_class_ids
        ).values_list('teacher_id', flat=True).distinct()
        
        # Filter Teacher objects by the discovered IDs
        teachers = Teacher.objects.filter(id__in=teacher_ids).select_related('user').prefetch_related('subjects_taught')
        
        if query:
            teachers = teachers.filter(
                Q(user__first_name__icontains=query) | 
                Q(user__last_name__icontains=query) |
                Q(subjects_taught__name__icontains=query)
            ).distinct()
        
        serializer = TeacherSerializer(teachers, many=True)
        return Response(serializer.data)
        
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_parents(request):
    """Search for parents of students the teacher teaches"""
    user = request.user
    
    if user.role != 'teacher':
        return Response({'error': 'Only teachers can search for parents'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    query = request.GET.get('q', '')
    
    try:
        teacher = Teacher.objects.get(user=user)
        
        from .models import Timetable
        # Get all class IDs where this teacher has scheduled lessons
        class_ids = Timetable.objects.filter(
            teacher=teacher
        ).values_list('class_assigned_id', flat=True).distinct()
        
        # Get all students enrolled in those classes
        student_ids = Student.objects.filter(
            student_class_id__in=class_ids
        ).values_list('id', flat=True)
        
        # Get parents who have those students as children
        parents = Parent.objects.filter(
            children__id__in=student_ids
        ).distinct().select_related('user')
        
        if query:
            parents = parents.filter(
                Q(user__first_name__icontains=query) | 
                Q(user__last_name__icontains=query) |
                Q(user__email__icontains=query)
            )
        
        parents = parents[:50]
        
        parent_data = [{
            'id': parent.id,
            'user': {
                'id': parent.user.id,
                'first_name': parent.user.first_name,
                'last_name': parent.user.last_name,
                'email': parent.user.email,
            },
            'occupation': parent.occupation or '',
            'phone': parent.user.phone_number or ''
        } for parent in parents]
        
        return Response(parent_data)
        
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


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
