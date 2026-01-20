from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from .models import Homework, Teacher, Student, Subject, Class, Parent, ParentChildLink
import os


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_homework_list(request):
    """Get all homework created by the logged-in teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        homework_items = Homework.objects.filter(teacher=teacher).select_related(
            'subject', 'assigned_class'
        )
        
        data = []
        for hw in homework_items:
            data.append({
                'id': hw.id,
                'title': hw.title,
                'subject': {
                    'id': hw.subject.id,
                    'name': hw.subject.name,
                    'code': hw.subject.code
                },
                'assigned_class': {
                    'id': hw.assigned_class.id,
                    'name': hw.assigned_class.name
                },
                'description': hw.description,
                'has_file': bool(hw.file),
                'file_name': os.path.basename(hw.file.name) if hw.file else None,
                'due_date': hw.due_date.isoformat() if hw.due_date else None,
                'date_created': hw.date_created.isoformat()
            })
        
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def teacher_create_homework(request):
    """Create homework - with file upload or manual text"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        
        subject_id = request.data.get('subject_id')
        class_id = request.data.get('class_id')
        title = request.data.get('title')
        description = request.data.get('description', '')
        due_date = request.data.get('due_date')
        file = request.FILES.get('file')
        
        if not subject_id or not class_id or not title or not due_date:
            return Response({
                'error': 'Subject, class, title, and due date are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        subject = get_object_or_404(Subject, id=subject_id)
        assigned_class = get_object_or_404(Class, id=class_id)
        
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        if file:
            ext = os.path.splitext(file.name)[1].lower()
            allowed_extensions = ['.pdf', '.doc', '.docx']
            if ext not in allowed_extensions:
                return Response({
                    'error': f'Invalid file type. Only PDF and Word documents are allowed.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if file.size > 10 * 1024 * 1024:
                return Response({
                    'error': 'File too large. Maximum size is 10MB.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        homework = Homework.objects.create(
            title=title,
            subject=subject,
            teacher=teacher,
            assigned_class=assigned_class,
            description=description,
            due_date=due_date,
            file=file
        )
        
        return Response({
            'message': 'Homework created successfully',
            'id': homework.id,
            'title': f'{subject.name} Homework - {title}'
        }, status=status.HTTP_201_CREATED)
        
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def teacher_delete_homework(request, homework_id):
    """Delete homework created by the teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        homework = get_object_or_404(Homework, id=homework_id, teacher=teacher)
        
        if homework.file:
            homework.file.delete()
        
        homework.delete()
        return Response({'message': 'Homework deleted successfully'})
        
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_homework_list(request):
    """Get all homework for the parent's confirmed children"""
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        parent = request.user.parent
        confirmed_links = ParentChildLink.objects.filter(
            parent=parent,
            is_confirmed=True
        ).select_related('student__student_class')
        
        if not confirmed_links.exists():
            return Response([])
        
        class_ids = [link.student.student_class.id for link in confirmed_links if link.student.student_class]
        
        homework_items = Homework.objects.filter(
            assigned_class_id__in=class_ids
        ).select_related('subject', 'assigned_class', 'teacher__user').order_by('-date_created')
        
        data = []
        for hw in homework_items:
            children_in_class = [
                {
                    'id': link.student.id,
                    'name': f"{link.student.user.first_name} {link.student.user.last_name}"
                }
                for link in confirmed_links
                if link.student.student_class and link.student.student_class.id == hw.assigned_class.id
            ]
            
            data.append({
                'id': hw.id,
                'title': f"{hw.subject.name} Homework",
                'homework_title': hw.title,
                'subject': {
                    'id': hw.subject.id,
                    'name': hw.subject.name,
                    'code': hw.subject.code
                },
                'assigned_class': {
                    'id': hw.assigned_class.id,
                    'name': hw.assigned_class.name
                },
                'teacher': {
                    'name': f"{hw.teacher.user.first_name} {hw.teacher.user.last_name}"
                },
                'description': hw.description,
                'has_file': bool(hw.file),
                'file_name': os.path.basename(hw.file.name) if hw.file else None,
                'due_date': hw.due_date.isoformat() if hw.due_date else None,
                'date_created': hw.date_created.isoformat(),
                'children': children_in_class
            })
        
        return Response(data)
        
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_homework_file(request, homework_id):
    """Download homework file"""
    homework = get_object_or_404(Homework, id=homework_id)
    
    if request.user.role == 'teacher':
        try:
            teacher = request.user.teacher
            if homework.teacher.id != teacher.id:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        except Teacher.DoesNotExist:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    elif request.user.role == 'parent':
        try:
            parent = request.user.parent
            confirmed_links = ParentChildLink.objects.filter(
                parent=parent,
                is_confirmed=True
            ).select_related('student__student_class')
            
            class_ids = [link.student.student_class.id for link in confirmed_links if link.student.student_class]
            
            if homework.assigned_class.id not in class_ids:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        except Parent.DoesNotExist:
            return Response({'error': 'Parent profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    elif request.user.role == 'student':
        try:
            student = request.user.student
            if homework.assigned_class.id != student.student_class.id:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
    
    if not homework.file:
        return Response({'error': 'No file attached to this homework'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    try:
        file_path = homework.file.path
        file_name = os.path.basename(homework.file.name)
        response = FileResponse(open(file_path, 'rb'))
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'
        return response
    except Exception as e:
        return Response({'error': f'Error downloading file: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_classes_for_homework(request):
    """Get classes where teacher teaches (for homework assignment)"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        
        class_ids = set()
        
        classes_from_timetable = Class.objects.filter(
            timetable__teacher=teacher
        ).values_list('id', flat=True)
        class_ids.update(classes_from_timetable)
        
        classes_from_results = Class.objects.filter(
            students__results__teacher=teacher
        ).values_list('id', flat=True)
        class_ids.update(classes_from_results)
        
        class_teacher_classes = Class.objects.filter(
            class_teacher=teacher.user
        ).values_list('id', flat=True)
        class_ids.update(class_teacher_classes)
        
        all_classes = Class.objects.filter(id__in=class_ids)
        
        data = [{'id': c.id, 'name': c.name, 'grade_level': c.grade_level} for c in all_classes]
        return Response(data)
        
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_homework_list(request):
    """Get all homework for the student's class"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        student_class = student.student_class
        
        if not student_class:
            return Response([])
        
        homework_items = Homework.objects.filter(
            assigned_class=student_class
        ).select_related('subject', 'assigned_class', 'teacher__user').order_by('-date_created')
        
        data = []
        for hw in homework_items:
            data.append({
                'id': hw.id,
                'title': f"{hw.subject.name} Homework",
                'homework_title': hw.title,
                'subject': {
                    'id': hw.subject.id,
                    'name': hw.subject.name,
                    'code': hw.subject.code
                },
                'class_name': hw.assigned_class.name,
                'teacher_name': f"{hw.teacher.user.first_name} {hw.teacher.user.last_name}",
                'description': hw.description,
                'has_file': bool(hw.file),
                'file_name': os.path.basename(hw.file.name) if hw.file else None,
                'due_date': hw.due_date.isoformat() if hw.due_date else None,
                'date_created': hw.date_created.isoformat()
            })
        
        return Response(data)
        
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_download_homework_file(request, homework_id):
    """Download homework file for student"""
    if request.user.role != 'student':
        return Response({'error': 'Only students can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        student = request.user.student
        homework = get_object_or_404(Homework, id=homework_id)
        
        if homework.assigned_class != student.student_class:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if not homework.file:
            return Response({'error': 'No file attached to this homework'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        file_path = homework.file.path
        file_name = os.path.basename(homework.file.name)
        response = FileResponse(open(file_path, 'rb'))
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'
        return response
        
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': f'Error downloading file: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)
