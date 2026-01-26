from rest_framework import serializers
from .models import (
    Subject, Class, Student, Teacher, Parent, Result, 
    Timetable, Announcement, Complaint, Suspension,
    ParentChildLink, WeeklyMessage, SchoolEvent, Assignment, Attendance, ParentTeacherMessage
)
from users.serializers import UserSerializer
from .utils import generate_unique_student_number
from users.models import CustomUser
from django.db import transaction
from django.utils import timezone

class SubjectSerializer(serializers.ModelSerializer):
    teachers = serializers.SerializerMethodField()
    teacher_names = serializers.SerializerMethodField()
    
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'description', 'teachers', 'teacher_names']
    
    def get_teachers(self, obj):
        teachers = obj.teachers.all()
        return [{'id': t.id, 'name': t.user.get_full_name()} for t in teachers]
    
    def get_teacher_names(self, obj):
        teachers = obj.teachers.all()
        if teachers:
            return ', '.join([t.user.get_full_name() for t in teachers])
        return 'No teacher assigned'


class ClassSerializer(serializers.ModelSerializer):
    class_teacher_name = serializers.CharField(source='class_teacher.full_name', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['id', 'name', 'grade_level', 'academic_year', 'class_teacher', 'class_teacher_name', 'student_count']

    def get_student_count(self, obj):
        return obj.students.count()


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    parent_names = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ['id', 'user', 'student_class', 'class_name', 'admission_date', 'parent_contact', 'address', 'parent_names']

    def get_parent_names(self, obj):
        return [parent.user.full_name for parent in obj.parents.all()]


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    subjects = SubjectSerializer(source='subjects_taught', many=True, read_only=True)
    class_taught = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'subjects', 'hire_date', 'qualification', 'class_taught']

    def get_class_taught(self, obj):
        classes = obj.user.taught_classes.all()
        return [{'id': cls.id, 'name': cls.name} for cls in classes]


class ParentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    children_details = serializers.SerializerMethodField()

    class Meta:
        model = Parent
        fields = ['id', 'user', 'occupation', 'children_details']

    def get_children_details(self, obj):
        return [{
            'id': child.id,
            'name': child.user.full_name,
            'student_number': child.user.student_number,
            'class': child.student_class.name
        } for child in obj.children.all()]


class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    percentage = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            'id', 'student', 'student_name', 'student_number', 'subject', 'subject_name',
            'teacher', 'teacher_name', 'exam_type', 'score', 'max_score', 'percentage',
            'grade', 'date_recorded', 'academic_term', 'academic_year'
        ]

    def get_percentage(self, obj):
        if obj.max_score > 0:
            return round((obj.score / obj.max_score) * 100, 2)
        return 0

    def get_grade(self, obj):
        percentage = self.get_percentage(obj)
        if percentage >= 90: return 'A+'
        elif percentage >= 85: return 'A'
        elif percentage >= 80: return 'A-'
        elif percentage >= 75: return 'B+'
        elif percentage >= 70: return 'B'
        elif percentage >= 65: return 'B-'
        elif percentage >= 60: return 'C+'
        elif percentage >= 55: return 'C'
        elif percentage >= 50: return 'C-'
        elif percentage >= 45: return 'D'
        else: return 'F'


class TimetableSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_assigned.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)

    class Meta:
        model = Timetable
        fields = [
            'id', 'class_assigned', 'class_name', 'subject', 'subject_name',
            'teacher', 'teacher_name', 'day_of_week', 'start_time', 'end_time', 'room'
        ]


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'author', 'author_name', 'target_audience', 'date_posted', 'is_active']


class ComplaintSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id', 'student', 'student_name', 'student_number', 'submitted_by',
            'submitted_by_name', 'title', 'description', 'status',
            'date_submitted', 'date_resolved'
        ]


class SuspensionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)

    class Meta:
        model = Suspension
        fields = [
            'id', 'student', 'student_name', 'student_number', 'teacher',
            'teacher_name', 'reason', 'start_date', 'end_date',
            'is_active', 'date_created'
        ]


class StudentPerformanceSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    student_number = serializers.CharField()
    class_name = serializers.CharField()
    academic_year = serializers.CharField()
    academic_term = serializers.CharField()
    total_subjects = serializers.IntegerField()
    average_score = serializers.FloatField()
    overall_grade = serializers.CharField()
    results = ResultSerializer(many=True)


class CreateResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ['student', 'subject', 'exam_type', 'score', 'max_score', 'academic_term', 'academic_year']

    def create(self, validated_data):
        # Set teacher from request user
        validated_data['teacher'] = self.context['request'].user.teacher
        return super().create(validated_data)


class CreateStudentSerializer(serializers.Serializer):
    user = UserSerializer()
    student_class = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all())
    admission_date = serializers.DateField()
    student_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)
    student_address = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        first_name = user_data['first_name']
        last_name = user_data['last_name']
        password = user_data['password']

        admission_date = validated_data['admission_date']
        student_contact = validated_data.get('student_contact', '')
        student_address = validated_data.get('student_address', '')
        student_class = validated_data['student_class']
        
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        created_by = request.user if request else None

        enrollment_year = str(admission_date.year)[-2:]
        student_number = generate_unique_student_number(enrollment_year)

        user = CustomUser.objects.create_user(
            username=student_number,
            email=f"{student_number}@school.com",
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='student',
            student_number=student_number,
            phone_number=student_contact,
            school=school,
            created_by=created_by
        )

        student = Student.objects.create(
            user=user,
            student_class=student_class,
            admission_date=admission_date,
            parent_contact=student_contact,
            address=student_address
        )

        return student

class CreateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    hire_date = serializers.DateField()
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    assigned_class_id = serializers.IntegerField(required=False, allow_null=True)
    is_secondary_teacher = serializers.BooleanField(default=False)
    
    def validate(self, data):
        # Validate subject assignments for secondary teachers
        if data.get('is_secondary_teacher'):
            subject_ids = data.get('subject_ids', [])
            if len(subject_ids) < 1 or len(subject_ids) > 3:
                raise serializers.ValidationError("Secondary teachers must be assigned 1-3 subjects")
        return data
    
    def create(self, validated_data):
        from users.models import CustomUser
        from django.db import transaction
        from .utils import generate_unique_staff_number
        
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        created_by = request.user if request else None
        
        with transaction.atomic():
            staff_number = generate_unique_staff_number()
            
            user = CustomUser.objects.create_user(
                username=staff_number,
                email=validated_data['email'],
                password=validated_data['password'],
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                role='teacher',
                student_number=staff_number,
                phone_number=validated_data.get('phone_number', ''),
                school=school,
                created_by=created_by
            )
            
            teacher = Teacher.objects.create(
                user=user,
                hire_date=validated_data['hire_date'],
                qualification=validated_data.get('qualification', '')
            )
            
            if validated_data.get('subject_ids'):
                teacher.subjects_taught.set(validated_data['subject_ids'])
            
            if validated_data.get('assigned_class_id'):
                assigned_class = Class.objects.get(id=validated_data['assigned_class_id'])
                assigned_class.class_teacher = user
                assigned_class.save()
            
            return {
                'id': teacher.id,
                'staff_number': staff_number,
                'password': validated_data['password'],
                'full_name': full_name,
                'email': validated_data['email']
            }


class CreateParentSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    contact_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    address = serializers.CharField(required=False, allow_blank=True)
    occupation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    student_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    
    def create(self, validated_data):
        from users.models import CustomUser
        from django.db import transaction
        import random
        
        with transaction.atomic():
            # Generate username from email or random
            username = validated_data['email'].split('@')[0] + str(random.randint(100, 999))
            
            # Create user account
            user = CustomUser.objects.create_user(
                username=username,
                email=validated_data['email'],
                password=validated_data['password'],
                full_name=validated_data['full_name'],
                role='parent',
                phone_number=validated_data['contact_number']
            )
            
            # Create parent profile
            parent = Parent.objects.create(
                user=user,
                occupation=validated_data.get('occupation', '')
            )
            
            # Link to students if provided
            if validated_data.get('student_ids'):
                students = Student.objects.filter(id__in=validated_data['student_ids'])
                parent.children.set(students)
            
            return {
                'id': parent.id,
                'username': username,
                'password': validated_data['password'],
                'full_name': validated_data['full_name'],
                'email': validated_data['email'],
                'contact_number': validated_data['contact_number']
            }


class ParentChildLinkSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.first_name', read_only=True)
    student_surname = serializers.CharField(source='student.user.last_name', read_only=True)
    student_class = serializers.CharField(source='student.student_class.name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    
    class Meta:
        model = ParentChildLink
        fields = ['id', 'parent', 'student', 'student_name', 'student_surname', 
                  'student_class', 'student_number', 'is_confirmed', 'linked_date', 'confirmed_date']
        read_only_fields = ['linked_date', 'confirmed_date']


class WeeklyMessageSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.first_name', read_only=True)
    teacher_surname = serializers.CharField(source='teacher.user.last_name', read_only=True)
    
    class Meta:
        model = WeeklyMessage
        fields = '__all__'


class SchoolEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.first_name', read_only=True)
    type = serializers.CharField(source='event_type', read_only=True)
    
    class Meta:
        model = SchoolEvent
        fields = ['id', 'title', 'description', 'event_type', 'type', 'start_date', 
                  'end_date', 'location', 'created_by', 'created_by_name', 'date_created']


class AssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.first_name', read_only=True)
    class_name = serializers.CharField(source='assigned_class.name', read_only=True)
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = Assignment
        fields = ['id', 'title', 'description', 'subject', 'subject_name', 'teacher', 
                  'teacher_name', 'assigned_class', 'class_name', 'deadline', 'date_created', 'status']
    
    def get_status(self, obj):
        from datetime import datetime
        now = timezone.now()
        if obj.deadline < now:
            return 'overdue'
        return 'pending'


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.first_name', read_only=True)
    student_surname = serializers.CharField(source='student.user.last_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.first_name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = ['id', 'student', 'student_name', 'student_surname', 'date', 'status', 
                  'remarks', 'recorded_by', 'recorded_by_name', 'date_recorded']

class ParentTeacherMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ParentTeacherMessage
        fields = ['id', 'sender', 'sender_name', 'recipient', 'recipient_name', 
                  'subject', 'message', 'student', 'student_name', 'parent_message', 
                  'is_read', 'date_sent']
        read_only_fields = ['sender', 'date_sent']
    
    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}"
    
    def get_recipient_name(self, obj):
        return f"{obj.recipient.first_name} {obj.recipient.last_name}"
    
    def get_student_name(self, obj):
        if obj.student:
            return f"{obj.student.user.first_name} {obj.student.user.last_name}"
        return None
