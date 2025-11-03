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


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


# Class Views
class ClassListCreateView(generics.ListCreateAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Class.objects.all()
        level_type = self.request.query_params.get('level', None)
        if level_type == 'primary':
            queryset = queryset.filter(grade_level__lte=7)
        elif level_type == 'secondary':
            queryset = queryset.filter(grade_level__gt=7)
        return queryset


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]


# Student Views
class StudentListView(generics.ListCreateAPIView):
    queryset = Student.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateStudentSerializer
        return StudentSerializer

    def get_queryset(self):
        queryset = Student.objects.all()
        class_id = self.request.query_params.get('class', None)
        if class_id:
            queryset = queryset.filter(student_class_id=class_id)

        for student in queryset:
            print(f"Class Name: {student.student_class.name if student.student_class else 'No Class'}")

        return queryset


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_performance_view(request, student_id):
    try:
        student = Student.objects.get(id=student_id)
        
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


# Parent Views
class ParentListView(generics.ListCreateAPIView):
    queryset = Parent.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateParentSerializer
        return ParentSerializer


# Result Views
class ResultListCreateView(generics.ListCreateAPIView):
    queryset = Result.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateResultSerializer
        return ResultSerializer

    def get_queryset(self):
        queryset = Result.objects.all()
        
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
        queryset = Result.objects.all()
        if self.request.user.role == 'teacher':
            queryset = queryset.filter(teacher__user=self.request.user)
        return queryset


# Timetable Views
class TimetableListView(generics.ListAPIView):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Timetable.objects.all()
        
        if self.request.user.role == 'student':
            queryset = queryset.filter(class_assigned=self.request.user.student.student_class)
        elif self.request.user.role == 'teacher':
            queryset = queryset.filter(teacher__user=self.request.user)
        elif self.request.user.role == 'parent':
            children_classes = self.request.user.parent.children.values_list('student_class', flat=True)
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
        queryset = Announcement.objects.filter(is_active=True)
        user_role = self.request.user.role
        
        # Filter by target audience
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
        queryset = Complaint.objects.all()
        
        if self.request.user.role == 'student':
            queryset = queryset.filter(student__user=self.request.user)
        elif self.request.user.role == 'parent':
            children_ids = self.request.user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        elif self.request.user.role == 'teacher':
            queryset = queryset.filter(submitted_by=self.request.user)
        
        return queryset.order_by('-date_submitted')

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]


# Suspension Views
class SuspensionListCreateView(generics.ListCreateAPIView):
    queryset = Suspension.objects.all()
    serializer_class = SuspensionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Suspension.objects.all()
        
        if self.request.user.role == 'student':
            queryset = queryset.filter(student__user=self.request.user)
        elif self.request.user.role == 'parent':
            children_ids = self.request.user.parent.children.values_list('id', flat=True)
            queryset = queryset.filter(student_id__in=children_ids)
        elif self.request.user.role == 'teacher':
            queryset = queryset.filter(teacher__user=self.request.user)
        
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
    """Get all pending parent-child link requests (Admin/Teacher only)"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can view pending requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    pending_links = ParentChildLink.objects.filter(
        is_confirmed=False
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
            'student_class': link.student.student_class.name if link.student.student_class else 'Not Assigned',
            'requested_date': link.created_at,
        })
    
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def approve_parent_link_request(request, link_id):
    """Approve a parent-child link request (Admin/Teacher only)"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can approve requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    try:
        link = ParentChildLink.objects.select_related(
            'parent__user', 'student__user'
        ).get(id=link_id, is_confirmed=False)
        
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
    """Decline/delete a parent-child link request (Admin/Teacher only)"""
    if request.user.role not in ['admin', 'teacher']:
        return Response({'error': 'Only administrators and teachers can decline requests'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    from .models import ParentChildLink
    
    try:
        link = ParentChildLink.objects.get(id=link_id, is_confirmed=False)
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