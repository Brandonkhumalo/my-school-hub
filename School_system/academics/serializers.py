from rest_framework import serializers
from .models import (
    Subject, Class, Student, Teacher, Parent, Result,
    Timetable, Announcement, Complaint, Suspension,
    ParentChildLink, WeeklyMessage, SchoolEvent, Assignment, ClassAttendance, SubjectAttendance, ParentTeacherMessage,
    Homework, AssignmentSubmission
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
        fields = ['id', 'name', 'code', 'description', 'is_priority', 'teachers', 'teacher_names']
    
    def get_teachers(self, obj):
        # prefetch_related('teachers__user') in the view makes this a single query
        return [{'id': t.id, 'name': t.user.get_full_name()} for t in obj.teachers.all()]

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
        fields = [
            'id', 'name', 'grade_level', 'academic_year', 'class_teacher', 'class_teacher_name', 'student_count',
            'first_period_start', 'last_period_end', 'period_duration_minutes',
            'break_start', 'break_end', 'lunch_start', 'lunch_end',
            'friday_last_period_end', 'include_transition_time'
        ]

    def get_student_count(self, obj):
        # If the view annotated the queryset with student_count, use that value.
        # Otherwise fall back to a direct count (single-object detail views).
        if hasattr(obj, '_student_count'):
            return obj._student_count
        return obj.students.count()


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    parent_names = serializers.SerializerMethodField()
    parent_phone = serializers.SerializerMethodField()
    parent_email = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_class', 'class_name', 'admission_date', 
            'parent_contact', 'address', 'parent_names', 'date_of_birth', 
            'gender', 'emergency_contact', 'parent_phone', 'parent_email'
        ]

    def get_parent_names(self, obj):
        return [parent.user.full_name for parent in obj.parents.all()]

    def get_parent_phone(self, obj):
        parent = obj.parents.first()
        if parent:
            return parent.user.phone_number
        return obj.parent_contact

    def get_parent_email(self, obj):
        parent = obj.parents.first()
        if parent:
            return parent.user.email
        return None


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

    effective_term = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            'id', 'student', 'student_name', 'student_number', 'subject', 'subject_name',
            'teacher', 'teacher_name', 'exam_type', 'score', 'max_score', 'percentage',
            'grade', 'date_recorded', 'academic_term', 'academic_year',
            'include_in_report', 'report_term', 'effective_term'
        ]

    def get_effective_term(self, obj):
        return obj.report_term if obj.report_term else obj.academic_term

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
    class_name = serializers.CharField(source='target_class.name', read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'author', 'author_name', 'target_audience',
                  'target_class', 'class_name', 'date_posted', 'is_active']
        read_only_fields = ['author', 'author_name', 'class_name', 'date_posted']


class ComplaintSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_number = serializers.SerializerMethodField()
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id', 'student', 'student_name', 'student_number', 'submitted_by',
            'submitted_by_name', 'complaint_type', 'title', 'description', 'status',
            'date_submitted', 'date_resolved'
        ]
        read_only_fields = ['submitted_by', 'student_name', 'student_number', 'submitted_by_name', 'date_submitted', 'date_resolved']

    def get_student_name(self, obj):
        if obj.student and obj.student.user:
            return obj.student.user.full_name
        return None

    def get_student_number(self, obj):
        if obj.student and obj.student.user:
            return obj.student.user.student_number
        return None


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
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=Teacher.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Result
        fields = ['student', 'subject', 'teacher', 'exam_type', 'score', 'max_score', 'academic_term', 'academic_year', 'include_in_report', 'report_term']

    def create(self, validated_data):
        user = self.context['request'].user
        if 'teacher' not in validated_data or validated_data.get('teacher') is None:
            # Fall back to the authenticated user's teacher profile
            validated_data['teacher'] = user.teacher
        return super().create(validated_data)


class CreateStudentSerializer(serializers.Serializer):
    user = UserSerializer()
    student_class = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all())
    admission_date = serializers.DateField()
    student_email = serializers.EmailField(required=False, allow_blank=True)
    student_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)
    student_address = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    emergency_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, data):
        phone = data.get('student_contact', '').strip()
        if phone and CustomUser.objects.filter(phone_number=phone).exists():
            raise serializers.ValidationError({"student_contact": "This phone number is already registered to another user."})
        
        user_data = data.get('user', {})
        email = data.get('student_email', '').strip()
        if email and CustomUser.objects.filter(email=email).exists():
            raise serializers.ValidationError({"student_email": "This email is already registered to another user."})
            
        return data

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        first_name = user_data['first_name']
        last_name = user_data['last_name']
        password = user_data['password']

        admission_date = validated_data['admission_date']
        student_email = validated_data.get('student_email', '')
        student_contact = validated_data.get('student_contact', '')
        student_address = validated_data.get('student_address', '')
        date_of_birth = validated_data.get('date_of_birth')
        gender = validated_data.get('gender', '')
        emergency_contact = validated_data.get('emergency_contact', '')
        student_class = validated_data['student_class']
        
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        created_by = request.user if request else None

        enrollment_year = str(admission_date.year)[-2:]
        student_number = generate_unique_student_number(enrollment_year)

        email = student_email if student_email else f"{student_number}@school.com"

        user = CustomUser.objects.create_user(
            username=student_number,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='student',
            student_number=student_number,
            phone_number=student_contact if student_contact else None,
            school=school,
            created_by=created_by
        )

        student = Student.objects.create(
            user=user,
            student_class=student_class,
            admission_date=admission_date,
            parent_contact=student_contact,
            address=student_address,
            date_of_birth=date_of_birth,
            gender=gender,
            emergency_contact=emergency_contact or student_contact
        )

        return student

class CreateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    hire_date = serializers.DateField()
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    assigned_class_id = serializers.IntegerField(required=False, allow_null=True)
    is_secondary_teacher = serializers.BooleanField(default=False)
    staff_number = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    id = serializers.IntegerField(read_only=True)
    
    def validate(self, data):
        from users.models import CustomUser
        
        # Check for duplicate phone number
        phone = data.get('phone_number', '').strip()
        if phone:
            if CustomUser.objects.filter(phone_number=phone).exists():
                raise serializers.ValidationError({"phone_number": "This phone number is already registered"})
        
        # Check for duplicate email
        email = data.get('email', '').strip()
        if CustomUser.objects.filter(email=email).exists():
            raise serializers.ValidationError({"email": "This email is already registered"})
        
        # Validate subject assignments for secondary teachers
        if data.get('is_secondary_teacher'):
            subject_ids = data.get('subject_ids', [])
            if len(subject_ids) < 1 or len(subject_ids) > 3:
                raise serializers.ValidationError("Secondary teachers must be assigned 1-3 subjects")

        # Validate assigned class ownership and enforce one class teacher per class
        assigned_class_id = data.get('assigned_class_id')
        if assigned_class_id:
            try:
                assigned_class = Class.objects.select_related('class_teacher').get(id=assigned_class_id)
            except Class.DoesNotExist:
                raise serializers.ValidationError({"assigned_class_id": "Selected class does not exist"})

            request = self.context.get('request')
            school = request.user.school if request and hasattr(request.user, 'school') else None
            if school and assigned_class.school_id != school.id:
                raise serializers.ValidationError({"assigned_class_id": "You can only assign classes from your school"})

            if assigned_class.class_teacher_id:
                teacher_name = assigned_class.class_teacher.full_name if assigned_class.class_teacher else "another teacher"
                raise serializers.ValidationError(
                    {"assigned_class_id": f"This class is already assigned to {teacher_name}"}
                )

            data['assigned_class_obj'] = assigned_class
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
            
            phone = validated_data.get('phone_number', '').strip()
            user = CustomUser.objects.create_user(
                username=staff_number,
                email=validated_data['email'],
                password=validated_data['password'],
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                role='teacher',
                student_number=staff_number,
                phone_number=phone if phone else None,
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

            assigned_class = validated_data.pop('assigned_class_obj', None)
            if not assigned_class and validated_data.get('assigned_class_id'):
                assigned_class = Class.objects.get(id=validated_data['assigned_class_id'])

            if assigned_class:
                assigned_class.class_teacher = user
                assigned_class.save(update_fields=['class_teacher'])
            
            return {
                'id': teacher.id,
                'staff_number': staff_number,
                'password': validated_data['password'],
                'first_name': validated_data['first_name'],
                'last_name': validated_data['last_name'],
                'full_name': f"{validated_data['first_name']} {validated_data['last_name']}",
                'email': validated_data['email'],
                'phone_number': phone if phone else '',
                'hire_date': str(validated_data['hire_date']),
                'qualification': validated_data.get('qualification', ''),
                'subject_ids': validated_data.get('subject_ids', []),
                'assigned_class_id': validated_data.get('assigned_class_id'),
                'is_secondary_teacher': validated_data.get('is_secondary_teacher', False)
            }


class CreateParentSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, write_only=True)
    contact_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    address = serializers.CharField(required=False, allow_blank=True)
    occupation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    student_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)

    def validate(self, data):
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        student_ids = data.get('student_ids', [])

        if student_ids:
            students = Student.objects.filter(id__in=student_ids).select_related('user')
            if school:
                students = students.filter(user__school=school)

            found_ids = {s.id for s in students}
            missing = [sid for sid in student_ids if sid not in found_ids]
            if missing:
                raise serializers.ValidationError({
                    "student_ids": f"Some selected students are invalid for your school: {missing}"
                })

            over_limit = []
            for student in students:
                current_parent_count = Parent.objects.filter(children=student).count()
                if current_parent_count >= 2:
                    over_limit.append(
                        f"{student.user.full_name} ({student.user.student_number or student.id})"
                    )
            if over_limit:
                raise serializers.ValidationError({
                    "student_ids": (
                        "These students already have the maximum of 2 parents linked: "
                        + ", ".join(over_limit)
                    )
                })

        return data
    
    def create(self, validated_data):
        from users.models import CustomUser
        from django.db import transaction
        import random
        
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        created_by = request.user if request else None

        with transaction.atomic():
            # Generate username from email or random
            username = validated_data['email'].split('@')[0] + str(random.randint(100, 999))
            
            # Split full_name into first_name and last_name
            name_parts = validated_data['full_name'].split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            # Create user account
            user = CustomUser.objects.create_user(
                username=username,
                email=validated_data['email'],
                password=validated_data['password'],
                first_name=first_name,
                last_name=last_name,
                role='parent',
                phone_number=validated_data['contact_number'] if validated_data['contact_number'] else None,
                school=school,
                created_by=created_by
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

                # Keep ParentChildLink in sync for admin-created links
                for student in students:
                    link, created = ParentChildLink.objects.get_or_create(
                        parent=parent,
                        student=student,
                        defaults={'is_confirmed': True, 'confirmed_date': timezone.now()}
                    )
                    if not created and not link.is_confirmed:
                        link.is_confirmed = True
                        link.confirmed_date = timezone.now()
                        link.save(update_fields=['is_confirmed', 'confirmed_date'])

                    if student.user.school:
                        parent.schools.add(student.user.school)
            
            return {
                'id': parent.id,
                'username': username,
                'password': validated_data['password'],
                'full_name': validated_data['full_name'],
                'email': validated_data['email'],
                'contact_number': validated_data['contact_number']
            }


class UpdateStudentSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, required=False, allow_blank=True)

    student_class = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), required=False)
    admission_date = serializers.DateField(required=False)
    parent_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    emergency_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, data):
        instance = self.instance
        email = data.get('email')
        phone = data.get('phone_number')

        if email and CustomUser.objects.filter(email=email).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"email": "This email is already registered"})
        if phone and CustomUser.objects.filter(phone_number=phone).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"phone_number": "This phone number is already registered"})

        student_class = data.get('student_class')
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        if student_class and school and student_class.school_id != school.id:
            raise serializers.ValidationError({"student_class": "Invalid class for your school"})

        return data

    def update(self, instance, validated_data):
        user = instance.user

        for field in ['first_name', 'last_name', 'email', 'phone_number']:
            if field in validated_data:
                setattr(user, field, validated_data[field] or '')

        password = validated_data.get('password')
        if password:
            user.set_password(password)
        user.save()

        for field in ['student_class', 'admission_date', 'parent_contact', 'address', 'date_of_birth', 'gender', 'emergency_contact']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class UpdateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, required=False, allow_blank=True)
    hire_date = serializers.DateField(required=False)
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    assigned_class_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        instance = self.instance
        email = data.get('email')
        phone = data.get('phone_number')
        if email and CustomUser.objects.filter(email=email).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"email": "This email is already registered"})
        if phone and CustomUser.objects.filter(phone_number=phone).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"phone_number": "This phone number is already registered"})

        if 'subject_ids' in data:
            subject_ids = data.get('subject_ids', [])
            if len(subject_ids) > 3:
                raise serializers.ValidationError({"subject_ids": "Maximum 3 subjects allowed"})

        assigned_class_id = data.get('assigned_class_id', None)
        if assigned_class_id:
            try:
                assigned_class = Class.objects.select_related('class_teacher').get(id=assigned_class_id)
            except Class.DoesNotExist:
                raise serializers.ValidationError({"assigned_class_id": "Selected class does not exist"})

            request = self.context.get('request')
            school = request.user.school if request and hasattr(request.user, 'school') else None
            if school and assigned_class.school_id != school.id:
                raise serializers.ValidationError({"assigned_class_id": "You can only assign classes from your school"})

            if assigned_class.class_teacher_id and assigned_class.class_teacher_id != instance.user_id:
                raise serializers.ValidationError({
                    "assigned_class_id": f"This class is already assigned to {assigned_class.class_teacher.full_name}"
                })
            data['assigned_class_obj'] = assigned_class
        return data

    def update(self, instance, validated_data):
        user = instance.user
        for field in ['first_name', 'last_name', 'email', 'phone_number']:
            if field in validated_data:
                setattr(user, field, validated_data[field] or '')

        password = validated_data.get('password')
        if password:
            user.set_password(password)
        user.save()

        if 'hire_date' in validated_data:
            instance.hire_date = validated_data['hire_date']
        if 'qualification' in validated_data:
            instance.qualification = validated_data['qualification']
        instance.save()

        if 'subject_ids' in validated_data:
            instance.subjects_taught.set(validated_data.get('subject_ids', []))

        # Manage class responsibility: one class teacher slot per teacher in this flow
        if 'assigned_class_id' in validated_data:
            selected_class = validated_data.get('assigned_class_obj')
            Class.objects.filter(class_teacher=user).update(class_teacher=None)
            if selected_class:
                selected_class.class_teacher = user
                selected_class.save(update_fields=['class_teacher'])

        return instance


class UpdateParentSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    occupation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, required=False, allow_blank=True)
    student_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)

    def validate(self, data):
        instance = self.instance
        email = data.get('email')
        phone = data.get('contact_number')
        if email and CustomUser.objects.filter(email=email).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"email": "This email is already registered"})
        if phone and CustomUser.objects.filter(phone_number=phone).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"contact_number": "This phone number is already registered"})

        student_ids = data.get('student_ids')
        if student_ids is not None:
            request = self.context.get('request')
            school = request.user.school if request and hasattr(request.user, 'school') else None
            students = Student.objects.filter(id__in=student_ids).select_related('user')
            if school:
                students = students.filter(user__school=school)

            found_ids = {s.id for s in students}
            missing = [sid for sid in student_ids if sid not in found_ids]
            if missing:
                raise serializers.ValidationError({
                    "student_ids": f"Some selected students are invalid for your school: {missing}"
                })

            over_limit = []
            for student in students:
                current_parent_count = Parent.objects.filter(children=student).exclude(id=instance.id).count()
                if current_parent_count >= 2:
                    over_limit.append(
                        f"{student.user.full_name} ({student.user.student_number or student.id})"
                    )
            if over_limit:
                raise serializers.ValidationError({
                    "student_ids": (
                        "These students already have the maximum of 2 parents linked: "
                        + ", ".join(over_limit)
                    )
                })
            data['students_qs'] = students

        return data

    def update(self, instance, validated_data):
        user = instance.user

        if 'full_name' in validated_data:
            parts = (validated_data['full_name'] or '').strip().split(' ', 1)
            user.first_name = parts[0] if parts and parts[0] else user.first_name
            user.last_name = parts[1] if len(parts) > 1 else ''
        if 'email' in validated_data:
            user.email = validated_data['email']
        if 'contact_number' in validated_data:
            user.phone_number = validated_data['contact_number'] or None
        password = validated_data.get('password')
        if password:
            user.set_password(password)
        user.save()

        if 'occupation' in validated_data:
            instance.occupation = validated_data['occupation']
        instance.save()

        if 'student_ids' in validated_data:
            students = validated_data.pop('students_qs', Student.objects.none())
            instance.children.set(students)

            selected_ids = list(students.values_list('id', flat=True))
            ParentChildLink.objects.filter(parent=instance).exclude(student_id__in=selected_ids).delete()

            for student in students:
                link, created = ParentChildLink.objects.get_or_create(
                    parent=instance,
                    student=student,
                    defaults={'is_confirmed': True, 'confirmed_date': timezone.now()}
                )
                if not created and not link.is_confirmed:
                    link.is_confirmed = True
                    link.confirmed_date = timezone.now()
                    link.save(update_fields=['is_confirmed', 'confirmed_date'])
                if student.user.school:
                    instance.schools.add(student.user.school)

        return instance


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

    class Meta:
        model = SchoolEvent
        fields = ['id', 'title', 'description', 'event_type', 'start_date',
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


class ClassAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.first_name', read_only=True)
    student_surname = serializers.CharField(source='student.user.last_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.first_name', read_only=True)

    class Meta:
        model = ClassAttendance
        fields = ['id', 'student', 'student_name', 'student_surname', 'class_assigned',
                  'date', 'status', 'remarks', 'recorded_by', 'recorded_by_name', 'date_recorded']


class SubjectAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.first_name', read_only=True)
    student_surname = serializers.CharField(source='student.user.last_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.first_name', read_only=True)

    class Meta:
        model = SubjectAttendance
        fields = ['id', 'student', 'student_name', 'student_surname', 'class_assigned',
                  'subject', 'subject_name', 'date', 'status', 'remarks',
                  'recorded_by', 'recorded_by_name', 'date_recorded']

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


class HomeworkSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='assigned_class.name', read_only=True)

    class Meta:
        model = Homework
        fields = [
            'id', 'title', 'subject', 'subject_name', 'teacher', 'teacher_name',
            'assigned_class', 'class_name', 'description', 'file',
            'due_date', 'date_created'
        ]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}"


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment', 'assignment_title', 'student', 'student_name',
            'submitted_file', 'text_submission', 'submitted_at',
            'grade', 'feedback', 'status'
        ]
        read_only_fields = ['submitted_at']

    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
