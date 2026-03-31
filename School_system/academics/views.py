import logging

from django.db.models import Avg, Count, Q, Prefetch
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
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
    CreateResultSerializer, CreateStudentSerializer, CreateTeacherSerializer, CreateParentSerializer
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
        class_id = self.request.query_params.get('class', None)
        if class_id:
            queryset = queryset.filter(student_class_id=class_id)
        return queryset


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Student.objects.filter(user__school=user.school).select_related(
                'user', 'student_class'
            ).prefetch_related('parents__user')
        return Student.objects.none()


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
            return Teacher.objects.filter(user__school=user.school).select_related('user').prefetch_related('subjects_taught')
        return Teacher.objects.none()


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
            queryset = Complaint.objects.filter(student__user__school=user.school).select_related(
                'student__user', 'submitted_by'
            )
        else:
            queryset = Complaint.objects.none()

        if user.role == 'student':
            queryset = queryset.filter(student__user=user)
        elif user.role == 'parent':
            children_ids = user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        elif user.role == 'teacher':
            queryset = queryset.filter(submitted_by=user)

        return queryset.order_by('-date_submitted')

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            return Complaint.objects.filter(student__user__school=user.school)
        return Complaint.objects.none()


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
        if self.request.user.role == 'teacher':
            serializer.save(teacher=self.request.user.teacher)
        else:
            return Response({'error': 'Only teachers can create suspensions'}, 
                          status=status.HTTP_403_FORBIDDEN)


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
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can generate timetables'}, status=status.HTTP_403_FORBIDDEN)
    
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
    if request.user.role != 'admin':
        return Response({'error': 'Only admins can view timetable stats'}, status=status.HTTP_403_FORBIDDEN)
    
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


