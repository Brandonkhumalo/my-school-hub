import logging

from django.db.models import Avg, Count, Q, Prefetch
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from email_service import (
    send_result_entered_email,
    send_announcement_email,
    send_parent_link_approved_email,
    get_parents_of_student,
)
from .models import (
    Subject, Class, Student, Teacher, Parent, Result, 
    Timetable, Announcement, Complaint, Suspension
)
from .serializers import (
    SubjectSerializer, ClassSerializer, StudentSerializer, TeacherSerializer,
    ParentSerializer, ResultSerializer, TimetableSerializer, AnnouncementSerializer,
    ComplaintSerializer, SuspensionSerializer, StudentPerformanceSerializer,
    CreateResultSerializer, CreateStudentSerializer, CreateTeacherSerializer, CreateParentSerializer,
    UpdateStudentSerializer, UpdateTeacherSerializer, UpdateParentSerializer
)


# Subject Views
class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Subject.objects.filter(school=user.school).prefetch_related('teachers__user')
        return Subject.objects.none()

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Subject.objects.filter(school=user.school).prefetch_related('teachers__user')
        return Subject.objects.none()


# Class Views
class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Class.objects.filter(school=user.school).select_related('class_teacher').annotate(
                _student_count=Count('students', distinct=True)
            )
        else:
            queryset = Class.objects.none()
        level_type = self.request.query_params.get('level', None)
        if level_type == 'primary':
            queryset = queryset.filter(grade_level__lte=7)
        elif level_type == 'secondary':
            queryset = queryset.filter(grade_level__gt=7)
        return queryset

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Class.objects.filter(school=user.school).select_related('class_teacher').annotate(
                _student_count=Count('students', distinct=True)
            )
        return Class.objects.none()


# Student Views
class StudentListView(generics.ListCreateAPIView):
    queryset = Student.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateStudentSerializer
        return StudentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Student.objects.filter(user__school=user.school).select_related(
                'user', 'student_class'
            ).prefetch_related('parents__user')
        else:
            queryset = Student.objects.none()

        search_q = self.request.query_params.get('q', '').strip()
        if search_q:
            queryset = queryset.filter(
                Q(user__student_number__icontains=search_q) |
                Q(user__first_name__icontains=search_q) |
                Q(user__last_name__icontains=search_q)
            )

        class_id = self.request.query_params.get('class', None)
        if class_id:
            queryset = queryset.filter(student_class_id=class_id)
        return queryset


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UpdateStudentSerializer
        return StudentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Student.objects.filter(user__school=user.school).select_related(
                'user', 'student_class'
            ).prefetch_related('parents__user')
        return Student.objects.none()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admins can edit students.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can delete students.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_performance_view(request, student_id):
    try:
        student = Student.objects.get(id=student_id)
        
        # Verify student belongs to same school as requesting user (tenant isolation)
        if request.user.school and student.user.school != request.user.school:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check permissions - students can only view their own, parents can view their children's
        if request.user.role == 'student' and request.user.student.id != student_id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'parent':
            if not request.user.parent.children.filter(id=student_id).exists():
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        academic_year = request.query_params.get('academic_year')
        academic_term = request.query_params.get('academic_term')
        
        results = Result.objects.filter(student=student)
        if academic_year:
            results = results.filter(academic_year=academic_year)
        if academic_term:
            results = results.filter(academic_term=academic_term)
        
        if not results.exists():
            return Response({'message': 'No results found for this student'})
        
        # Calculate averages
        avg_data = results.aggregate(
            avg_score=Avg('score'),
            avg_max_score=Avg('max_score')
        )
        
        average_percentage = 0
        if avg_data['avg_max_score'] and avg_data['avg_max_score'] > 0:
            average_percentage = (avg_data['avg_score'] / avg_data['avg_max_score']) * 100
        
        # Determine overall grade — Zimbabwe grading system
        from .grading import percentage_to_grade
        grade_info = percentage_to_grade(average_percentage)

        performance_data = {
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'class_name': student.student_class.name,
            'academic_year': academic_year or 'All Years',
            'academic_term': academic_term or 'All Terms',
            'total_subjects': results.values('subject').distinct().count(),
            'average_score': round(average_percentage, 2),
            'overall_grade': grade_info['grade'],
            'grade_description': grade_info['description'],
            'passed': grade_info['passed'],
            'at_risk': grade_info['at_risk'],
            'results': ResultSerializer(results, many=True).data
        }
        
        return Response(performance_data)
        
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)


# Teacher Views
class TeacherListView(generics.ListCreateAPIView):
    queryset = Teacher.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateTeacherSerializer
        return TeacherSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Teacher.objects.filter(user__school=user.school).select_related('user').prefetch_related('subjects_taught', 'teaching_classes')
        return Teacher.objects.none()


class TeacherDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Teacher.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UpdateTeacherSerializer
        return TeacherSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Teacher.objects.filter(user__school=user.school).select_related('user').prefetch_related('subjects_taught', 'teaching_classes')
        return Teacher.objects.none()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admins can edit teachers.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can delete teachers.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# Parent Views
class ParentListView(generics.ListCreateAPIView):
    queryset = Parent.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateParentSerializer
        return ParentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Parent.objects.filter(
                user__school=user.school
            ).select_related('user').prefetch_related('children__user', 'children__student_class')
        return Parent.objects.none()


class ParentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Parent.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UpdateParentSerializer
        return ParentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Parent.objects.filter(
                user__school=user.school
            ).select_related('user').prefetch_related('children__user', 'children__student_class')
        return Parent.objects.none()

    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admins can edit parents.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can delete parents.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# Result Views
class ResultListCreateView(generics.ListCreateAPIView):
    queryset = Result.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateResultSerializer
        return ResultSerializer

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Result.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'subject', 'teacher__user'
            )
        else:
            queryset = Result.objects.none()

        # Filter by teacher if teacher is making request
        if self.request.user.role == 'teacher':
            queryset = queryset.filter(teacher__user=self.request.user)

        # Filter by student if student/parent is making request
        if self.request.user.role == 'student':
            queryset = queryset.filter(student__user=self.request.user)
        elif self.request.user.role == 'parent':
            children_ids = self.request.user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)

        # Additional filters
        student_id = self.request.query_params.get('student')
        subject_id = self.request.query_params.get('subject')
        academic_year = self.request.query_params.get('academic_year')
        academic_term = self.request.query_params.get('academic_term')

        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        if academic_term:
            queryset = queryset.filter(academic_term=academic_term)

        return queryset.order_by('-date_recorded')

    def perform_create(self, serializer):
        result = serializer.save()
        # Notify parents that a result has been posted for their child
        try:
            student = result.student
            school_name = student.user.school.name if student.user.school else "Your School"
            class_name = student.student_class.name if student.student_class else "N/A"
            student_name = f"{student.user.first_name} {student.user.last_name}".strip()
            teacher_name = ""
            if result.teacher and result.teacher.user:
                t = result.teacher.user
                teacher_name = f"{t.first_name} {t.last_name}".strip() or t.email
            for p in get_parents_of_student(student):
                send_result_entered_email(
                    parent_email=p['email'],
                    parent_name=p['name'],
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    subject_name=result.subject.name if result.subject else "N/A",
                    exam_type=result.exam_type or "test",
                    score=str(result.score),
                    max_score=str(result.max_score),
                    academic_term=result.academic_term or "",
                    academic_year=result.academic_year or "",
                    teacher_name=teacher_name,
                )
        except Exception as exc:
            logger.error("Result email notification failed: %s", exc)


class ResultDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Result.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'subject', 'teacher__user'
            )
        else:
            queryset = Result.objects.none()
        if user.role == 'teacher':
            queryset = queryset.filter(teacher__user=user)
        return queryset


# Timetable Views
class TimetableListView(generics.ListAPIView):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Timetable.objects.filter(class_assigned__school=user.school).select_related(
                'class_assigned', 'subject', 'teacher__user'
            )
        else:
            queryset = Timetable.objects.none()

        if user.role == 'student':
            queryset = queryset.filter(class_assigned=user.student.student_class)
        elif user.role == 'teacher':
            queryset = queryset.filter(teacher__user=user)
        elif user.role == 'parent':
            children_classes = user.parent.children.values_list('student_class', flat=True)
            queryset = queryset.filter(class_assigned_id__in=children_classes)

        class_id = self.request.query_params.get('class')
        day = self.request.query_params.get('day')

        if class_id:
            queryset = queryset.filter(class_assigned_id=class_id)
        if day:
            queryset = queryset.filter(day_of_week=day)

        return queryset.order_by('day_of_week', 'start_time')


