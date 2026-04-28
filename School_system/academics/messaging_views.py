import logging
import re

from django.db.models import Q, Max, Count
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import ParentTeacherMessage, Teacher, Student, Parent

logger = logging.getLogger(__name__)
from .serializers import ParentTeacherMessageSerializer, TeacherSerializer
from django.utils import timezone

from email_service import send_teacher_message_email


# Detect phone numbers (Zimbabwe formats with optional spaces) and email addresses.
# Phone: +263 / 263 / 0 prefixes followed by 9 digits with optional whitespace between any digit.
# Email: standard local@domain.tld with optional whitespace inserted by the user.
_CONTACT_PATTERNS = [
    # +263 or 263 followed by 9 more digits (with optional spaces between any digits)
    re.compile(r'\+?\s*2\s*6\s*3(?:\s*\d){9}'),
    # Local Zimbabwe mobile: 0 then 9 more digits (07x, 08x, etc.) with optional spaces
    re.compile(r'(?<!\d)0(?:\s*\d){9}'),
    # Email addresses, tolerant of whitespace around @ and dots
    re.compile(r'[\w.+\-]+\s*@\s*[\w\-]+(?:\s*\.\s*[\w\-]+)+', re.IGNORECASE),
]


def _scan_for_contact_info(text):
    """Return the first matched contact string, or None if clean."""
    if not text:
        return None
    for pattern in _CONTACT_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0)
    return None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_messages(request):
    """Get all messages for the logged-in user (parent or teacher)"""
    user = request.user

    if user.role not in ['parent', 'teacher']:
        return Response({'error': 'Only parents and teachers can access messages'},
                       status=status.HTTP_403_FORBIDDEN)

    messages = ParentTeacherMessage.objects.filter(
        (Q(sender=user) | Q(recipient=user)) &
        Q(sender__school=user.school) & Q(recipient__school=user.school)
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
        ((Q(sender=user) & Q(recipient_id=user_id)) |
         (Q(sender_id=user_id) & Q(recipient=user))) &
        Q(sender__school=user.school) & Q(recipient__school=user.school)
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

    # Block messages containing phone numbers or email addresses. Parents and
    # teachers must keep correspondence on-platform so the school can supervise.
    flagged = _scan_for_contact_info(message_text) or _scan_for_contact_info(subject)
    if flagged:
        return Response(
            {'error': 'Messages cannot contain phone numbers or email addresses. '
                      'Please keep all communication on the platform.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from users.models import CustomUser
        from .models import Timetable, Class, ParentChildLink
        recipient = CustomUser.objects.get(id=recipient_id)

        if recipient.role not in ['parent', 'teacher']:
            return Response({'error': 'Can only send messages to parents or teachers'},
                           status=status.HTTP_400_BAD_REQUEST)

        if user.role == recipient.role:
            return Response({'error': 'Cannot send message to same role'},
                           status=status.HTTP_400_BAD_REQUEST)

        if recipient.school_id != user.school_id:
            return Response({'error': 'Cannot message users outside your school'},
                           status=status.HTTP_403_FORBIDDEN)

        if user.role == 'teacher':
            teacher = Teacher.objects.get(user=user)
            # Classes taught via Timetable OR where teacher is the class teacher
            timetable_class_ids = set(Timetable.objects.filter(
                teacher=teacher
            ).values_list('class_assigned_id', flat=True))
            class_teacher_class_ids = set(Class.objects.filter(
                class_teacher=user
            ).values_list('id', flat=True))
            all_class_ids = timetable_class_ids | class_teacher_class_ids
            student_ids = set(Student.objects.filter(
                student_class_id__in=all_class_ids
            ).values_list('id', flat=True))

            parent = Parent.objects.get(user=recipient)
            confirmed_child_ids = set(ParentChildLink.objects.filter(
                parent=parent, is_confirmed=True
            ).values_list('student_id', flat=True))
            shared_student_ids = confirmed_child_ids & student_ids
            if not shared_student_ids:
                return Response({'error': 'You can only message parents of students you teach'},
                               status=status.HTTP_403_FORBIDDEN)
            # Auto-derive student_id for email context if not provided
            if not student_id:
                student_id = next(iter(shared_student_ids))
        else:
            parent = Parent.objects.get(user=user)
            confirmed_child_ids = ParentChildLink.objects.filter(
                parent=parent, is_confirmed=True
            ).values_list('student_id', flat=True)
            child_class_ids = list(Student.objects.filter(
                id__in=confirmed_child_ids
            ).values_list('student_class_id', flat=True))
            # Teachers via Timetable OR as class teacher of the child's class
            timetable_teacher_ids = set(Timetable.objects.filter(
                class_assigned_id__in=child_class_ids
            ).values_list('teacher_id', flat=True))
            class_teacher_user_ids = set(Class.objects.filter(
                id__in=child_class_ids
            ).exclude(class_teacher__isnull=True).values_list('class_teacher_id', flat=True))

            teacher = Teacher.objects.get(user=recipient)
            if teacher.id not in timetable_teacher_ids and teacher.user_id not in class_teacher_user_ids:
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

        # Email the parent when a teacher sends them a message
        if user.role == 'teacher' and recipient.role == 'parent':
            try:
                teacher_name = f"{user.first_name} {user.last_name}".strip() or user.email
                parent_name = f"{recipient.first_name} {recipient.last_name}".strip() or recipient.email
                school = user.school
                school_name = school.name if school else "Your School"
                # Determine student name and class from the linked student
                student_name, class_name = "Your Child", "N/A"
                if student_id:
                    try:
                        s = Student.objects.select_related('user', 'student_class').get(id=student_id)
                        student_name = f"{s.user.first_name} {s.user.last_name}".strip()
                        class_name = s.student_class.name if s.student_class else "N/A"
                    except Student.DoesNotExist:
                        pass
                if recipient.email:
                    send_teacher_message_email(
                        parent_email=recipient.email,
                        parent_name=parent_name,
                        school_name=school_name,
                        student_name=student_name,
                        class_name=class_name,
                        teacher_name=teacher_name,
                        subject_line=subject,
                        message_body=message_text,
                    )
            except Exception as exc:
                logger.error("Teacher message email notification failed: %s", exc)

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
        # Get CONFIRMED children via ParentChildLink
        from .models import ParentChildLink
        confirmed_child_ids = ParentChildLink.objects.filter(
            parent=parent, is_confirmed=True
        ).values_list('student_id', flat=True)
        child_class_ids = Student.objects.filter(
            id__in=confirmed_child_ids
        ).values_list('student_class_id', flat=True)
        
        from .models import Timetable
        # Find all teachers assigned to these classes in the Timetable
        teacher_ids = Timetable.objects.filter(
            class_assigned_id__in=child_class_ids
        ).values_list('teacher_id', flat=True).distinct()
        
        # ALSO include class teachers
        from .models import Class
        class_teacher_user_ids = Class.objects.filter(
            id__in=child_class_ids
        ).exclude(class_teacher__isnull=True).values_list('class_teacher_id', flat=True)
        
        # Filter Teacher objects by the discovered IDs (same-school only)
        teachers = Teacher.objects.filter(
            Q(id__in=teacher_ids) | Q(user_id__in=class_teacher_user_ids)
        ).filter(user__school=user.school).select_related('user').prefetch_related('subjects_taught').distinct()
        
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
        
        from .models import Timetable, Class
        # Get all class IDs where this teacher has scheduled lessons
        class_ids = list(Timetable.objects.filter(
            teacher=teacher
        ).values_list('class_assigned_id', flat=True).distinct())
        
        # Also include classes where this teacher is the class teacher
        class_teacher_ids = list(Class.objects.filter(
            class_teacher=user
        ).values_list('id', flat=True))
        
        all_class_ids = set(class_ids + class_teacher_ids)
        
        # Get all students enrolled in those classes
        student_ids = Student.objects.filter(
            student_class_id__in=all_class_ids
        ).values_list('id', flat=True)
        
        # Get parents who have CONFIRMED links to those students
        from .models import ParentChildLink
        parent_ids = ParentChildLink.objects.filter(
            student_id__in=student_ids, is_confirmed=True
        ).values_list('parent_id', flat=True).distinct()
        parents = Parent.objects.filter(
            id__in=parent_ids, user__school=user.school
        ).select_related('user')
        
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
        student = Student.objects.get(id=student_id, user__school=user.school)
        parents = student.parents.filter(user__school=user.school).select_related('user')
        
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
    
    count = ParentTeacherMessage.objects.filter(
        recipient=user, is_read=False,
        sender__school=user.school
    ).count()

    return Response({'unread_count': count})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_list_conversations(request):
    """List every parent-teacher conversation thread within the admin's school."""
    user = request.user
    if user.role != 'admin':
        return Response({'error': 'Only admins can review conversations'},
                       status=status.HTTP_403_FORBIDDEN)

    if not user.school_id:
        return Response([])

    school_id = user.school_id
    qs = ParentTeacherMessage.objects.filter(
        sender__role__in=['parent', 'teacher'],
        recipient__role__in=['parent', 'teacher'],
    ).select_related('sender', 'recipient')

    membership_cache = {}

    def belongs_to_school(member_user):
        cache_key = member_user.id
        if cache_key in membership_cache:
            return membership_cache[cache_key]

        in_school = False
        if member_user.role == 'teacher':
            in_school = member_user.school_id == school_id
        elif member_user.role == 'parent':
            in_school = (
                member_user.school_id == school_id or
                Parent.objects.filter(user=member_user, schools__id=school_id).exists()
            )

        membership_cache[cache_key] = in_school
        return in_school

    threads = {}
    for msg in qs:
        if msg.sender.role == msg.recipient.role:
            continue
        teacher_user = msg.sender if msg.sender.role == 'teacher' else msg.recipient
        parent_user = msg.sender if msg.sender.role == 'parent' else msg.recipient
        if not belongs_to_school(teacher_user) or not belongs_to_school(parent_user):
            continue
        key = (teacher_user.id, parent_user.id)
        thread = threads.get(key)
        if thread is None:
            thread = {
                'teacher_id': teacher_user.id,
                'teacher_name': f"{teacher_user.first_name} {teacher_user.last_name}".strip() or teacher_user.email,
                'parent_id': parent_user.id,
                'parent_name': f"{parent_user.first_name} {parent_user.last_name}".strip() or parent_user.email,
                'message_count': 0,
                'last_message': '',
                'last_message_date': None,
            }
            threads[key] = thread
        thread['message_count'] += 1
        if thread['last_message_date'] is None or msg.date_sent > thread['last_message_date']:
            thread['last_message'] = msg.message[:120]
            thread['last_message_date'] = msg.date_sent

    result = sorted(
        threads.values(),
        key=lambda t: t['last_message_date'] or timezone.now(),
        reverse=True,
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_get_conversation(request, teacher_id, parent_id):
    """Read-only view of the full thread between a specific teacher and parent."""
    user = request.user
    if user.role != 'admin':
        return Response({'error': 'Only admins can review conversations'},
                       status=status.HTTP_403_FORBIDDEN)

    if not user.school_id:
        return Response([])

    school_id = user.school_id
    try:
        teacher_user = Teacher.objects.select_related('user').get(user_id=teacher_id).user
        parent_user = Parent.objects.select_related('user').get(user_id=parent_id).user
    except (Teacher.DoesNotExist, Parent.DoesNotExist):
        return Response([])

    teacher_in_school = teacher_user.school_id == school_id
    parent_in_school = (
        parent_user.school_id == school_id or
        Parent.objects.filter(user=parent_user, schools__id=school_id).exists()
    )
    if not teacher_in_school or not parent_in_school:
        return Response([])

    messages = ParentTeacherMessage.objects.filter(
        (Q(sender_id=teacher_id) & Q(recipient_id=parent_id)) |
        (Q(sender_id=parent_id) & Q(recipient_id=teacher_id))
    ).filter(
        sender__role__in=['parent', 'teacher'],
        recipient__role__in=['parent', 'teacher'],
    ).select_related('sender', 'recipient', 'student__user').order_by('date_sent')

    serializer = ParentTeacherMessageSerializer(messages, many=True)
    return Response(serializer.data)
