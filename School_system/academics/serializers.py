from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Subject, Class, Student, Teacher, Parent, Result,
    Timetable, Announcement, Complaint, Suspension,
    ParentChildLink, WeeklyMessage, SchoolEvent, Assignment, ClassAttendance, SubjectAttendance, ParentTeacherMessage,
    Homework, AssignmentSubmission, DietaryFlag, Dormitory, DormAssignment, MealMenu, MealAttendance,
    DormRollCall, LightsOutRecord, ExeatRequest, ExeatMovementLog, MedicationSchedule, TuckWallet,
    TuckTransaction, LaundrySchedule, LostItemReport, PrepAttendance, DormInspectionScore, StudentWellnessCheckIn,
    AssessmentPlan, Activity, ActivityEnrollment, ActivityEvent,
    SportsHouse, MatchSquadEntry, TrainingAttendance, HousePointEntry,
)
from users.serializers import UserSerializer
from .utils import generate_unique_student_number, MAX_PARENTS_PER_CHILD
from users.models import CustomUser
from django.db import transaction
from django.utils import timezone
from staff.models import Staff

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

    house_name = serializers.CharField(source='house.name', required=False, allow_null=True)

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_class', 'class_name', 'residence_type', 'admission_date', 
            'parent_contact', 'address', 'parent_names', 'date_of_birth', 
            'gender', 'emergency_contact', 'parent_phone', 'parent_email', 'house', 'house_name'
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


class TransferredStudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)
    transferred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_class', 'class_name', 'residence_type',
            'admission_date', 'parent_contact', 'address', 'date_of_birth',
            'gender', 'emergency_contact', 'is_transferred', 'transferred_at',
            'transfer_note', 'transferred_by_name',
        ]

    def get_transferred_by_name(self, obj):
        if obj.transferred_by:
            return obj.transferred_by.get_full_name() or obj.transferred_by.email
        return None


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    subjects = SubjectSerializer(source='subjects_taught', many=True, read_only=True)
    class_taught = serializers.SerializerMethodField()
    teaching_classes = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'subjects', 'hire_date', 'qualification', 'class_taught', 'teaching_classes']

    def get_class_taught(self, obj):
        classes = obj.user.taught_classes.all()
        return [{'id': cls.id, 'name': cls.name} for cls in classes]

    def get_teaching_classes(self, obj):
        classes = sorted(
            obj.teaching_classes.all(),
            key=lambda cls: (cls.grade_level, cls.name),
        )
        return [{
            'id': cls.id,
            'name': cls.name,
            'grade_level': cls.grade_level,
            'academic_year': cls.academic_year,
        } for cls in classes]


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
            'class': child.student_class.name,
            'residence_type': child.residence_type
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
            'include_in_report', 'report_term', 'effective_term',
            'assessment_plan', 'component_kind', 'component_index'
        ]

    def validate_score(self, value):
        # Snap to 2dp to avoid float drift (e.g. 76 being stored as 75.9999...).
        return round(float(value), 2)

    def validate_max_score(self, value):
        return round(float(value), 2)

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
    target_audience = serializers.ChoiceField(
        choices=['all', 'student', 'students', 'parent', 'parents', 'teacher', 'teachers',
                 'hr', 'accountant', 'librarian', 'security', 'cleaner'],
        required=False,
        default='all'
    )
    target_audiences = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            'all', 'student', 'students', 'parent', 'parents', 'teacher', 'teachers',
            'hr', 'accountant', 'librarian', 'security', 'cleaner'
        ]),
        required=False,
        allow_empty=False,
    )
    duration_days = serializers.IntegerField(required=False, write_only=True, min_value=1, max_value=365)
    is_expired = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'author', 'author_name', 'target_audience',
                  'target_audiences', 'target_class', 'class_name', 'date_posted', 'expires_at',
                  'duration_days', 'is_expired', 'can_delete', 'is_active']
        read_only_fields = ['author', 'author_name', 'class_name', 'date_posted', 'is_expired', 'can_delete']

    def validate(self, attrs):
        target_audiences = attrs.get('target_audiences') or []
        target_audience = attrs.get('target_audience')
        normalize = {
            'students': 'student',
            'parents': 'parent',
            'teachers': 'teacher',
        }

        if target_audiences:
            deduped = []
            for audience in target_audiences:
                audience = normalize.get(audience, audience)
                if audience not in deduped:
                    deduped.append(audience)
            attrs['target_audiences'] = deduped
            attrs['target_audience'] = deduped[0]
        else:
            attrs['target_audience'] = normalize.get(target_audience, target_audience) if target_audience else 'all'
            attrs['target_audiences'] = [attrs['target_audience']]

        return attrs

    def create(self, validated_data):
        duration_days = validated_data.pop('duration_days', None)
        if duration_days:
            validated_data['expires_at'] = timezone.now() + timedelta(days=duration_days)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        duration_days = validated_data.pop('duration_days', None)
        if duration_days:
            validated_data['expires_at'] = timezone.now() + timedelta(days=duration_days)
        return super().update(instance, validated_data)

    def get_is_expired(self, obj):
        return bool(obj.expires_at and obj.expires_at <= timezone.now())

    def get_can_delete(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if user.role in ('admin', 'hr', 'superadmin') and user.school_id == obj.author.school_id:
            return True
        return obj.author_id == user.id


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
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=Teacher.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Suspension
        fields = [
            'id', 'student', 'student_name', 'student_number', 'teacher',
            'teacher_name', 'reason', 'start_date', 'end_date',
            'is_active', 'date_created'
        ]

class SportsHouseSerializer(serializers.ModelSerializer):
    captain_name = serializers.CharField(source='captain.user.full_name', read_only=True)

    class Meta:
        model = SportsHouse
        fields = ['id', 'school', 'name', 'color', 'captain', 'captain_name']
class ActivitySerializer(serializers.ModelSerializer):
    coach_name = serializers.CharField(source='coach.full_name', read_only=True)
    assistant_coach_name = serializers.CharField(source='assistant_coach.full_name', read_only=True)

    class Meta:
        model = Activity
        fields = [
            'id', 'name', 'activity_type', 'age_group', 'gender_category', 
            'level', 'description', 'coach', 'coach_name', 'assistant_coach', 'assistant_coach_name', 'schedule_day', 
            'schedule_time', 'location', 'max_participants', 'is_active', 
            'date_created'
        ]


class ActivityEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    is_age_eligible = serializers.SerializerMethodField()

    class Meta:
        model = ActivityEnrollment
        fields = [
            'id', 'student', 'student_name', 'student_number', 'activity', 
            'activity_name', 'role', 'status', 'is_active', 'is_suspended', 
            'suspension_reason', 'is_injured', 'injury_cleared_date', 'injury_notes', 'date_joined', 'is_age_eligible'
        ]

    def get_is_age_eligible(self, obj):
        if not obj.student.date_of_birth or not obj.activity.age_group or obj.activity.age_group in ['open', 'first_team']:
            return True
        import datetime
        current_year = datetime.date.today().year
        age = current_year - obj.student.date_of_birth.year
        age_group = obj.activity.age_group
        if age_group.startswith('u'):
            try:
                max_age = int(age_group[1:])
                return age <= max_age
            except ValueError:
                return True
        return True


class ActivityEventSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source='activity.name', read_only=True)

    class Meta:
        model = ActivityEvent
        fields = [
            'id', 'activity', 'activity_name', 'title', 'event_type', 
            'event_date', 'location', 'venue', 'opponent', 'opponent_school', 'is_home', 
            'transport_required', 'status', 'our_score', 
            'opponent_score', 'match_result', 'result', 'notes', 'date_created'
        ]

class MatchSquadEntrySerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = MatchSquadEntry
        fields = ['id', 'event', 'student', 'student_name', 'is_captain', 'jersey_number', 'played']

class TrainingAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = TrainingAttendance
        fields = ['id', 'event', 'student', 'student_name', 'present', 'notes']

