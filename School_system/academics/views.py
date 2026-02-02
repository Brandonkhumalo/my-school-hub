from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Avg, Count, Q
from django.utils import timezone
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
            return Subject.objects.filter(school=user.school)
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
            return Subject.objects.filter(school=user.school)
        return Subject.objects.none()


# Class Views
class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Class.objects.filter(school=user.school)
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
            return Class.objects.filter(school=user.school)
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
            queryset = Student.objects.filter(user__school=user.school)
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
            return Student.objects.filter(user__school=user.school)
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
        
        # Determine overall grade
        overall_grade = 'F'
        if average_percentage >= 90: overall_grade = 'A+'
        elif average_percentage >= 85: overall_grade = 'A'
        elif average_percentage >= 80: overall_grade = 'A-'
        elif average_percentage >= 75: overall_grade = 'B+'
        elif average_percentage >= 70: overall_grade = 'B'
        elif average_percentage >= 65: overall_grade = 'B-'
        elif average_percentage >= 60: overall_grade = 'C+'
        elif average_percentage >= 55: overall_grade = 'C'
        elif average_percentage >= 50: overall_grade = 'C-'
        elif average_percentage >= 45: overall_grade = 'D'
        
        performance_data = {
            'student_id': student.id,
            'student_name': student.user.full_name,
            'student_number': student.user.student_number,
            'class_name': student.student_class.name,
            'academic_year': academic_year or 'All Years',
            'academic_term': academic_term or 'All Terms',
            'total_subjects': results.values('subject').distinct().count(),
            'average_score': round(average_percentage, 2),
            'overall_grade': overall_grade,
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
            return Teacher.objects.filter(user__school=user.school)
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
                Q(user__school=user.school) | 
                Q(children__user__school=user.school)
            ).distinct()
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
            queryset = Result.objects.filter(student__user__school=user.school)
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


class ResultDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Result.objects.filter(student__user__school=user.school)
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
            queryset = Timetable.objects.filter(class_assigned__school=user.school)
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
            queryset = Announcement.objects.filter(is_active=True, author__school=user.school)
        else:
            queryset = Announcement.objects.none()
        user_role = user.role
        
        queryset = queryset.filter(
            Q(target_audience='all') | Q(target_audience=user_role)
        )
        
        return queryset.order_by('-date_posted')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# Complaint Views
class ComplaintListCreateView(generics.ListCreateAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.school:
            queryset = Complaint.objects.filter(student__user__school=user.school)
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
            queryset = Suspension.objects.filter(student__user__school=user.school)
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
        
        return Response({
            'message': 'Parent-child link approved successfully',
            'parent_name': f"{link.parent.user.first_name} {link.parent.user.last_name}",
            'student_name': f"{link.student.user.first_name} {link.student.user.last_name}",
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
            
        # Calculate grade
        if percentage >= 90: grade = 'A+'
        elif percentage >= 85: grade = 'A'
        elif percentage >= 80: grade = 'A-'
        elif percentage >= 75: grade = 'B+'
        elif percentage >= 70: grade = 'B'
        elif percentage >= 65: grade = 'B-'
        elif percentage >= 60: grade = 'C+'
        elif percentage >= 55: grade = 'C'
        elif percentage >= 50: grade = 'C-'
        elif percentage >= 45: grade = 'D'
        else: grade = 'F'
        
        results.append({
            'class_name': avg['class_name'],
            'subject_name': avg['subject_name'],
            'exam_type': avg['exam_type'],
            'average_score': round(avg['average_score'], 2),
            'average_max_score': round(avg['average_max_score'], 2),
            'percentage': percentage,
            'grade': grade,
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