# Announcement Views
class AnnouncementListCreateView(generics.ListCreateAPIView):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Announcement.objects.filter(
                is_active=True, author__school=user.school
            ).select_related('author', 'target_class')
        else:
            queryset = Announcement.objects.none()
        user_role = user.role

        if user_role not in ('admin', 'hr', 'superadmin'):
            queryset = queryset.filter(
                Q(target_audience='all') | Q(target_audience=user_role)
            )

        # Filter by target_class: show announcements with no class (general)
        # or where the user belongs to that class
        user_class_id = None
        if user_role == 'student':
            try:
                user_class_id = user.student.student_class_id
            except Exception:
                pass
        elif user_role == 'parent':
            from .models import ParentChildLink
            child_class_ids = list(
                ParentChildLink.objects.filter(parent=user.parent, is_confirmed=True)
                .values_list('student__student_class_id', flat=True)
            )
            if child_class_ids:
                queryset = queryset.filter(
                    Q(target_class__isnull=True) | Q(target_class_id__in=child_class_ids)
                )
                return queryset.order_by('-date_posted')
        elif user_role == 'teacher':
            from .models import Timetable
            try:
                teacher = user.teacher
                teacher_class_ids = list(
                    set(Class.objects.filter(class_teacher=user).values_list('id', flat=True)) |
                    set(Timetable.objects.filter(teacher=teacher).values_list('class_assigned_id', flat=True).distinct())
                )
                if teacher_class_ids:
                    queryset = queryset.filter(
                        Q(target_class__isnull=True) | Q(target_class_id__in=teacher_class_ids)
                    )
                    return queryset.order_by('-date_posted')
            except Exception:
                pass

        if user_class_id:
            queryset = queryset.filter(
                Q(target_class__isnull=True) | Q(target_class_id=user_class_id)
            )
        else:
            # Admin or no class — see all
            queryset = queryset.filter(
                Q(target_class__isnull=True) | Q(target_class__isnull=False)
            )

        return queryset.order_by('-date_posted')

    def perform_create(self, serializer):
        if self.request.user.role not in ('admin', 'hr'):
            raise PermissionDenied('Only admin and HR can create announcements.')
        announcement = serializer.save(author=self.request.user)
        # Notify parents if target_audience is 'all' or 'parent'
        if announcement.target_audience not in ('all', 'parent'):
            return
        try:
            school = self.request.user.school
            if not school:
                return
            school_name = school.name
            author_user = self.request.user
            posted_by = f"{author_user.first_name} {author_user.last_name}".strip() or author_user.email
            # Get all parents in the school whose children are confirmed-linked
            from .models import ParentChildLink
            links = ParentChildLink.objects.filter(
                is_confirmed=True,
                student__user__school=school,
            ).select_related('parent__user', 'student__user', 'student__student_class').distinct()
            # Send one email per unique parent (they may have multiple children)
            notified = set()
            for link in links:
                parent_email = link.parent.user.email
                if not parent_email or parent_email in notified:
                    continue
                notified.add(parent_email)
                parent_name = f"{link.parent.user.first_name} {link.parent.user.last_name}".strip()
                student_name = f"{link.student.user.first_name} {link.student.user.last_name}".strip()
                class_name = link.student.student_class.name if link.student.student_class else "N/A"
                send_announcement_email(
                    parent_email=parent_email,
                    parent_name=parent_name,
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                    announcement_title=announcement.title,
                    announcement_body=announcement.content,
                    posted_by=posted_by,
                )
        except Exception as exc:
            logger.error("Announcement email notification failed: %s", exc)