class HousePointEntrySerializer(serializers.ModelSerializer):
    house_name = serializers.CharField(source='house.name', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.full_name', read_only=True)

    class Meta:
        model = HousePointEntry
        fields = ['id', 'house', 'house_name', 'activity_event', 'points', 'reason', 'awarded_by', 'awarded_by_name', 'date']


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
    residence_type = serializers.ChoiceField(choices=Student.RESIDENCE_TYPE_CHOICES, default='day')
    admission_date = serializers.DateField()
    student_email = serializers.EmailField(required=False, allow_blank=True)
    student_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)
    student_address = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    emergency_contact = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, data):
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None

        if school:
            residence_type = data.get('residence_type', 'day')
            school_mode = getattr(school, 'accommodation_type', 'day')
            if school_mode == 'day' and residence_type != 'day':
                raise serializers.ValidationError({"residence_type": "This school is configured as day-only."})
            if school_mode == 'boarding' and residence_type != 'boarding':
                raise serializers.ValidationError({"residence_type": "This school is configured as boarding-only."})

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
        residence_type = validated_data.get('residence_type', 'day')
        
        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None
        created_by = request.user if request else None

        enrollment_year = str(admission_date.year)[-2:]
        student_number = generate_unique_student_number(enrollment_year)

        email = student_email if student_email else f"{student_number}@school.com"

        with transaction.atomic():
            from django.db.models import Count

            active_students_count = Student.objects.select_for_update().filter(
                user__school=school,
                user__role='student',
                user__is_active=True,
            ).aggregate(total=Count('id'))['total'] or 0
            student_limit = int(getattr(school, 'student_limit', 0) or 0)
            over_limit = student_limit > 0 and active_students_count >= student_limit

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
                created_by=created_by,
                is_active=not over_limit,
            )

            student = Student.objects.create(
                user=user,
                student_class=student_class,
                residence_type=residence_type,
                admission_date=admission_date,
                parent_contact=student_contact,
                address=student_address,
                date_of_birth=date_of_birth,
                gender=gender,
                emergency_contact=emergency_contact or student_contact,
                pending_activation_due_to_limit=over_limit,
            )

        # Automatically bootstrap one-term invoices/payment records for Terms 1-3
        # when school fees exist for this grade/year.
        try:
            from finances.billing_service import ensure_three_term_invoices_for_student
            ensure_three_term_invoices_for_student(
                student=student,
                school=school,
                academic_year=str(admission_date.year),
                recorded_by=created_by,
            )
        except Exception:
            # Student creation should not fail if billing sync fails.
            pass

            if over_limit:
                self.context['limit_exceeded_info'] = {
                    'message': (
                        'You have reached your student limit. '
                        'Please contact Tishanyq Digital. '
                        'This student was saved and will activate automatically when your limit is increased.'
                    ),
                    'student_limit': student_limit,
                    'active_students': active_students_count,
                }

        return student

class CreateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=['M', 'F', 'O', 'P'], required=False, allow_blank=True)
    hire_date = serializers.DateField()
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    password = serializers.CharField(min_length=6)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    teaching_class_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
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
            if len(subject_ids) < 1:
                raise serializers.ValidationError("Secondary teachers must have at least one assigned subject")

        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None

        # Validate subject IDs belong to school
        if 'subject_ids' in data:
            subject_ids = list(dict.fromkeys(data.get('subject_ids', [])))
            if subject_ids:
                subjects_qs = Subject.objects.filter(id__in=subject_ids)
                if school:
                    subjects_qs = subjects_qs.filter(school=school)
                found_subject_ids = set(subjects_qs.values_list('id', flat=True))
                missing_subject_ids = [sid for sid in subject_ids if sid not in found_subject_ids]
                if missing_subject_ids:
                    raise serializers.ValidationError({
                        "subject_ids": f"Invalid subject IDs for your school: {missing_subject_ids}"
                    })
            data['subject_ids'] = subject_ids

        # Validate teaching class IDs belong to school
        if 'teaching_class_ids' in data:
            teaching_class_ids = list(dict.fromkeys(data.get('teaching_class_ids', [])))
            if teaching_class_ids:
                classes_qs = Class.objects.filter(id__in=teaching_class_ids)
                if school:
                    classes_qs = classes_qs.filter(school=school)
                found_class_ids = set(classes_qs.values_list('id', flat=True))
                missing_class_ids = [cid for cid in teaching_class_ids if cid not in found_class_ids]
                if missing_class_ids:
                    raise serializers.ValidationError({
                        "teaching_class_ids": f"Invalid class IDs for your school: {missing_class_ids}"
                    })
            data['teaching_class_ids'] = teaching_class_ids

        # Validate assigned class ownership and enforce one class teacher per class
        assigned_class_id = data.get('assigned_class_id')
        if assigned_class_id:
            try:
                assigned_class = Class.objects.select_related('class_teacher').get(id=assigned_class_id)
            except Class.DoesNotExist:
                raise serializers.ValidationError({"assigned_class_id": "Selected class does not exist"})

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
            gender = validated_data.get('gender') or None
            user = CustomUser.objects.create_user(
                username=staff_number,
                email=validated_data['email'],
                password=validated_data['password'],
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                role='teacher',
                student_number=staff_number,
                phone_number=phone if phone else None,
                gender=gender,
                school=school,
                created_by=created_by
            )
            
            teacher = Teacher.objects.create(
                user=user,
                hire_date=validated_data['hire_date'],
                qualification=validated_data.get('qualification', '')
            )

            salary = validated_data.get('salary')
            if salary is not None:
                Staff.objects.update_or_create(
                    user=user,
                    defaults={
                        'employee_id': user.student_number or staff_number,
                        'department': None,
                        'position': 'teacher',
                        'hire_date': validated_data['hire_date'],
                        'salary': salary,
                        'is_active': user.is_active,
                    },
                )
            
            if validated_data.get('subject_ids'):
                teacher.subjects_taught.set(validated_data['subject_ids'])
            if 'teaching_class_ids' in validated_data:
                teacher.teaching_classes.set(validated_data.get('teaching_class_ids', []))

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
                'gender': gender or '',
                'hire_date': str(validated_data['hire_date']),
                'qualification': validated_data.get('qualification', ''),
                'salary': str(salary) if salary is not None else None,
                'subject_ids': validated_data.get('subject_ids', []),
                'teaching_class_ids': validated_data.get('teaching_class_ids', []),
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
                if current_parent_count >= MAX_PARENTS_PER_CHILD:
                    over_limit.append(
                        f"{student.user.full_name} ({student.user.student_number or student.id})"
                    )
            if over_limit:
                raise serializers.ValidationError({
                    "student_ids": (
                        f"These students already have the maximum of {MAX_PARENTS_PER_CHILD} parents linked: "
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
    change_class = serializers.BooleanField(required=False, default=False)
    residence_type = serializers.ChoiceField(choices=Student.RESIDENCE_TYPE_CHOICES, required=False)
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
        if student_class and instance and student_class.id != instance.student_class_id:
            if not data.get('change_class', False):
                raise serializers.ValidationError({
                    "student_class": "Class change requires explicit confirmation."
                })

        if school and 'residence_type' in data:
            school_mode = getattr(school, 'accommodation_type', 'day')
            residence_type = data.get('residence_type')
            if school_mode == 'day' and residence_type != 'day':
                raise serializers.ValidationError({"residence_type": "This school is configured as day-only."})
            if school_mode == 'boarding' and residence_type != 'boarding':
                raise serializers.ValidationError({"residence_type": "This school is configured as boarding-only."})

        return data

    def update(self, instance, validated_data):
        user = instance.user
        validated_data.pop('change_class', None)

        for field in ['first_name', 'last_name', 'email', 'phone_number']:
            if field in validated_data:
                setattr(user, field, validated_data[field] or '')

        password = validated_data.get('password')
        if password:
            user.set_password(password)
        user.save()

        for field in ['student_class', 'residence_type', 'admission_date', 'parent_contact', 'address', 'date_of_birth', 'gender', 'emergency_contact']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class UpdateTeacherSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.CharField(read_only=True)
    password = serializers.CharField(min_length=6, required=False, allow_blank=True)
    hire_date = serializers.DateField(required=False)
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    subject_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    teaching_class_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    assigned_class_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        instance = self.instance
        email = data.get('email')
        phone = data.get('phone_number')
        if email and CustomUser.objects.filter(email=email).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"email": "This email is already registered"})
        if phone and CustomUser.objects.filter(phone_number=phone).exclude(id=instance.user_id).exists():
            raise serializers.ValidationError({"phone_number": "This phone number is already registered"})

        request = self.context.get('request')
        school = request.user.school if request and hasattr(request.user, 'school') else None

        if 'subject_ids' in data:
            subject_ids = list(dict.fromkeys(data.get('subject_ids', [])))
            if subject_ids:
                subjects_qs = Subject.objects.filter(id__in=subject_ids)
                if school:
                    subjects_qs = subjects_qs.filter(school=school)
                found_subject_ids = set(subjects_qs.values_list('id', flat=True))
                missing_subject_ids = [sid for sid in subject_ids if sid not in found_subject_ids]
                if missing_subject_ids:
                    raise serializers.ValidationError({
                        "subject_ids": f"Invalid subject IDs for your school: {missing_subject_ids}"
                    })
            data['subject_ids'] = subject_ids

        if 'teaching_class_ids' in data:
            teaching_class_ids = list(dict.fromkeys(data.get('teaching_class_ids', [])))
            if teaching_class_ids:
                classes_qs = Class.objects.filter(id__in=teaching_class_ids)
                if school:
                    classes_qs = classes_qs.filter(school=school)
                found_class_ids = set(classes_qs.values_list('id', flat=True))
                missing_class_ids = [cid for cid in teaching_class_ids if cid not in found_class_ids]
                if missing_class_ids:
                    raise serializers.ValidationError({
                        "teaching_class_ids": f"Invalid class IDs for your school: {missing_class_ids}"
                    })
            data['teaching_class_ids'] = teaching_class_ids

        assigned_class_id = data.get('assigned_class_id', None)
        if assigned_class_id:
            try:
                assigned_class = Class.objects.select_related('class_teacher').get(id=assigned_class_id)
            except Class.DoesNotExist:
                raise serializers.ValidationError({"assigned_class_id": "Selected class does not exist"})

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
        salary = validated_data.pop('salary', None)
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

        if salary is not None:
            Staff.objects.update_or_create(
                user=user,
                defaults={
                    'employee_id': user.student_number or f"EMP{user.id}",
                    'department': getattr(getattr(user, 'staff', None), 'department', None),
                    'position': 'teacher',
                    'hire_date': instance.hire_date,
                    'salary': salary,
                    'is_active': user.is_active,
                },
            )

        if 'subject_ids' in validated_data:
            instance.subjects_taught.set(validated_data.get('subject_ids', []))
        if 'teaching_class_ids' in validated_data:
            instance.teaching_classes.set(validated_data.get('teaching_class_ids', []))

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
                if current_parent_count >= MAX_PARENTS_PER_CHILD:
                    over_limit.append(
                        f"{student.user.full_name} ({student.user.student_number or student.id})"
                    )
            if over_limit:
                raise serializers.ValidationError({
                    "student_ids": (
                        f"These students already have the maximum of {MAX_PARENTS_PER_CHILD} parents linked: "
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


class BoardingStudentSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    student_number = serializers.CharField(source='user.student_number', read_only=True)
    class_name = serializers.CharField(source='student_class.name', read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'full_name', 'student_number', 'class_name', 'residence_type']


class DietaryFlagSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = DietaryFlag
        fields = ['id', 'student', 'student_name', 'allergies', 'special_diet', 'notes', 'updated_at']


class DormitorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Dormitory
        fields = ['id', 'name', 'gender', 'capacity', 'is_active', 'created_at']


class DormAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    dormitory_name = serializers.CharField(source='dormitory.name', read_only=True)

    class Meta:
        model = DormAssignment
        fields = [
            'id', 'student', 'student_name', 'student_number', 'dormitory', 'dormitory_name',
            'room_name', 'bed_name', 'start_date', 'end_date', 'is_active', 'assigned_at'
        ]

    def validate(self, attrs):
        dormitory = attrs.get('dormitory') or getattr(self.instance, 'dormitory', None)
        student = attrs.get('student') or getattr(self.instance, 'student', None)
        room_name = (attrs.get('room_name') or getattr(self.instance, 'room_name', '')).strip()
        bed_name = (attrs.get('bed_name') or getattr(self.instance, 'bed_name', '')).strip()
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))

        if not dormitory or not is_active:
            return attrs

        active_assignments = DormAssignment.objects.filter(
            dormitory=dormitory,
            is_active=True,
        )

        if student:
            # A reassigned student is moved by deactivating their previous assignment.
            active_assignments = active_assignments.exclude(student=student)

        if self.instance and self.instance.pk:
            active_assignments = active_assignments.exclude(pk=self.instance.pk)

        if room_name and bed_name and active_assignments.filter(
            room_name__iexact=room_name,
            bed_name__iexact=bed_name,
        ).exists():
            raise serializers.ValidationError({
                'bed_name': 'This bed is already assigned to another active student.'
            })

        if dormitory.capacity and active_assignments.count() >= dormitory.capacity:
            raise serializers.ValidationError({
                'dormitory': f'{dormitory.name} is already at full capacity ({dormitory.capacity}).'
            })

        return attrs


class MealMenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealMenu
        fields = ['id', 'date', 'meal_type', 'menu_text', 'created_at']


class MealAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    meal_type = serializers.CharField(source='meal_menu.meal_type', read_only=True)
    meal_date = serializers.DateField(source='meal_menu.date', read_only=True)

    class Meta:
        model = MealAttendance
        fields = [
            'id', 'meal_menu', 'meal_type', 'meal_date', 'student', 'student_name',
            'student_number', 'status', 'marked_at'
        ]


class MealAttendanceBulkItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=MealAttendance.STATUS_CHOICES)


class MealAttendanceBulkSerializer(serializers.Serializer):
    meal_menu_id = serializers.IntegerField()
    attendance = MealAttendanceBulkItemSerializer(many=True, required=False, default=list)
    absent_student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    excused_student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    mark_unlisted_as_ate = serializers.BooleanField(required=False, default=False)
    target_student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        attendance_rows = attrs.get('attendance') or []
        absent_student_ids = set(attrs.get('absent_student_ids') or [])
        excused_student_ids = set(attrs.get('excused_student_ids') or [])
        mark_unlisted_as_ate = attrs.get('mark_unlisted_as_ate', False)

        if not attendance_rows and not absent_student_ids and not excused_student_ids and not mark_unlisted_as_ate:
            raise serializers.ValidationError(
                "Provide attendance rows, absent/excused students, or enable mark_unlisted_as_ate."
            )

        overlap = absent_student_ids & excused_student_ids
        if overlap:
            raise serializers.ValidationError({
                'excused_student_ids': 'A student cannot be both absent and excused in the same submission.'
            })

        row_student_status = {}
        for row in attendance_rows:
            student_id = row['student_id']
            status = row['status']
            if student_id in row_student_status and row_student_status[student_id] != status:
                raise serializers.ValidationError({
                    'attendance': f'Conflicting statuses provided for student_id={student_id}.'
                })
            row_student_status[student_id] = status

        conflicting_with_absent = [sid for sid, st in row_student_status.items() if sid in absent_student_ids and st != 'absent']
        if conflicting_with_absent:
            raise serializers.ValidationError({
                'attendance': f'Conflicting status for absent students: {conflicting_with_absent}'
            })

        conflicting_with_excused = [sid for sid, st in row_student_status.items() if sid in excused_student_ids and st != 'excused']
        if conflicting_with_excused:
            raise serializers.ValidationError({
                'attendance': f'Conflicting status for excused students: {conflicting_with_excused}'
            })

        return attrs


class DormRollCallSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = DormRollCall
        fields = ['id', 'student', 'student_name', 'call_date', 'call_type', 'status', 'remarks', 'created_at']


class LightsOutRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = LightsOutRecord
        fields = ['id', 'student', 'student_name', 'date', 'in_bed_time', 'remarks', 'created_at']


class ExeatRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)

    class Meta:
        model = ExeatRequest
        fields = [
            'id', 'student', 'student_name', 'student_number', 'requested_by', 'requested_by_name',
            'date_from', 'date_to', 'reason', 'collecting_person', 'status', 'decision_notes',
            'reviewed_by_name', 'reviewed_at', 'created_at'
        ]
        read_only_fields = ['status', 'decision_notes', 'reviewed_by_name', 'reviewed_at', 'created_at']


class ExeatDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[('approved', 'Approved'), ('denied', 'Denied')])
    decision_notes = serializers.CharField(required=False, allow_blank=True)


class ExeatMovementLogSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = ExeatMovementLog
        fields = ['id', 'exeat_request', 'student', 'student_name', 'action', 'action_time', 'notes']


class MedicationScheduleSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = MedicationSchedule
        fields = [
            'id', 'student', 'student_name', 'medication_name', 'dosage', 'administration_time',
            'start_date', 'end_date', 'instructions', 'is_active', 'created_at'
        ]


class TuckWalletSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)

    class Meta:
        model = TuckWallet
        fields = ['id', 'student', 'student_name', 'student_number', 'balance', 'updated_at']


class TuckTransactionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='wallet.student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='wallet.student.user.student_number', read_only=True)

    class Meta:
        model = TuckTransaction
        fields = [
            'id', 'wallet', 'student_name', 'student_number', 'transaction_type',
            'amount', 'description', 'created_at'
        ]


class LaundryScheduleSerializer(serializers.ModelSerializer):
    dormitory_name = serializers.CharField(source='dormitory.name', read_only=True)

    class Meta:
        model = LaundrySchedule
        fields = ['id', 'dormitory', 'dormitory_name', 'day_of_week', 'time_slot', 'notes', 'created_at']


class LostItemReportSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = LostItemReport
        fields = ['id', 'student', 'student_name', 'item_description', 'status', 'created_at']


class PrepAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = PrepAttendance
        fields = ['id', 'student', 'student_name', 'date', 'status', 'remarks', 'created_at']


class DormInspectionScoreSerializer(serializers.ModelSerializer):
    dormitory_name = serializers.CharField(source='dormitory.name', read_only=True)

    class Meta:
        model = DormInspectionScore
        fields = ['id', 'dormitory', 'dormitory_name', 'inspection_date', 'score', 'max_score', 'notes', 'created_at']


class StudentWellnessCheckInSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)

    class Meta:
        model = StudentWellnessCheckIn
        fields = ['id', 'student', 'student_name', 'check_date', 'mood_score', 'notes', 'created_at']


class AssessmentPlanSerializer(serializers.ModelSerializer):
    subject_ids = serializers.PrimaryKeyRelatedField(
        source='subjects', many=True, queryset=Subject.objects.all(), write_only=True
    )
    subjects_detail = serializers.SerializerMethodField(read_only=True)
    effective_papers = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default=None)
    grade_levels = serializers.ListField(
        child=serializers.IntegerField(min_value=-1),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = AssessmentPlan
        fields = [
            'id', 'academic_year', 'academic_term',
            'grade_levels',
            'subject_ids', 'subjects_detail',
            'num_papers', 'paper_numbers', 'paper_weights',
            'num_tests', 'num_assignments',
            'papers_weight', 'tests_weight', 'assignments_weight',
            'effective_papers', 'notes',
            'created_by', 'created_by_name', 'date_created', 'date_updated',
        ]
        read_only_fields = ['created_by', 'date_created', 'date_updated']

    def get_subjects_detail(self, obj):
        return [{'id': s.id, 'name': s.name, 'code': s.code} for s in obj.subjects.all()]

    def get_effective_papers(self, obj):
        return obj.effective_paper_numbers()

    def validate(self, attrs):
        grade_levels = attrs.get('grade_levels', getattr(self.instance, 'grade_levels', []) or [])
        if grade_levels:
            normalized = sorted({int(g) for g in grade_levels})
            attrs['grade_levels'] = normalized

        num_papers = attrs.get('num_papers', getattr(self.instance, 'num_papers', 0))
        paper_numbers = attrs.get('paper_numbers', getattr(self.instance, 'paper_numbers', []) or [])
        if num_papers and num_papers > 6:
            raise serializers.ValidationError({'num_papers': 'Maximum 6 papers supported.'})
        if paper_numbers:
            try:
                nums = [int(n) for n in paper_numbers]
            except (TypeError, ValueError):
                raise serializers.ValidationError({'paper_numbers': 'Must be a list of integers.'})
            if any(n < 1 or n > 6 for n in nums):
                raise serializers.ValidationError({'paper_numbers': 'Paper numbers must be between 1 and 6.'})
            if len(set(nums)) != len(nums):
                raise serializers.ValidationError({'paper_numbers': 'Duplicate paper numbers not allowed.'})
            if num_papers and len(nums) != num_papers:
                raise serializers.ValidationError({'paper_numbers': f'Expected {num_papers} paper numbers, got {len(nums)}.'})

        pw = attrs.get('papers_weight', getattr(self.instance, 'papers_weight', 0.6))
        tw = attrs.get('tests_weight', getattr(self.instance, 'tests_weight', 0.25))
        aw = attrs.get('assignments_weight', getattr(self.instance, 'assignments_weight', 0.15))
        total = float(pw) + float(tw) + float(aw)
        if any(w < 0 for w in (pw, tw, aw)):
            raise serializers.ValidationError('Weights cannot be negative.')
        if abs(total - 1.0) > 0.01:
            raise serializers.ValidationError(
                f'papers_weight + tests_weight + assignments_weight must sum to 1.0 (got {total:.2f}).'
            )
        return attrs