def _build_report_card_pdf(student, results, school, year, term):
    """Build a single student report card PDF and return a BytesIO buffer (seeked to 0)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, Frame, PageTemplate
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from .grading import percentage_to_grade, score_to_percentage
    from io import BytesIO
    import os

    cfg = _get_report_config(school)

    # ── Config values (with defaults) ───────────────────────────────
    primary = cfg.primary_color if cfg else '#1d4ed8'
    secondary = cfg.secondary_color if cfg else '#f3f4f6'
    show_grading_key = cfg.show_grading_key if cfg else True
    show_attendance = cfg.show_attendance if cfg else True
    show_overall_avg = cfg.show_overall_average if cfg else True
    show_grade_remark = cfg.show_grade_remark if cfg else True
    show_exam_types = cfg.show_exam_types if cfg else True
    highlight_pf = cfg.highlight_pass_fail if cfg else False
    principal_name = cfg.principal_name if cfg else ''
    principal_title = cfg.principal_title if cfg else 'Head of School'
    show_class_teacher = cfg.show_class_teacher if cfg else True
    teacher_comment = cfg.teacher_comments_default if cfg else ''
    principal_comment = cfg.principal_comments_default if cfg else ''
    show_next_term = cfg.show_next_term_dates if cfg else True
    footer_text = cfg.custom_footer_text if cfg else ''
    watermark = cfg.watermark_text if cfg else ''
    border_style = cfg.border_style if cfg else 'simple'
    show_conduct = cfg.show_conduct_section if cfg else False
    show_activities = cfg.show_activities_section if cfg else False

    attendance_total = student.class_attendance_records.filter(date__isnull=False).count()
    present_count = student.class_attendance_records.filter(status='present').count()

    buffer = BytesIO()
    pagesize = A4
    doc = SimpleDocTemplate(buffer, pagesize=pagesize, topMargin=1.5*cm, bottomMargin=1.5*cm,
                            leftMargin=1.5*cm, rightMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = []

    primary_color = colors.HexColor(primary)
    secondary_color = colors.HexColor(secondary)

    # ── Border / page decorator ─────────────────────────────────────
    def _page_decorator(canvas, doc):
        canvas.saveState()
        w, h = pagesize
        # Watermark
        if watermark:
            canvas.setFont('Helvetica-Bold', 48)
            canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.04))
            canvas.translate(w/2, h/2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, watermark)
            canvas.restoreState()
            canvas.saveState()
        # Border
        if border_style == 'simple':
            canvas.setStrokeColor(primary_color)
            canvas.setLineWidth(1.5)
            canvas.rect(1*cm, 1*cm, w - 2*cm, h - 2*cm)
        elif border_style == 'decorative':
            canvas.setStrokeColor(primary_color)
            canvas.setLineWidth(2.5)
            canvas.rect(0.8*cm, 0.8*cm, w - 1.6*cm, h - 1.6*cm)
            canvas.setLineWidth(0.5)
            canvas.rect(1.1*cm, 1.1*cm, w - 2.2*cm, h - 2.2*cm)
        canvas.restoreState()

    doc.addPageTemplates([
        PageTemplate(id='decorated',
                     frames=[Frame(1.5*cm, 1.5*cm, pagesize[0]-3*cm, pagesize[1]-3*cm,
                                   id='main')],
                     onPage=_page_decorator)
    ])

    # ── Header with optional logo ───────────────────────────────────
    header_style = ParagraphStyle('Header', parent=styles['Title'], fontSize=18,
                                  spaceAfter=2, textColor=primary_color, alignment=TA_CENTER)
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=11,
                                spaceAfter=4, alignment=TA_CENTER)

    logo_position = cfg.logo_position if cfg else 'center'
    logo_img = None
    if cfg and cfg.logo and hasattr(cfg.logo, 'path') and os.path.exists(cfg.logo.path):
        try:
            logo_img = Image(cfg.logo.path, width=2.5*cm, height=2.5*cm)
        except Exception:
            logo_img = None

    # Build motto paragraph
    motto_para = None
    if cfg and cfg.school and hasattr(cfg.school, 'settings') and cfg.school.settings.school_motto:
        motto_style = ParagraphStyle('Motto', parent=styles['Normal'], fontSize=8,
                                      textColor=colors.grey, alignment=TA_CENTER, spaceAfter=4)
        motto_para = Paragraph(f'<i>{cfg.school.settings.school_motto}</i>', motto_style)

    if logo_img and logo_position in ('left', 'right'):
        # Logo beside school name using a table layout
        from reportlab.platypus import KeepTogether
        name_para = Paragraph(school.name, header_style)
        term_para = Paragraph(f'Student Report Card &mdash; {term} {year}', sub_style)
        text_parts = [[name_para]]
        if motto_para:
            text_parts.append([motto_para])
        text_parts.append([term_para])
        text_col = Table(text_parts, colWidths=[13*cm])

        if logo_position == 'left':
            header_data = [[logo_img, text_col]]
        else:
            header_data = [[text_col, logo_img]]

        header_table = Table(header_data, colWidths=[3*cm, 13*cm] if logo_position == 'left' else [13*cm, 3*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(header_table)
    else:
        # Centered layout (logo above name)
        if logo_img:
            logo_img.hAlign = 'CENTER'
            elements.append(logo_img)
            elements.append(Spacer(1, 0.2*cm))
        elements.append(Paragraph(school.name, header_style))
        if motto_para:
            elements.append(motto_para)
        elements.append(Paragraph(f'Student Report Card &mdash; {term} {year}', sub_style))
    elements.append(Spacer(1, 0.4*cm))

    # ── Student info table ──────────────────────────────────────────
    info_data = [
        ['Student Name:', student.user.full_name, 'Student Number:', student.user.student_number or '-'],
        ['Class:', student.student_class.name if student.student_class else '-', 'Gender:', student.gender or '-'],
    ]
    if show_attendance:
        info_data.append(['Admission Date:', str(student.admission_date),
                          'Attendance:', f'{present_count}/{attendance_total} days'])
    if show_class_teacher and student.student_class and student.student_class.class_teacher:
        ct = student.student_class.class_teacher
        info_data.append(['Class Teacher:', ct.full_name, '', ''])

    info_table = Table(info_data, colWidths=[3*cm, 7*cm, 3.5*cm, 5*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0e7ff')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#e0e7ff')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # ── Results table ───────────────────────────────────────────────
    elements.append(Paragraph('Academic Results', styles['Heading2']))

    # ── Aggregate results per subject (combined score, max, %) ────────
    from collections import defaultdict, OrderedDict
    subject_data = OrderedDict()
    for r in results:
        name = r.subject.name
        if name not in subject_data:
            subject_data[name] = {'score': 0, 'max_score': 0}
        subject_data[name]['score'] += r.score
        subject_data[name]['max_score'] += r.max_score

    result_header = ['Subject', 'Score', 'Max Score', '%', 'Grade']
    if show_grade_remark:
        result_header.append('Remark')

    result_rows = [result_header]
    total_pct = 0
    subject_count = 0
    row_colors = []  # for highlight_pass_fail

    for subj_name, data in subject_data.items():
        pct = score_to_percentage(data['score'], data['max_score'])
        gi = percentage_to_grade(pct)
        row = [subj_name, str(round(data['score'], 1)), str(round(data['max_score'], 1)), f'{pct}%', gi['grade']]
        if show_grade_remark:
            row.append(gi['description'])
        result_rows.append(row)
        row_colors.append(gi['colour'])
        total_pct += pct
        subject_count += 1

    if len(result_rows) > 1:
        col_widths = [4.5*cm, 2*cm, 2*cm, 1.8*cm, 1.5*cm]
        if show_grade_remark:
            col_widths.append(3*cm)

        result_table = Table(result_rows, colWidths=col_widths)
        table_style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (-3, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]
        if not highlight_pf:
            table_style_cmds.append(
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, secondary_color])
            )
        result_table.setStyle(TableStyle(table_style_cmds))

        # Per-row colouring for pass/fail highlighting
        if highlight_pf:
            for i, colour_hex in enumerate(row_colors, start=1):
                c = colors.HexColor(colour_hex)
                light = colors.Color(c.red, c.green, c.blue, alpha=0.12)
                result_table.setStyle(TableStyle([('BACKGROUND', (0, i), (-1, i), light)]))

        elements.append(result_table)
        elements.append(Spacer(1, 0.3*cm))

        if show_overall_avg and subject_count > 0:
            avg_pct = round(total_pct / subject_count, 1)
            avg_grade = percentage_to_grade(avg_pct)
            elements.append(Paragraph(
                f'<b>Overall Average:</b> {avg_pct}% &mdash; Grade {avg_grade["grade"]} ({avg_grade["description"]})',
                styles['Normal']
            ))
    else:
        elements.append(Paragraph('No results recorded for this term.', styles['Normal']))

    # ── Conduct section ─────────────────────────────────────────────
    if show_conduct:
        elements.append(Spacer(1, 0.4*cm))
        elements.append(Paragraph('Conduct &amp; Discipline', styles['Heading3']))
        elements.append(Paragraph('___________________________________________________________', styles['Normal']))
        elements.append(Spacer(1, 0.3*cm))

    # ── Activities section ──────────────────────────────────────────
    if show_activities:
        elements.append(Spacer(1, 0.4*cm))
        elements.append(Paragraph('Extra-Curricular Activities', styles['Heading3']))
        elements.append(Paragraph('___________________________________________________________', styles['Normal']))
        elements.append(Spacer(1, 0.3*cm))

    # ── Comments section ────────────────────────────────────────────
    if teacher_comment or principal_comment:
        elements.append(Spacer(1, 0.4*cm))
        comment_style = ParagraphStyle('Comment', parent=styles['Normal'], fontSize=9, spaceAfter=6)
        if teacher_comment:
            elements.append(Paragraph(f"<b>Class Teacher's Comment:</b> {teacher_comment}", comment_style))
        if principal_comment:
            elements.append(Paragraph(f"<b>Head of School's Comment:</b> {principal_comment}", comment_style))

    # ── Next term dates ─────────────────────────────────────────────
    if show_next_term and term != 'Term 3':
        try:
            settings = school.settings
            next_num = {'Term 1': 2, 'Term 2': 3}.get(term)
            if next_num:
                ns = getattr(settings, f'term_{next_num}_start', None)
                ne = getattr(settings, f'term_{next_num}_end', None)
                if ns or ne:
                    elements.append(Spacer(1, 0.3*cm))
                    parts = [f'<b>Next Term (Term {next_num}):</b>']
                    if ns:
                        parts.append(f'Opens {ns.strftime("%d %B %Y")}')
                    if ne:
                        parts.append(f'Closes {ne.strftime("%d %B %Y")}')
                    elements.append(Paragraph(' &mdash; '.join(parts), styles['Normal']))
        except Exception:
            pass

    # ── Grading key ─────────────────────────────────────────────────
    if show_grading_key:
        elements.append(Spacer(1, 0.4*cm))
        elements.append(Paragraph('Grading Key', styles['Heading3']))
        key_data = [
            ['Grade', 'Description', 'Range'],
            ['A', 'Distinction', '70 - 100%'],
            ['B', 'Merit', '60 - 69%'],
            ['C', 'Credit (Pass)', '50 - 59%'],
            ['D', 'Satisfactory', '40 - 49%'],
            ['E', 'Fail', '0 - 39%'],
        ]
        key_table = Table(key_data, colWidths=[2*cm, 3.5*cm, 3*cm])
        key_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(key_table)

    # ── Signature section ───────────────────────────────────────────
    if principal_name:
        elements.append(Spacer(1, 1*cm))
        sig_data = [['', ''], ['_____________________', '_____________________'],
                    ['Class Teacher', f'{principal_name}']]
        if show_class_teacher and student.student_class and student.student_class.class_teacher:
            sig_data[2][0] = student.student_class.class_teacher.full_name
        sig_table = Table(sig_data, colWidths=[9*cm, 9*cm])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(sig_table)

        if cfg and cfg.stamp_image and hasattr(cfg.stamp_image, 'path') and os.path.exists(cfg.stamp_image.path):
            try:
                stamp = Image(cfg.stamp_image.path, width=2*cm, height=2*cm)
                stamp.hAlign = 'RIGHT'
                elements.append(stamp)
            except Exception:
                pass

    # ── Footer ──────────────────────────────────────────────────────
    elements.append(Spacer(1, 0.6*cm))
    footer_parts = [f'Generated on {timezone.now().strftime("%d %B %Y")}', school.name]
    if footer_text:
        footer_parts.append(footer_text)
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8,
                                   textColor=colors.grey, alignment=TA_CENTER)
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