# Complaint Views
class ComplaintListCreateView(generics.ListCreateAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Complaint.objects.filter(
                Q(school=user.school) | Q(student__user__school=user.school)
            ).distinct().select_related(
                'student__user', 'submitted_by'
            )
        else:
            queryset = Complaint.objects.none()

        if user.role in ('admin', 'hr', 'superadmin'):
            pass
        elif user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            queryset = queryset.filter(submitted_by=user)
        elif user.role == 'teacher':
            queryset = queryset.filter(submitted_by=user)
        else:
            queryset = Complaint.objects.none()

        return queryset.order_by('-date_submitted')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ('admin', 'hr', 'teacher', 'parent', 'superadmin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin, HR, teachers, and parents can create complaints.')

        student = serializer.validated_data.get('student')
        if student:
            if user.school and student.user.school_id != user.school_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Selected student is outside your school.')
            if user.role == 'parent' and not user.parent.children.filter(id=student.id).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Parents can only file complaints for their linked children.')

        complaint_type = serializer.validated_data.get('complaint_type')
        if not complaint_type:
            complaint_type = {
                'parent': 'parent',
                'teacher': 'teacher',
            }.get(user.role, 'general')

        serializer.save(
            submitted_by=user,
            school=user.school,
            complaint_type=complaint_type,
        )


class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.school:
            return Complaint.objects.none()

        queryset = Complaint.objects.filter(
            Q(school=user.school) | Q(student__user__school=user.school)
        ).distinct()

        if user.role in ('admin', 'hr', 'superadmin'):
            return queryset
        if user.role in ('teacher', 'parent'):
            return queryset.filter(submitted_by=user)
        if user.role == 'student':
            return queryset.filter(student__user=user)
        return Complaint.objects.none()

    def update(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'hr', 'superadmin'):
            return Response({'error': 'Only admin/HR can update complaints.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('admin', 'hr', 'superadmin'):
            return Response({'error': 'Only admin/HR can delete complaints.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# Suspension Views
class SuspensionListCreateView(generics.ListCreateAPIView):
    queryset = Suspension.objects.all()
    serializer_class = SuspensionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Suspension.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'teacher__user'
            )
        else:
            queryset = Suspension.objects.none()

        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        elif user.role == 'teacher':
            queryset = queryset.filter(teacher__user=user)

        return queryset.order_by('-date_created')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ('admin', 'hr'):
            raise PermissionDenied('Only admin and HR can issue suspensions.')

        student = serializer.validated_data.get('student')
        if not student:
            raise ValidationError({'student': 'student is required'})
        if user.school and student.user.school_id != user.school_id:
            raise PermissionDenied('Selected student is outside your school.')

        selected_teacher = serializer.validated_data.get('teacher')
        if selected_teacher:
            if user.school and selected_teacher.user.school_id != user.school_id:
                raise PermissionDenied('Selected teacher is outside your school.')
            serializer.save(teacher=selected_teacher)
            return

        # If no teacher provided, try class teacher as sensible default.
        class_teacher_user = getattr(student.student_class, 'class_teacher', None)
        if class_teacher_user:
            class_teacher_profile = Teacher.objects.filter(
                user=class_teacher_user,
                user__school=user.school
            ).first()
            if class_teacher_profile:
                serializer.save(teacher=class_teacher_profile)
                return

        raise ValidationError({
            'teacher': (
                'A teacher must be selected to record this suspension, or the student class must have a class teacher profile.'
            )
        })


# Admin Parent-Child Link Management Views
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pending_parent_link_requests(request):
    """Get all pending parent-child link requests (Admin/Teacher only) - filtered by school"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can view pending requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    school = request.user.school
    if not school:
        return Response([])
    
    pending_links = ParentChildLink.objects.filter(
        is_confirmed=False,
        student__user__school=school
    ).select_related('parent__user', 'student__user', 'student__student_class')
    
    data = []
    for link in pending_links:
        data.append({
            'id': link.id,
            'parent_id': link.parent.id,
            'parent_name': f"{link.parent.user.first_name} {link.parent.user.last_name}",
            'parent_email': link.parent.user.email,
            'student_id': link.student.id,
            'student_name': f"{link.student.user.first_name} {link.student.user.last_name}",
            'student_number': link.student.user.student_number or '',
            'class_name': link.student.student_class.name if link.student.student_class else 'Not Assigned',
            'created_at': link.linked_date,
        })
    
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def approve_parent_link_request(request, link_id):
    """Approve a parent-child link request (Admin/Teacher only) - filtered by school"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can approve requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        link = ParentChildLink.objects.select_related(
            'parent__user', 'student__user'
        ).get(id=link_id, is_confirmed=False, student__user__school=school)

        current_parent_count = Parent.objects.filter(children=link.student).count()
        if current_parent_count >= 2:
            return Response(
                {'error': 'Cannot approve link: this student already has 2 parents linked.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        link.is_confirmed = True
        link.confirmed_date = timezone.now()
        link.save()

        # Add the child to parent's children M2M
        link.parent.children.add(link.student)

        # Add the child's school to parent's schools M2M
        # This supports parents with children at multiple schools
        child_school = link.student.user.school
        if child_school:
            link.parent.schools.add(child_school)

        parent_name = f"{link.parent.user.first_name} {link.parent.user.last_name}".strip()
        student_name = f"{link.student.user.first_name} {link.student.user.last_name}".strip()
        school_name = school.name
        class_name = link.student.student_class.name if link.student.student_class else "N/A"

        # Notify parent their link was approved
        try:
            if link.parent.user.email:
                send_parent_link_approved_email(
                    parent_email=link.parent.user.email,
                    parent_name=parent_name,
                    school_name=school_name,
                    student_name=student_name,
                    class_name=class_name,
                )
        except Exception as exc:
            logger.error("Parent link approval email failed: %s", exc)

        return Response({
            'message': 'Parent-child link approved successfully',
            'parent_name': parent_name,
            'student_name': student_name,
        })
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Link request not found or already confirmed'},
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def decline_parent_link_request(request, link_id):
    """Decline/delete a parent-child link request (Admin/Teacher only) - filtered by school"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can decline requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        link = ParentChildLink.objects.get(id=link_id, is_confirmed=False, student__user__school=school)
        parent_name = f"{link.parent.user.first_name} {link.parent.user.last_name}"
        student_name = f"{link.student.user.first_name} {link.student.user.last_name}"
        link.delete()
        
        return Response({
            'message': 'Parent-child link request declined',
            'parent_name': parent_name,
            'student_name': student_name,
        })
    except ParentChildLink.DoesNotExist:
        return Response({'error': 'Link request not found or already confirmed'}, 
                       status=status.HTTP_404_NOT_FOUND)

# Class Average Results View
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def class_averages_view(request):
    """Get class averages grouped by class and subject - filtered by school"""
    from django.db.models import Avg, Count, F
    
    school = request.user.school
    
    # Get results filtered by user's school
    queryset = Result.objects.all()
    if school:
        queryset = queryset.filter(student__user__school=school)
    
    averages = queryset.values(
        'student__student_class__name',
        'student__student_class__id',
        'subject__name',
        'subject__id',
        'exam_type'
    ).annotate(
        class_name=F('student__student_class__name'),
        subject_name=F('subject__name'),
        average_score=Avg('score'),
        average_max_score=Avg('max_score'),
        student_count=Count('student', distinct=True)
    ).order_by('class_name', 'subject_name')
    
    # Calculate percentages and grades
    results = []
    for avg in averages:
        if avg['average_max_score'] and avg['average_max_score'] > 0:
            percentage = round((avg['average_score'] / avg['average_max_score']) * 100, 2)
        else:
            percentage = 0
            
        # Calculate grade — Zimbabwe grading system
        from .grading import percentage_to_grade
        grade_info = percentage_to_grade(percentage)

        results.append({
            'class_name': avg['class_name'],
            'subject_name': avg['subject_name'],
            'exam_type': avg['exam_type'],
            'average_score': round(avg['average_score'], 2),
            'average_max_score': round(avg['average_max_score'], 2),
            'percentage': percentage,
            'grade': grade_info['grade'],
            'grade_description': grade_info['description'],
            'passed': grade_info['passed'],
            'student_count': avg['student_count']
        })
    
    return Response(results)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_timetable_view(request):
    """Generate timetables for all classes using CSP algorithm - filtered by school"""
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Only admin/HR can generate timetables'}, status=status.HTTP_403_FORBIDDEN)
    
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)
    
    academic_year = request.data.get('academic_year')
    clear_existing = request.data.get('clear_existing', True)
    
    try:
        from .timetable_generator import generate_timetable
        
        success, message, entries = generate_timetable(
            school=school,
            academic_year=academic_year,
            clear_existing=clear_existing
        )
        
        if success:
            return Response({
                'success': True,
                'message': message,
                'entries_count': len(entries),
                'timetables': TimetableSerializer(entries, many=True).data
            })
        else:
            return Response({
                'success': False,
                'message': message
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Error generating timetable: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_timetable_stats(request):
    """Get timetable statistics for admin - filtered by school"""
    if request.user.role not in ('admin', 'hr', 'superadmin'):
        return Response({'error': 'Only admin/HR can view timetable stats'}, status=status.HTTP_403_FORBIDDEN)
    
    school = request.user.school
    if not school:
        return Response({'error': 'No school associated with user'}, status=status.HTTP_400_BAD_REQUEST)
    
    total_entries = Timetable.objects.filter(class_assigned__school=school).count()
    classes_with_timetables = Timetable.objects.filter(class_assigned__school=school).values('class_assigned').distinct().count()
    total_classes = Class.objects.filter(school=school).count()
    
    return Response({
        'total_entries': total_entries,
        'classes_with_timetables': classes_with_timetables,
        'total_classes': total_classes,
        'coverage_percent': round((classes_with_timetables / total_classes * 100) if total_classes > 0 else 0, 1)
    })


# ---------------------------------------------------------------
# Report Card PDF Generation
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def generate_report_card(request, student_id):
    """
    Generate a PDF report card for a student.
    Query params: ?year=2025&term=Term+1
    Allowed: admin (any student in school), student (own report only),
             parent (confirmed linked children only),
             teacher (students in classes they teach / are class teacher of).
    """
    from django.http import HttpResponse

    user = request.user
    school = user.school
    year = request.query_params.get('year', '')
    term = request.query_params.get('term', '')

    try:
        student = Student.objects.select_related('user', 'student_class').get(id=student_id, user__school=school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── Permission checks per role ──────────────────────────────────────
    if user.role == 'student':
        try:
            if user.student.id != student.id:
                return Response({'error': 'You can only view your own report card.'}, status=status.HTTP_403_FORBIDDEN)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_403_FORBIDDEN)

    elif user.role == 'parent':
        from .models import ParentChildLink
        is_linked = ParentChildLink.objects.filter(
            parent=user.parent, student=student, is_confirmed=True
        ).exists()
        if not is_linked:
            return Response({'error': 'You can only view report cards for your confirmed children.'}, status=status.HTTP_403_FORBIDDEN)

    elif user.role == 'teacher':
        from .models import Timetable
        teacher = user.teacher
        is_class_teacher = Class.objects.filter(
            id=student.student_class_id, class_teacher=user
        ).exists() if student.student_class_id else False
        teaches_class = Timetable.objects.filter(
            teacher=teacher, class_assigned_id=student.student_class_id
        ).exists() if student.student_class_id else False
        if not is_class_teacher and not teaches_class:
            return Response({'error': 'You can only view report cards for students in your classes.'}, status=status.HTTP_403_FORBIDDEN)

    elif user.role == 'admin':
        pass  # admins can access any student in their school

    else:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    # ── Check if reports are published (students and parents only) ─────
    if user.role in ('student', 'parent') and student.student_class_id:
        from .models import ReportCardRelease
        is_published = ReportCardRelease.objects.filter(
            school=school, class_obj_id=student.student_class_id,
            academic_year=year, academic_term=term,
        ).exists()
        if not is_published:
            return Response(
                {'error': 'Report cards for this term have not been published yet. Please check back later.'},
                status=status.HTTP_403_FORBIDDEN
            )

    # ── Build PDF ───────────────────────────────────────────────────────
    # Only include results marked for the report card.
    # Use report_term override when set, otherwise fall back to academic_term.
    from django.db.models import Case, When, F, CharField
    results = Result.objects.filter(
        student=student, academic_year=year, include_in_report=True,
    ).annotate(
        effective_term=Case(
            When(report_term='', then=F('academic_term')),
            default=F('report_term'),
            output_field=CharField(),
        )
    ).filter(effective_term=term).select_related('subject').order_by('subject__name')

    buffer = _build_report_card_pdf(student, results, school, year, term)

    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="report_card_{student.user.student_number}_{term}_{year}.pdf"'
    )
    return response


def _get_report_config(school):
    """Get the ReportCardConfig for a school, or return None for defaults."""
    from users.models import ReportCardConfig
    try:
        return ReportCardConfig.objects.get(school=school)
    except ReportCardConfig.DoesNotExist:
        return None


def _cfg(cfg, attr, default):
    """Safe getattr for config or default."""
    return getattr(cfg, attr, default) if cfg else default


def _font_name(family, bold=False, italic=False):
    """Map font_family config → reportlab built-in font."""
    if family == 'sans':
        base = 'Helvetica'
    elif family == 'elegant':
        base = 'Times-Roman'
        italic = True  # elegant is italic-leaning
    else:
        base = 'Times-Roman'  # serif
    if bold and italic:
        suffix = '-BoldOblique' if base == 'Helvetica' else '-BoldItalic'
    elif bold:
        suffix = '-Bold'
    elif italic:
        suffix = '-Oblique' if base == 'Helvetica' else '-Italic'
    else:
        suffix = ''
    return base + suffix


def _font_scale(scale):
    return {'compact': 0.88, 'normal': 1.0, 'large': 1.12}.get(scale, 1.0)


def _compute_class_position(student, year, term):
    """Return (rank, class_size) for this student in their class for the term."""
    from django.db.models import Sum, F, FloatField, ExpressionWrapper
    if not student.student_class_id:
        return None, None
    class_students = Student.objects.filter(
        student_class_id=student.student_class_id, user__is_active=True,
    ).values_list('id', flat=True)
    totals = {}
    for r in Result.objects.filter(
        student_id__in=class_students, academic_year=year,
        academic_term=term, include_in_report=True, max_score__gt=0,
    ).values('student_id', 'score', 'max_score'):
        pct = (r['score'] / r['max_score']) * 100 if r['max_score'] else 0
        totals.setdefault(r['student_id'], []).append(pct)
    averages = [(sid, sum(v) / len(v)) for sid, v in totals.items() if v]
    if not averages:
        return None, None
    averages.sort(key=lambda x: x[1], reverse=True)
    for i, (sid, _) in enumerate(averages, start=1):
        if sid == student.id:
            return i, len(averages)
    return None, len(averages)


def _previous_term(term):
    return {'Term 2': 'Term 1', 'Term 3': 'Term 2'}.get(term)


def _previous_term_averages(student, year, prev_term):
    """Return {subject_name: pct} for the student's previous term."""
    if not prev_term:
        return {}
    out = {}
    for r in Result.objects.filter(
        student=student, academic_year=year, academic_term=prev_term,
        include_in_report=True,
    ).select_related('subject'):
        out.setdefault(r.subject.name, []).append(
            (r.score / r.max_score * 100) if r.max_score else 0.0
        )
    return {k: round(sum(v) / len(v), 1) for k, v in out.items() if v}


def _class_subject_stats(student, year, term):
    """Return {subject_name: (avg, high)} across the class for each subject."""
    if not student.student_class_id:
        return {}
    out = {}
    rows = Result.objects.filter(
        student__student_class_id=student.student_class_id,
        academic_year=year, academic_term=term, include_in_report=True, max_score__gt=0,
    ).select_related('subject').values('subject__name', 'score', 'max_score', 'student_id')
    by_subj = {}
    for r in rows:
        pct = (r['score'] / r['max_score']) * 100
        by_subj.setdefault(r['subject__name'], {}).setdefault(r['student_id'], []).append(pct)
    for subj, per_student in by_subj.items():
        student_avgs = [sum(v) / len(v) for v in per_student.values() if v]
        if student_avgs:
            out[subj] = (round(sum(student_avgs) / len(student_avgs), 1),
                         round(max(student_avgs), 1))
    return out


def _build_report_card_pdf(student, results, school, year, term):
    """Build a single student report card PDF and return a BytesIO buffer (seeked to 0)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, Frame, PageTemplate,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from .grading import percentage_to_grade, score_to_percentage
    from .models import SubjectTermFeedback, PromotionRecord
    from io import BytesIO
    import os

    cfg = _get_report_config(school)

    # ── Config values (with defaults) ───────────────────────────────
    primary = _cfg(cfg, 'primary_color', '#1d4ed8')
    secondary = _cfg(cfg, 'secondary_color', '#f3f4f6')
    grad_start = _cfg(cfg, 'gradient_start_color', primary)
    grad_end = _cfg(cfg, 'gradient_end_color', primary)
    header_style_kind = _cfg(cfg, 'header_style', 'solid')
    font_family = _cfg(cfg, 'font_family', 'serif')
    font_scale_k = _font_scale(_cfg(cfg, 'font_size_scale', 'normal'))
    page_size_name = _cfg(cfg, 'page_size', 'A4')
    orientation = _cfg(cfg, 'page_orientation', 'portrait')
    one_page_fit = _cfg(cfg, 'one_page_fit', False)
    if one_page_fit:
        font_scale_k *= 0.9
    show_grading_key = _cfg(cfg, 'show_grading_key', True)
    show_attendance = _cfg(cfg, 'show_attendance', True)
    show_attendance_breakdown = _cfg(cfg, 'show_attendance_breakdown', False)
    show_overall_avg = _cfg(cfg, 'show_overall_average', True)
    show_position = _cfg(cfg, 'show_position', True)
    show_class_avg = _cfg(cfg, 'show_class_average', False)
    show_prev_term = _cfg(cfg, 'show_previous_term', False)
    show_effort = _cfg(cfg, 'show_effort_grade', False)
    show_chart = _cfg(cfg, 'show_subject_chart', False)
    show_promotion = _cfg(cfg, 'show_promotion_status', False)
    show_fees_status = _cfg(cfg, 'show_fees_status', False)
    show_qr = _cfg(cfg, 'show_qr_code', False)
    grouping_on = _cfg(cfg, 'subject_grouping_enabled', False)
    show_grade_remark = _cfg(cfg, 'show_grade_remark', True)
    show_exam_types = _cfg(cfg, 'show_exam_types', True)
    highlight_pf = _cfg(cfg, 'highlight_pass_fail', False)
    principal_name = _cfg(cfg, 'principal_name', '')
    principal_title = _cfg(cfg, 'principal_title', 'Head of School')
    show_class_teacher = _cfg(cfg, 'show_class_teacher', True)
    teacher_comment = _cfg(cfg, 'teacher_comments_default', '')
    principal_comment = _cfg(cfg, 'principal_comments_default', '')
    show_next_term = _cfg(cfg, 'show_next_term_dates', True)
    footer_text = _cfg(cfg, 'custom_footer_text', '')
    watermark = _cfg(cfg, 'watermark_text', '')
    border_style = _cfg(cfg, 'border_style', 'simple')
    show_conduct = _cfg(cfg, 'show_conduct_section', False)
    show_activities = _cfg(cfg, 'show_activities_section', False)

    # ── Attendance ──
    attendance_qs = student.class_attendance_records.filter(date__isnull=False)
    attendance_total = attendance_qs.count()
    present_count = attendance_qs.filter(status='present').count()
    absent_count = attendance_qs.filter(status='absent').count()
    late_count = attendance_qs.filter(status='late').count()

    # ── Per-subject feedback (comments + effort) ──
    feedback_map = {
        fb.subject.name: fb for fb in SubjectTermFeedback.objects.filter(
            student=student, academic_year=year, academic_term=term,
        ).select_related('subject')
    }

    # ── Previous term data ──
    prev_term = _previous_term(term) if show_prev_term else None
    prev_averages = _previous_term_averages(student, year, prev_term) if prev_term else {}

    # ── Class stats ──
    class_stats = _class_subject_stats(student, year, term) if show_class_avg else {}

    # ── Subject groups ──
    subject_group_map = {}
    if grouping_on:
        from users.models import SubjectGroup
        for sg in SubjectGroup.objects.filter(school=school).select_related('subject'):
            subject_group_map[sg.subject.name] = sg.group_type

    # ── Page setup ──
    base_page = A4 if page_size_name == 'A4' else letter
    pagesize = landscape(base_page) if orientation == 'landscape' else base_page

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=pagesize, topMargin=1.3*cm, bottomMargin=1.3*cm,
                            leftMargin=1.3*cm, rightMargin=1.3*cm)
    styles = getSampleStyleSheet()
    elements = []

    primary_color = colors.HexColor(primary)
    secondary_color = colors.HexColor(secondary)
    grad_start_c = colors.HexColor(grad_start)
    grad_end_c = colors.HexColor(grad_end)

    base_font = _font_name(font_family)
    bold_font = _font_name(font_family, bold=True)

    # ── Page decorator: watermark + border ──
    def _page_decorator(canvas, doc):
        canvas.saveState()
        w, h = pagesize
        if watermark:
            canvas.setFont(bold_font, 48)
            canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.04))
            canvas.translate(w / 2, h / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, watermark)
            canvas.restoreState()
            canvas.saveState()
        if border_style == 'simple':
            canvas.setStrokeColor(primary_color)
            canvas.setLineWidth(1.5)
            canvas.rect(1 * cm, 1 * cm, w - 2 * cm, h - 2 * cm)
        elif border_style == 'decorative':
            canvas.setStrokeColor(primary_color)
            canvas.setLineWidth(2.5)
            canvas.rect(0.8 * cm, 0.8 * cm, w - 1.6 * cm, h - 1.6 * cm)
            canvas.setLineWidth(0.5)
            canvas.rect(1.1 * cm, 1.1 * cm, w - 2.2 * cm, h - 2.2 * cm)
        canvas.restoreState()

    doc.addPageTemplates([
        PageTemplate(
            id='decorated',
            frames=[Frame(1.3 * cm, 1.3 * cm, pagesize[0] - 2.6 * cm, pagesize[1] - 2.6 * cm, id='main')],
            onPage=_page_decorator,
        )
    ])

    # ── Header block ──
    header_font_size = 18 * font_scale_k
    sub_font_size = 11 * font_scale_k
    header_text_color = colors.white if header_style_kind in ('gradient', 'banner') else primary_color

    header_para_style = ParagraphStyle(
        'Header', parent=styles['Title'], fontName=bold_font,
        fontSize=header_font_size, spaceAfter=2, textColor=header_text_color,
        alignment=TA_CENTER,
    )
    sub_style = ParagraphStyle(
        'Sub', parent=styles['Normal'], fontName=base_font, fontSize=sub_font_size,
        spaceAfter=4, alignment=TA_CENTER,
        textColor=header_text_color,
    )

    logo_img = None
    if cfg and cfg.logo and hasattr(cfg.logo, 'path') and os.path.exists(cfg.logo.path):
        try:
            logo_img = Image(cfg.logo.path, width=2.2 * cm, height=2.2 * cm)
        except Exception:
            logo_img = None

    motto_para = None
    if cfg and hasattr(school, 'settings') and getattr(school.settings, 'school_motto', ''):
        motto_style = ParagraphStyle(
            'Motto', parent=styles['Normal'], fontName=_font_name(font_family, italic=True),
            fontSize=8 * font_scale_k, textColor=header_text_color,
            alignment=TA_CENTER, spaceAfter=4,
        )
        motto_para = Paragraph(f'<i>{school.settings.school_motto}</i>', motto_style)

    name_para = Paragraph(school.name, header_para_style)
    term_para = Paragraph(f'Student Report Card &mdash; {term} {year}', sub_style)

    text_parts = [[name_para]]
    if motto_para:
        text_parts.append([motto_para])
    text_parts.append([term_para])
    full_w = pagesize[0] - 2.6 * cm

    # Build the inner header table (logo + text arrangement)
    logo_position = _cfg(cfg, 'logo_position', 'center')
    if logo_img and logo_position in ('left', 'right'):
        logo_cell_w = 2.6 * cm
        text_cell_w = full_w - logo_cell_w
        text_col = Table(text_parts, colWidths=[text_cell_w])
        if logo_position == 'left':
            inner_data = [[logo_img, text_col]]
            inner_widths = [logo_cell_w, text_cell_w]
        else:
            inner_data = [[text_col, logo_img]]
            inner_widths = [text_cell_w, logo_cell_w]
        inner = Table(inner_data, colWidths=inner_widths)
        inner.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
    else:
        center_parts = []
        if logo_img:
            logo_img.hAlign = 'CENTER'
            center_parts.append([logo_img])
        center_parts.extend(text_parts)
        inner = Table(center_parts, colWidths=[full_w])
        inner.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

    # Wrap with a styled header based on header_style_kind
    banner_img = None
    if header_style_kind == 'banner' and cfg and cfg.banner_image and \
            hasattr(cfg.banner_image, 'path') and os.path.exists(cfg.banner_image.path):
        try:
            banner_img = Image(cfg.banner_image.path, width=full_w, height=2.8 * cm)
        except Exception:
            banner_img = None

    if banner_img:
        elements.append(banner_img)
        elements.append(Spacer(1, 0.15 * cm))
        # Use primary-coloured text on top of a second copy of inner (no bg)
        inner_plain_text_color = primary_color
        # Rebuild text pieces with primary colour for banners (readable outside the banner)
        header_para_style2 = ParagraphStyle('HeaderP', parent=header_para_style, textColor=inner_plain_text_color)
        sub_style2 = ParagraphStyle('SubP', parent=sub_style, textColor=colors.black)
        plain_parts = [[Paragraph(school.name, header_para_style2)]]
        if motto_para:
            motto_style2 = ParagraphStyle('MottoP', parent=motto_style, textColor=colors.grey)
            plain_parts.append([Paragraph(f'<i>{school.settings.school_motto}</i>', motto_style2)])
        plain_parts.append([Paragraph(f'Student Report Card &mdash; {term} {year}', sub_style2)])
        inner = Table(plain_parts, colWidths=[full_w])
        inner.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
        elements.append(inner)
    elif header_style_kind == 'gradient':
        # Draw a gradient band as a Drawing then overlay text — simplest: solid fill at average for now.
        # reportlab Drawing supports LinearGradient via shapes.Rect? We'll approximate with a solid mid colour strip.
        from reportlab.graphics.shapes import Rect, Drawing as GDraw
        from reportlab.graphics.shapes import String as GString
        mid_r = (grad_start_c.red + grad_end_c.red) / 2
        mid_g = (grad_start_c.green + grad_end_c.green) / 2
        mid_b = (grad_start_c.blue + grad_end_c.blue) / 2
        band = GDraw(full_w, 2.8 * cm)
        # 16 vertical strips to fake a gradient
        steps = 16
        for i in range(steps):
            frac = i / (steps - 1)
            r = grad_start_c.red + (grad_end_c.red - grad_start_c.red) * frac
            g = grad_start_c.green + (grad_end_c.green - grad_start_c.green) * frac
            b = grad_start_c.blue + (grad_end_c.blue - grad_start_c.blue) * frac
            band.add(Rect(i * full_w / steps, 0, full_w / steps + 0.5, 2.8 * cm,
                          fillColor=colors.Color(r, g, b), strokeColor=None))
        elements.append(band)
        elements.append(Spacer(1, -2.8 * cm))  # overlap text on top
        inner.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(inner)
    elif header_style_kind == 'solid' and header_text_color == colors.white:
        # (not possible since solid uses primary text colour — we keep plain inner)
        elements.append(inner)
    else:
        elements.append(inner)

    elements.append(Spacer(1, 0.3 * cm))

    # ── Student info table ──
    info_data = [
        ['Student Name:', student.user.full_name, 'Student Number:', student.user.student_number or '-'],
        ['Class:', student.student_class.name if student.student_class else '-', 'Gender:', student.gender or '-'],
    ]
    if show_attendance:
        att_val = f'{present_count}/{attendance_total} days'
        if show_attendance_breakdown:
            att_val = f'P:{present_count} A:{absent_count} L:{late_count} (of {attendance_total})'
        info_data.append(['Admission Date:', str(student.admission_date), 'Attendance:', att_val])
    if show_class_teacher and student.student_class and student.student_class.class_teacher:
        ct = student.student_class.class_teacher
        info_data.append(['Class Teacher:', ct.full_name, '', ''])

    if show_position:
        rank, size = _compute_class_position(student, year, term)
        if rank:
            suffix = 'th' if 10 <= rank % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(rank % 10, 'th')
            info_data.append(['Position in Class:', f'{rank}{suffix} of {size}', '', ''])

    if show_promotion:
        promo = PromotionRecord.objects.filter(student=student, academic_year=year).order_by('-date_processed').first()
        if promo:
            info_data.append(['Promotion Status:',
                              f'{promo.get_action_display()}'
                              + (f' → {promo.to_class.name}' if promo.to_class else ''),
                              '', ''])

    if show_fees_status:
        try:
            from finances.models import StudentFee
            fees = StudentFee.objects.filter(student=student, academic_year=year, academic_term=term)
            due = sum((f.amount_due for f in fees), 0)
            paid = sum((f.amount_paid for f in fees), 0)
            bal = due - paid
            currency = getattr(school.settings, 'currency', 'USD') if hasattr(school, 'settings') else 'USD'
            info_data.append(['Fees Status:',
                              f'{currency} {float(bal):.2f} outstanding' if bal > 0 else 'Fully Paid',
                              '', ''])
        except Exception:
            pass

    # Compute column widths based on page width
    col_total = pagesize[0] - 2.6 * cm
    info_table = Table(info_data, colWidths=[3 * cm, col_total / 2 - 3 * cm,
                                              3.5 * cm, col_total / 2 - 3.5 * cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0e7ff')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#e0e7ff')),
        ('FONTNAME', (0, 0), (-1, -1), base_font),
        ('FONTNAME', (0, 0), (0, -1), bold_font),
        ('FONTNAME', (2, 0), (2, -1), bold_font),
        ('FONTSIZE', (0, 0), (-1, -1), 9 * font_scale_k),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.4 * cm))

    # ── Aggregate results per subject ──
    from collections import OrderedDict
    subject_data = OrderedDict()
    for r in results:
        name = r.subject.name
        if name not in subject_data:
            subject_data[name] = {'score': 0, 'max_score': 0}
        subject_data[name]['score'] += r.score
        subject_data[name]['max_score'] += r.max_score

    # Organise by group if enabled
    def _subject_list():
        if grouping_on:
            groups_order = ['core', 'language', 'elective', 'other']
            buckets = {g: [] for g in groups_order}
            ungrouped = []
            for subj_name, data in subject_data.items():
                g = subject_group_map.get(subj_name)
                if g in buckets:
                    buckets[g].append((subj_name, data))
                else:
                    ungrouped.append((subj_name, data))
            for g in groups_order:
                if buckets[g]:
                    yield (g.capitalize(), buckets[g])
            if ungrouped:
                yield ('Other', ungrouped)
        else:
            yield (None, list(subject_data.items()))

    # ── Build results heading + table(s) ──
    heading_style = ParagraphStyle('H2', parent=styles['Heading2'], fontName=bold_font,
                                   fontSize=13 * font_scale_k, textColor=primary_color)
    elements.append(Paragraph('Academic Results', heading_style))

    def _build_results_header():
        header = ['Subject', 'Score', 'Max', '%', 'Grade']
        if show_grade_remark:
            header.append('Remark')
        if show_effort:
            header.append('Effort')
        if show_class_avg:
            header.append('Class Avg')
            header.append('Top')
        if show_prev_term and prev_averages:
            header.append('Last Term')
            header.append('Trend')
        return header

    total_pct = 0.0
    subject_count = 0
    row_colors_all = []
    any_rows = False

    for group_label, items in _subject_list():
        if group_label:
            gh = ParagraphStyle('GH', parent=styles['Heading3'], fontName=bold_font,
                                fontSize=10 * font_scale_k, textColor=colors.HexColor('#374151'),
                                spaceBefore=4, spaceAfter=2)
            elements.append(Paragraph(group_label, gh))

        header = _build_results_header()
        rows = [header]
        row_colors = []

        for subj_name, data in items:
            pct = score_to_percentage(data['score'], data['max_score'])
            gi = percentage_to_grade(pct)
            row = [subj_name,
                   str(round(data['score'], 1)),
                   str(round(data['max_score'], 1)),
                   f'{pct}%',
                   gi['grade']]
            if show_grade_remark:
                row.append(gi['description'])
            if show_effort:
                fb = feedback_map.get(subj_name)
                row.append(fb.effort_grade if fb and fb.effort_grade else '-')
            if show_class_avg:
                stats = class_stats.get(subj_name)
                row.append(f'{stats[0]}%' if stats else '-')
                row.append(f'{stats[1]}%' if stats else '-')
            if show_prev_term and prev_averages:
                prev = prev_averages.get(subj_name)
                if prev is None:
                    row.append('-')
                    row.append('-')
                else:
                    row.append(f'{prev}%')
                    if pct > prev + 1:
                        row.append('▲')
                    elif pct < prev - 1:
                        row.append('▼')
                    else:
                        row.append('►')
            rows.append(row)
            row_colors.append(gi['colour'])
            total_pct += pct
            subject_count += 1

        if len(rows) <= 1:
            continue
        any_rows = True

        # Column widths scale to fit page
        ncols = len(header)
        subj_col = 4 * cm
        remaining = col_total - subj_col
        rest_w = remaining / (ncols - 1)
        col_widths = [subj_col] + [rest_w] * (ncols - 1)

        result_table = Table(rows, colWidths=col_widths, repeatRows=1)
        table_style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), bold_font),
            ('FONTNAME', (0, 1), (-1, -1), base_font),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5 * font_scale_k),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]
        if not highlight_pf:
            table_style_cmds.append(
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, secondary_color])
            )
        result_table.setStyle(TableStyle(table_style_cmds))

        if highlight_pf:
            for i, colour_hex in enumerate(row_colors, start=1):
                c = colors.HexColor(colour_hex)
                light = colors.Color(c.red, c.green, c.blue, alpha=0.14)
                result_table.setStyle(TableStyle([('BACKGROUND', (0, i), (-1, i), light)]))

        elements.append(result_table)
        elements.append(Spacer(1, 0.3 * cm))
        row_colors_all.extend(row_colors)

    if not any_rows:
        elements.append(Paragraph('No results recorded for this term.', styles['Normal']))

    # ── Per-subject teacher comments ──
    subj_comments = [(name, fb) for name, fb in feedback_map.items() if fb.comment]
    if subj_comments:
        elements.append(Spacer(1, 0.2 * cm))
        sc_head = ParagraphStyle('SC', parent=styles['Heading3'], fontName=bold_font,
                                 fontSize=10 * font_scale_k, textColor=primary_color,
                                 spaceAfter=2)
        elements.append(Paragraph('Subject Teacher Comments', sc_head))
        for subj_name, fb in subj_comments:
            c_style = ParagraphStyle('C', parent=styles['Normal'], fontName=base_font,
                                     fontSize=8.5 * font_scale_k, leftIndent=8, spaceAfter=2)
            elements.append(Paragraph(f'<b>{subj_name}:</b> {fb.comment}', c_style))

    # ── Overall average ──
    if show_overall_avg and subject_count > 0:
        avg_pct = round(total_pct / subject_count, 1)
        avg_grade = percentage_to_grade(avg_pct)
        elements.append(Spacer(1, 0.15 * cm))
        elements.append(Paragraph(
            f'<b>Overall Average:</b> {avg_pct}% &mdash; Grade {avg_grade["grade"]} ({avg_grade["description"]})',
            styles['Normal'],
        ))

    # ── Subject score bar chart ──
    if show_chart and subject_count > 0:
        elements.append(Spacer(1, 0.4 * cm))
        chart_head = ParagraphStyle('CH', parent=styles['Heading3'], fontName=bold_font,
                                    fontSize=10 * font_scale_k, textColor=primary_color)
        elements.append(Paragraph('Subject Performance', chart_head))
        names = []
        values = []
        for subj_name, data in subject_data.items():
            names.append(subj_name[:10])
            values.append(score_to_percentage(data['score'], data['max_score']))
        d = Drawing(col_total, 4.5 * cm)
        bc = VerticalBarChart()
        bc.x = 30
        bc.y = 15
        bc.height = 90
        bc.width = col_total - 60
        bc.data = [values]
        bc.categoryAxis.categoryNames = names
        bc.categoryAxis.labels.fontSize = 7
        bc.categoryAxis.labels.angle = 30
        bc.categoryAxis.labels.dy = -6
        bc.valueAxis.valueMin = 0
        bc.valueAxis.valueMax = 100
        bc.valueAxis.valueStep = 25
        bc.bars[0].fillColor = primary_color
        d.add(bc)
        elements.append(d)

    # ── Conduct & Activities placeholders ──
    if show_conduct:
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph('Conduct &amp; Discipline', styles['Heading3']))
        elements.append(Paragraph('_' * 80, styles['Normal']))
    if show_activities:
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph('Extra-Curricular Activities', styles['Heading3']))
        elements.append(Paragraph('_' * 80, styles['Normal']))

    # ── General comments ──
    if teacher_comment or principal_comment:
        elements.append(Spacer(1, 0.3 * cm))
        c_style = ParagraphStyle('Comment', parent=styles['Normal'], fontName=base_font,
                                 fontSize=9 * font_scale_k, spaceAfter=5)
        if teacher_comment:
            elements.append(Paragraph(f"<b>Class Teacher's Comment:</b> {teacher_comment}", c_style))
        if principal_comment:
            elements.append(Paragraph(f"<b>Head of School's Comment:</b> {principal_comment}", c_style))

    # ── Next term dates ──
    if show_next_term and term != 'Term 3':
        try:
            sschool = school.settings
            next_num = {'Term 1': 2, 'Term 2': 3}.get(term)
            if next_num:
                ns = getattr(sschool, f'term_{next_num}_start', None)
                ne = getattr(sschool, f'term_{next_num}_end', None)
                if ns or ne:
                    elements.append(Spacer(1, 0.2 * cm))
                    parts = [f'<b>Next Term (Term {next_num}):</b>']
                    if ns:
                        parts.append(f'Opens {ns.strftime("%d %B %Y")}')
                    if ne:
                        parts.append(f'Closes {ne.strftime("%d %B %Y")}')
                    elements.append(Paragraph(' &mdash; '.join(parts), styles['Normal']))
        except Exception:
            pass

    # ── Grading key ──
    if show_grading_key:
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph('Grading Key', styles['Heading3']))
        key_data = [
            ['Grade', 'Description', 'Range'],
            ['A', 'Distinction', '70 - 100%'],
            ['B', 'Merit', '60 - 69%'],
            ['C', 'Credit (Pass)', '50 - 59%'],
            ['D', 'Satisfactory', '40 - 49%'],
            ['E', 'Fail', '0 - 39%'],
        ]
        key_table = Table(key_data, colWidths=[2 * cm, 3.5 * cm, 3 * cm])
        key_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), bold_font),
            ('FONTNAME', (0, 1), (-1, -1), base_font),
            ('FONTSIZE', (0, 0), (-1, -1), 8 * font_scale_k),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(key_table)

    # ── Signature + QR row ──
    qr_image = None
    if show_qr:
        try:
            from django.core.signing import TimestampSigner
            import qrcode
            signer = TimestampSigner(salt='report-card')
            token = signer.sign(f'{student.id}|{year}|{term}')
            base_url = getattr(school, 'website', '') or 'https://tishanyq.co.zw'
            verify_url = f'{base_url.rstrip("/")}/api/auth/reports/verify/{token}/'
            qr = qrcode.QRCode(box_size=4, border=1)
            qr.add_data(verify_url)
            qr.make(fit=True)
            qr_img_pil = qr.make_image(fill_color='black', back_color='white')
            qr_buf = BytesIO()
            qr_img_pil.save(qr_buf, format='PNG')
            qr_buf.seek(0)
            qr_image = Image(qr_buf, width=2.3 * cm, height=2.3 * cm)
        except Exception:
            qr_image = None

    if principal_name:
        elements.append(Spacer(1, 0.7 * cm))
        teacher_name_text = ''
        if show_class_teacher and student.student_class and student.student_class.class_teacher:
            teacher_name_text = student.student_class.class_teacher.full_name

        # three-column row: class teacher signature | qr (if any) | principal stamp+name
        stamp_img = None
        if cfg and cfg.stamp_image and hasattr(cfg.stamp_image, 'path') and os.path.exists(cfg.stamp_image.path):
            try:
                stamp_img = Image(cfg.stamp_image.path, width=1.8 * cm, height=1.8 * cm)
            except Exception:
                stamp_img = None

        sig_cells = [[
            Paragraph(f'<br/><br/>_________________________<br/><b>{teacher_name_text}</b><br/>Class Teacher', styles['Normal']),
            qr_image if qr_image else '',
            Paragraph(
                (f'<br/><br/>_________________________<br/><b>{principal_name}</b><br/>{principal_title}'),
                styles['Normal'],
            ),
        ]]
        third = col_total / 3
        sig_table = Table(sig_cells, colWidths=[third, third, third])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 0), (-1, -1), 9 * font_scale_k),
        ]))
        elements.append(sig_table)
        if stamp_img:
            stamp_img.hAlign = 'RIGHT'
            elements.append(stamp_img)
    elif qr_image:
        elements.append(Spacer(1, 0.5 * cm))
        qr_image.hAlign = 'RIGHT'
        elements.append(qr_image)

    # ── Footer ──
    elements.append(Spacer(1, 0.4 * cm))
    footer_parts = [f'Generated on {timezone.now().strftime("%d %B %Y")}', school.name]
    if footer_text:
        footer_parts.append(footer_text)
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontName=base_font,
                                  fontSize=7.5 * font_scale_k, textColor=colors.grey,
                                  alignment=TA_CENTER)
    elements.append(Paragraph(' | '.join(footer_parts), footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer


# ---------------------------------------------------------------
# Bulk CSV Import — Students & Results
# ---------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_import_students(request):
    """
    Import students from a CSV file.
    Columns: full_name, email, phone, class_name, date_of_birth, gender
    """
    import csv, io
    from django.db import transaction
    from users.models import CustomUser
    from .serializers import CreateStudentSerializer

    if request.user.role != 'admin':
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return Response({'error': 'No CSV file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    decoded = csv_file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    created, errors = 0, []

    for i, row in enumerate(reader, start=2):
        try:
            full_name = row.get('full_name', '').strip()
            name_parts = full_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            email = row.get('email', '').strip()
            phone = row.get('phone', '').strip() or None
            class_name = row.get('class_name', '').strip()
            dob = row.get('date_of_birth', '').strip() or None
            gender = row.get('gender', '').strip()

            student_class = Class.objects.filter(name__iexact=class_name, school=school).first()
            if not student_class:
                errors.append({'row': i, 'error': f"Class '{class_name}' not found."})
                continue

            serializer = CreateStudentSerializer(
                data={
                    'first_name': first_name, 'last_name': last_name, 'email': email,
                    'phone_number': phone, 'student_class': student_class.id,
                    'admission_date': str(timezone.now().date()),
                    'date_of_birth': dob, 'gender': gender,
                },
                context={'request': request}
            )
            if serializer.is_valid():
                serializer.save()
                created += 1
            else:
                errors.append({'row': i, 'error': str(serializer.errors)})
        except Exception as exc:
            errors.append({'row': i, 'error': str(exc)})

    return Response({
        'created': created, 'errors': errors,
        'message': f'Imported {created} students with {len(errors)} errors.'
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def bulk_import_results(request):
    """
    Import results from a CSV file.
    Columns: student_number, subject_code, exam_type, score, max_score, term, year
    """
    import csv, io

    if request.user.role not in ('admin', 'teacher'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return Response({'error': 'No CSV file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    decoded = csv_file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    created, errors = 0, []

    for i, row in enumerate(reader, start=2):
        try:
            student_number = row.get('student_number', '').strip()
            subject_code = row.get('subject_code', '').strip()
            exam_type = row.get('exam_type', '').strip()
            score = float(row.get('score', 0))
            max_score = float(row.get('max_score', 100))
            term = row.get('term', '').strip()
            year = row.get('year', '').strip()

            student = Student.objects.get(user__student_number=student_number, user__school=school)
            subject = Subject.objects.get(code=subject_code, school=school)

            teacher = None
            if request.user.role == 'teacher':
                try:
                    teacher = request.user.teacher
                except Exception:
                    pass
            if not teacher:
                teacher = subject.teachers.filter(user__school=school).first()

            if not teacher:
                errors.append({'row': i, 'error': 'No teacher found for subject.'})
                continue

            Result.objects.update_or_create(
                student=student, subject=subject, exam_type=exam_type,
                academic_term=term, academic_year=year,
                defaults={'score': score, 'max_score': max_score, 'teacher': teacher}
            )
            created += 1
        except Student.DoesNotExist:
            errors.append({'row': i, 'error': f"Student '{row.get('student_number')}' not found."})
        except Subject.DoesNotExist:
            errors.append({'row': i, 'error': f"Subject '{row.get('subject_code')}' not found."})
        except Exception as exc:
            errors.append({'row': i, 'error': str(exc)})

    return Response({
        'created': created, 'errors': errors,
        'message': f'Imported {created} results with {len(errors)} errors.'
    })


# ---------------------------------------------------------------
# AI Grade Predictions
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_grade_prediction(request, student_id):
    """
    Predict a student's future grades per subject using linear regression.
    Returns trend and predicted percentage for each subject.
    """
    if request.user.role not in ('admin', 'teacher', 'parent', 'student'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    try:
        student = Student.objects.get(id=student_id, user__school=school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    from .ml_predictions import predict_student_grades
    predictions = predict_student_grades(student)
    return Response({'predictions': predictions, 'student': student.user.full_name})


# ── Timetable Conflict Detection ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def timetable_conflict_check(request):
    """
    Check the school's timetable for conflicts.
    Returns a list of detected conflicts:
      - Teacher double-booked (same teacher, same day, overlapping slots)
      - Room double-booked (same room, same day, overlapping slots)
      - Class double-booked (same class, same day, overlapping slots)
    """
    if request.user.role not in ('admin', 'superadmin'):
        return Response({'error': 'Admins only'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    entries = list(
        Timetable.objects.filter(class_assigned__school=school)
        .select_related('class_assigned', 'subject', 'teacher__user')
        .order_by('day_of_week', 'start_time')
    )

    def overlaps(a, b):
        """True if two timetable entries overlap in time."""
        return a.start_time < b.end_time and b.start_time < a.end_time

    conflicts = []

    # Group by day for efficiency
    from itertools import combinations
    from collections import defaultdict

    by_day = defaultdict(list)
    for e in entries:
        by_day[e.day_of_week].append(e)

    for day, day_entries in by_day.items():
        for a, b in combinations(day_entries, 2):
            if not overlaps(a, b):
                continue

            # Teacher conflict
            if a.teacher_id and a.teacher_id == b.teacher_id:
                conflicts.append({
                    'type': 'teacher',
                    'day': day,
                    'teacher': f"{a.teacher.user.first_name} {a.teacher.user.last_name}",
                    'slot_1': {'class': a.class_assigned.name, 'subject': a.subject.name,
                               'time': f"{a.start_time}-{a.end_time}"},
                    'slot_2': {'class': b.class_assigned.name, 'subject': b.subject.name,
                               'time': f"{b.start_time}-{b.end_time}"},
                })

            # Room conflict (skip empty rooms)
            if a.room and b.room and a.room.strip().lower() == b.room.strip().lower():
                conflicts.append({
                    'type': 'room',
                    'day': day,
                    'room': a.room,
                    'slot_1': {'class': a.class_assigned.name, 'subject': a.subject.name,
                               'time': f"{a.start_time}-{a.end_time}"},
                    'slot_2': {'class': b.class_assigned.name, 'subject': b.subject.name,
                               'time': f"{b.start_time}-{b.end_time}"},
                })

            # Class double-booked
            if a.class_assigned_id == b.class_assigned_id:
                conflicts.append({
                    'type': 'class',
                    'day': day,
                    'class': a.class_assigned.name,
                    'slot_1': {'subject': a.subject.name, 'time': f"{a.start_time}-{a.end_time}"},
                    'slot_2': {'subject': b.subject.name, 'time': f"{b.start_time}-{b.end_time}"},
                })

    return Response({
        'total_entries': len(entries),
        'conflict_count': len(conflicts),
        'conflicts': conflicts,
    })


# ── Subject-Teacher Assignment ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_teachers(request, subject_id):
    """Get all teachers assigned to a subject"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    try:
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

    teachers = subject.teachers.select_related('user').all()
    data = [{
        'id': t.id,
        'user_id': t.user.id,
        'first_name': t.user.first_name,
        'last_name': t.user.last_name,
        'email': t.user.email,
        'qualification': t.qualification,
    } for t in teachers]
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assign_teacher_to_subject(request, subject_id):
    """Assign a teacher to a subject"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    try:
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

    teacher_id = request.data.get('teacher_id')
    if not teacher_id:
        return Response({'error': 'teacher_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .models import Teacher
        teacher = Teacher.objects.get(id=teacher_id, user__school=request.user.school)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

    if subject.teachers.filter(id=teacher.id).exists():
        return Response({'error': 'Teacher already assigned to this subject'}, status=status.HTTP_400_BAD_REQUEST)

    teacher.subjects_taught.add(subject)
    return Response({'message': f'{teacher.user.first_name} {teacher.user.last_name} assigned to {subject.name}'}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_teacher_from_subject(request, subject_id, teacher_id):
    """Remove a teacher from a subject"""
    if request.user.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    try:
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        from .models import Teacher
        teacher = Teacher.objects.get(id=teacher_id)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

    teacher.subjects_taught.remove(subject)
    return Response({'message': f'{teacher.user.first_name} {teacher.user.last_name} removed from {subject.name}'})


# ── Report Card Publishing ─────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def publish_reports(request):
    """
    Publish report cards for a single class/year/term.
    Creates a ReportCardRelease record and sends announcements to
    students, parents, and the class teacher.
    Body: { "class_id": 5, "year": "2026", "term": "Term 1" }
    """
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can publish reports'}, status=status.HTTP_403_FORBIDDEN)

    class_id = request.data.get('class_id')
    year = request.data.get('year')
    term = request.data.get('term')

    if not all([class_id, year, term]):
        return Response({'error': 'class_id, year, and term are required'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    try:
        class_obj = Class.objects.get(id=class_id, school=school)
    except Class.DoesNotExist:
        return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import ReportCardRelease, Announcement
    release, created = ReportCardRelease.objects.get_or_create(
        school=school, class_obj=class_obj, academic_year=year, academic_term=term,
        defaults={'published_by': request.user}
    )

    if not created:
        return Response({'message': f'Reports for {class_obj.name} - {term} {year} were already published',
                         'already_published': True})

    # Create announcements for students + parents + class teacher
    for audience in ['student', 'parent', 'teacher']:
        Announcement.objects.create(
            title=f'Report Cards Available — {term} {year}',
            content=f'Report cards for {class_obj.name} ({term} {year}) are now available for download. '
                    f'Go to your Results page to download the PDF.',
            author=request.user,
            target_audience=audience,
            target_class=class_obj,
        )

    return Response({
        'message': f'Reports published for {class_obj.name} - {term} {year}',
        'class_name': class_obj.name,
        'published': True,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def publish_all_reports(request):
    """
    Publish report cards for ALL classes in the school for a given year/term.
    Body: { "year": "2026", "term": "Term 1" }
    """
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can publish reports'}, status=status.HTTP_403_FORBIDDEN)

    year = request.data.get('year')
    term = request.data.get('term')

    if not all([year, term]):
        return Response({'error': 'year and term are required'}, status=status.HTTP_400_BAD_REQUEST)

    school = request.user.school
    classes = Class.objects.filter(school=school)

    from .models import ReportCardRelease, Announcement
    published = []
    skipped = []

    for class_obj in classes:
        _, created = ReportCardRelease.objects.get_or_create(
            school=school, class_obj=class_obj, academic_year=year, academic_term=term,
            defaults={'published_by': request.user}
        )
        if created:
            published.append(class_obj.name)
            for audience in ['student', 'parent', 'teacher']:
                Announcement.objects.create(
                    title=f'Report Cards Available — {term} {year}',
                    content=f'Report cards for {class_obj.name} ({term} {year}) are now available for download. '
                            f'Go to your Results page to download the PDF.',
                    author=request.user,
                    target_audience=audience,
                    target_class=class_obj,
                )
        else:
            skipped.append(class_obj.name)

    return Response({
        'message': f'{len(published)} class(es) published, {len(skipped)} already published',
        'published_classes': published,
        'skipped_classes': skipped,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_published_reports(request):
    """List all published report card releases for the school."""
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can view this'}, status=status.HTTP_403_FORBIDDEN)

    from .models import ReportCardRelease
    releases = ReportCardRelease.objects.filter(
        school=request.user.school
    ).select_related('class_obj', 'published_by').order_by('-published_at')

    data = [{
        'id': r.id,
        'class_id': r.class_obj.id,
        'class_name': r.class_obj.name,
        'academic_year': r.academic_year,
        'academic_term': r.academic_term,
        'published_by': r.published_by.full_name,
        'published_at': r.published_at.isoformat(),
    } for r in releases]

    return Response({'releases': data})
