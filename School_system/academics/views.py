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
            ).select_related('author')
        else:
            queryset = Announcement.objects.none()
        user_role = user.role

        queryset = queryset.filter(
            Q(target_audience='all') | Q(target_audience=user_role)
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
        link.confirmed_by = request.user
        link.confirmed_at = timezone.now()
        link.save()

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
    """
    from django.http import HttpResponse
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from io import BytesIO

    if request.user.role not in ('admin', 'teacher', 'parent'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = request.user.school
    year = request.query_params.get('year', '')
    term = request.query_params.get('term', '')

    try:
        student = Student.objects.select_related('user', 'student_class').get(id=student_id, user__school=school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    results = Result.objects.filter(
        student=student, academic_year=year, academic_term=term
    ).select_related('subject').order_by('subject__name')

    attendance = student.attendance_records.filter(
        date__isnull=False
    ).count()
    present_count = student.attendance_records.filter(status='present').count()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Header
    header_style = ParagraphStyle('Header', parent=styles['Title'], fontSize=18, spaceAfter=6)
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=11, spaceAfter=4)

    elements.append(Paragraph(school.name, header_style))
    elements.append(Paragraph(f'Student Report Card — {term} {year}', sub_style))
    elements.append(Spacer(1, 0.5*cm))

    # Student info table
    info_data = [
        ['Student Name:', student.user.full_name, 'Student Number:', student.user.student_number or '-'],
        ['Class:', student.student_class.name if student.student_class else '-', 'Gender:', student.gender or '-'],
        ['Admission Date:', str(student.admission_date), 'Attendance:', f'{present_count}/{attendance} days'],
    ]
    info_table = Table(info_data, colWidths=[3*cm, 7*cm, 3.5*cm, 5*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
        ('BACKGROUND', (2, 0), (2, -1), colors.lightblue),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Results table
    elements.append(Paragraph('Academic Results', styles['Heading2']))
    result_header = ['Subject', 'Exam Type', 'Score', 'Max Score', 'Percentage', 'Grade']
    result_rows = [result_header]

    for r in results:
        pct = round((r.score / r.max_score) * 100, 1) if r.max_score else 0
        if pct >= 80: grade = 'A'
        elif pct >= 70: grade = 'B'
        elif pct >= 60: grade = 'C'
        elif pct >= 50: grade = 'D'
        else: grade = 'F'
        result_rows.append([r.subject.name, r.exam_type, str(r.score), str(r.max_score), f'{pct}%', grade])

    if len(result_rows) > 1:
        result_table = Table(result_rows, colWidths=[5*cm, 3*cm, 2*cm, 2.5*cm, 3*cm, 2*cm])
        result_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1d4ed8')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(result_table)
    else:
        elements.append(Paragraph('No results recorded for this term.', styles['Normal']))

    # Footer
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(f'Generated on {timezone.now().strftime("%d %B %Y")} | {school.name}', styles['Normal']))

    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="report_card_{student.user.student_number}_{term}_{year}.pdf"'
    )
    return response


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
