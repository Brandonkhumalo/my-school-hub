from decimal import Decimal

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.models import Notification
from .health_serializers import ClinicVisitSerializer
from .models import (
    ClinicVisit,
    DietaryFlag,
    DormAssignment,
    DormInspectionScore,
    Dormitory,
    DormRollCall,
    ExeatMovementLog,
    ExeatRequest,
    LaundrySchedule,
    LightsOutRecord,
    LostItemReport,
    MealAttendance,
    MealMenu,
    MedicationSchedule,
    ParentChildLink,
    PrepAttendance,
    Student,
    StudentWellnessCheckIn,
    TuckTransaction,
    TuckWallet,
)
from .serializers import (
    BoardingStudentSerializer,
    DietaryFlagSerializer,
    DormAssignmentSerializer,
    DormInspectionScoreSerializer,
    DormitorySerializer,
    DormRollCallSerializer,
    ExeatDecisionSerializer,
    ExeatMovementLogSerializer,
    ExeatRequestSerializer,
    LaundryScheduleSerializer,
    LightsOutRecordSerializer,
    LostItemReportSerializer,
    MealAttendanceBulkSerializer,
    MealAttendanceSerializer,
    MealMenuSerializer,
    MedicationScheduleSerializer,
    PrepAttendanceSerializer,
    StudentWellnessCheckInSerializer,
    TuckTransactionSerializer,
    TuckWalletSerializer,
)

WRITE_ROLES = {'admin', 'hr'}


def _supports_boarding(school):
    return bool(school and school.accommodation_type in ('boarding', 'both'))


def _write_allowed(user):
    return user.role in WRITE_ROLES


def _boarding_school_or_403(request):
    school = getattr(request.user, 'school', None)
    if not _supports_boarding(school):
        return None, Response(
            {'error': 'Boarding features are disabled for this school.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return school, None


def _boarding_students_qs(school):
    return Student.objects.filter(
        user__school=school,
        residence_type='boarding'
    ).select_related('user', 'student_class')


def _parent_student_ids(user):
    return set(
        ParentChildLink.objects.filter(
            parent__user=user,
            is_confirmed=True,
            student__residence_type='boarding',
        ).values_list('student_id', flat=True)
    )


def _student_scope_filter(request, queryset, student_field='student_id'):
    user = request.user
    if user.role in WRITE_ROLES:
        return queryset
    if user.role == 'student':
        try:
            student = user.student
        except Student.DoesNotExist:
            return queryset.none()
        if student.residence_type != 'boarding':
            return queryset.none()
        return queryset.filter(**{student_field: student.id})
    if user.role == 'parent':
        return queryset.filter(**{f'{student_field}__in': _parent_student_ids(user)})
    return queryset.none()


def _can_access_student(request, student):
    if request.user.role in WRITE_ROLES:
        return True
    if request.user.role == 'student':
        return hasattr(request.user, 'student') and request.user.student.id == student.id and student.residence_type == 'boarding'
    if request.user.role == 'parent':
        return student.id in _parent_student_ids(request.user)
    return False


def _notify_parents(student, title, message, link=''):
    parent_links = ParentChildLink.objects.filter(
        student=student,
        is_confirmed=True,
    ).select_related('parent__user')
    for parent_link in parent_links:
        Notification.objects.create(
            user=parent_link.parent.user,
            title=title,
            message=message,
            notification_type='general',
            link=link,
        )


def _notify_student(student, title, message, link=''):
    Notification.objects.create(
        user=student.user,
        title=title,
        message=message,
        notification_type='general',
        link=link,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def boarding_summary(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    user = request.user
    if user.role in WRITE_ROLES:
        students = _boarding_students_qs(school)
    elif user.role == 'student':
        try:
            students = _boarding_students_qs(school).filter(id=user.student.id)
        except Student.DoesNotExist:
            students = Student.objects.none()
    elif user.role == 'parent':
        students = _boarding_students_qs(school).filter(id__in=_parent_student_ids(user))
    else:
        return Response({'error': 'Role not allowed for boarding module'}, status=status.HTTP_403_FORBIDDEN)

    return Response({
        'school': {
            'id': school.id,
            'name': school.name,
            'accommodation_type': school.accommodation_type,
        },
        'students': BoardingStudentSerializer(students, many=True).data,
        'student_count': students.count(),
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def meal_menus_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    if request.method == 'GET':
        queryset = MealMenu.objects.filter(school=school)
        date_val = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')
        if date_val:
            queryset = queryset.filter(date=date_val)
        if meal_type:
            queryset = queryset.filter(meal_type=meal_type)

        queryset = queryset.annotate(attendance_count=Count('attendance_records'))
        data = MealMenuSerializer(queryset, many=True).data
        return Response(data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can post meal menus'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MealMenuSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(school=school, posted_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def meal_attendance_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    if request.method == 'GET':
        queryset = MealAttendance.objects.filter(
            meal_menu__school=school,
            student__residence_type='boarding',
        ).select_related('student__user', 'meal_menu')

        meal_menu_id = request.query_params.get('meal_menu_id')
        if meal_menu_id:
            queryset = queryset.filter(meal_menu_id=meal_menu_id)

        student_id = request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        queryset = _student_scope_filter(request, queryset, student_field='student_id')
        return Response(MealAttendanceSerializer(queryset, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can mark meal attendance'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MealAttendanceBulkSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data

    try:
        meal_menu = MealMenu.objects.get(id=payload['meal_menu_id'], school=school)
    except MealMenu.DoesNotExist:
        return Response({'error': 'Meal menu not found'}, status=status.HTTP_404_NOT_FOUND)

    upserted = []
    boarding_student_ids = set(_boarding_students_qs(school).values_list('id', flat=True))
    for row in payload['attendance']:
        student_id = row['student_id']
        if student_id not in boarding_student_ids:
            continue
        obj, _ = MealAttendance.objects.update_or_create(
            meal_menu=meal_menu,
            student_id=student_id,
            defaults={
                'status': row['status'],
                'marked_by': request.user,
            },
        )
        upserted.append(obj)

    return Response(MealAttendanceSerializer(upserted, many=True).data)


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def dietary_flag_view(request, student_id):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    try:
        student = Student.objects.select_related('user').get(
            id=student_id,
            user__school=school,
            residence_type='boarding',
        )
    except Student.DoesNotExist:
        return Response({'error': 'Boarding student not found'}, status=status.HTTP_404_NOT_FOUND)

    if not _can_access_student(request, student):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    flag, _ = DietaryFlag.objects.get_or_create(student=student)

    if request.method == 'GET':
        return Response(DietaryFlagSerializer(flag).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can edit dietary flags'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DietaryFlagSerializer(flag, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=request.user)
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def dormitories_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    if request.method == 'GET':
        qs = Dormitory.objects.filter(school=school)
        return Response(DormitorySerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can create dormitories'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DormitorySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(school=school, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def dorm_assignments_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = DormAssignment.objects.filter(
        student__user__school=school,
        student__residence_type='boarding',
        dormitory__school=school,
    ).select_related('student__user', 'dormitory')

    if request.method == 'GET':
        qs = _student_scope_filter(request, qs, student_field='student_id')
        if request.query_params.get('active_only') == '1':
            qs = qs.filter(is_active=True)
        return Response(DormAssignmentSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can assign dorms'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DormAssignmentSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        dormitory = serializer.validated_data['dormitory']

        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid student for boarding assignment'}, status=status.HTTP_400_BAD_REQUEST)
        if dormitory.school_id != school.id:
            return Response({'error': 'Invalid dormitory for your school'}, status=status.HTTP_400_BAD_REQUEST)

        if serializer.validated_data.get('is_active', True):
            DormAssignment.objects.filter(student=student, is_active=True).update(is_active=False)

        serializer.save(assigned_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def dorm_roll_call_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = DormRollCall.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user')

    if request.method == 'GET':
        date_val = request.query_params.get('date')
        call_type = request.query_params.get('call_type')
        if date_val:
            qs = qs.filter(call_date=date_val)
        if call_type:
            qs = qs.filter(call_type=call_type)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(DormRollCallSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can record roll calls'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DormRollCallSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, recorded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def lights_out_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = LightsOutRecord.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user')

    if request.method == 'GET':
        date_val = request.query_params.get('date')
        if date_val:
            qs = qs.filter(date=date_val)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(LightsOutRecordSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can record lights-out'}, status=status.HTTP_403_FORBIDDEN)

    serializer = LightsOutRecordSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, recorded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def exeat_requests_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = ExeatRequest.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user', 'requested_by', 'reviewed_by')

    if request.method == 'GET':
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(ExeatRequestSerializer(qs, many=True).data)

    serializer = ExeatRequestSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == 'parent' and student.id not in _parent_student_ids(request.user):
            return Response({'error': 'You can only request exeat for your linked child'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role not in WRITE_ROLES and request.user.role != 'parent':
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        obj = serializer.save(
            school=school,
            requested_by=request.user,
            status='pending',
        )
        return Response(ExeatRequestSerializer(obj).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def exeat_decision_view(request, exeat_id):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can approve or deny exeat'}, status=status.HTTP_403_FORBIDDEN)

    try:
        exeat = ExeatRequest.objects.select_related('student__user').get(id=exeat_id, school=school)
    except ExeatRequest.DoesNotExist:
        return Response({'error': 'Exeat request not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ExeatDecisionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    exeat.status = serializer.validated_data['status']
    exeat.decision_notes = serializer.validated_data.get('decision_notes', '')
    exeat.reviewed_by = request.user
    exeat.reviewed_at = timezone.now()
    exeat.save(update_fields=['status', 'decision_notes', 'reviewed_by', 'reviewed_at', 'updated_at'])

    _notify_student(
        exeat.student,
        'Exeat request update',
        f"Your exeat request has been {exeat.status}.",
        link='/student/boarding',
    )
    _notify_parents(
        exeat.student,
        'Exeat request update',
        f"Exeat request for {exeat.student.user.full_name} has been {exeat.status}.",
        link='/parent/boarding',
    )

    return Response(ExeatRequestSerializer(exeat).data)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def exeat_logs_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = ExeatMovementLog.objects.filter(
        exeat_request__school=school,
        student__residence_type='boarding',
    ).select_related('student__user', 'exeat_request')

    if request.method == 'GET':
        exeat_id = request.query_params.get('exeat_id')
        if exeat_id:
            qs = qs.filter(exeat_request_id=exeat_id)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(ExeatMovementLogSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can log sign-out/sign-in'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ExeatMovementLogSerializer(data=request.data)
    if serializer.is_valid():
        exeat_request = serializer.validated_data['exeat_request']
        student = serializer.validated_data['student']

        if exeat_request.school_id != school.id or student.user.school_id != school.id:
            return Response({'error': 'Invalid exeat or student for this school'}, status=status.HTTP_400_BAD_REQUEST)

        if exeat_request.student_id != student.id:
            return Response({'error': 'Movement student does not match exeat request student'}, status=status.HTTP_400_BAD_REQUEST)

        if exeat_request.status != 'approved':
            return Response({'error': 'Only approved exeat requests can be logged'}, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save(recorded_by=request.user)

        action_label = 'signed out' if obj.action == 'sign_out' else 'signed in'
        _notify_parents(
            student,
            'Boarding movement update',
            f"{student.user.full_name} has {action_label} ({timezone.localtime(obj.action_time).strftime('%Y-%m-%d %H:%M')}).",
            link='/parent/boarding',
        )

        return Response(ExeatMovementLogSerializer(obj).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def sickbay_visits_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = ClinicVisit.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user', 'recorded_by')

    if request.method == 'GET':
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(ClinicVisitSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can record sick-bay visits'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ClinicVisitSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)

        visit = serializer.save(
            school=school,
            recorded_by=request.user,
            parent_notified=True,
        )

        _notify_parents(
            student,
            'Sick bay visit recorded',
            f"{student.user.full_name} visited sick bay on {timezone.localtime(visit.visit_date).strftime('%Y-%m-%d %H:%M')}.",
            link='/parent/boarding',
        )

        return Response(ClinicVisitSerializer(visit).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def medication_schedules_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = MedicationSchedule.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user')

    if request.method == 'GET':
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        if request.query_params.get('active_only') == '1':
            qs = qs.filter(is_active=True)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(MedicationScheduleSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can manage medication schedules'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MedicationScheduleSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tuck_wallets_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = TuckWallet.objects.filter(
        student__user__school=school,
        student__residence_type='boarding',
    ).select_related('student__user')
    qs = _student_scope_filter(request, qs, student_field='student_id')

    if request.query_params.get('ensure') == '1' and _write_allowed(request.user):
        for student in _boarding_students_qs(school):
            TuckWallet.objects.get_or_create(student=student)
        qs = TuckWallet.objects.filter(
            student__user__school=school,
            student__residence_type='boarding',
        ).select_related('student__user')

    return Response(TuckWalletSerializer(qs, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def tuck_transactions_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = TuckTransaction.objects.filter(
        wallet__student__user__school=school,
        wallet__student__residence_type='boarding',
    ).select_related('wallet__student__user')

    if request.method == 'GET':
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(wallet__student_id=student_id)
        qs = _student_scope_filter(request, qs, student_field='wallet__student_id')
        return Response(TuckTransactionSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can post tuck transactions'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TuckTransactionSerializer(data=request.data)
    if serializer.is_valid():
        wallet = serializer.validated_data['wallet']
        if wallet.student.user.school_id != school.id or wallet.student.residence_type != 'boarding':
            return Response({'error': 'Invalid wallet for this school'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            wallet = TuckWallet.objects.select_for_update().get(id=wallet.id)
            amount = Decimal(serializer.validated_data['amount'])
            tx_type = serializer.validated_data['transaction_type']

            if tx_type == 'topup':
                wallet.balance += amount
            else:
                if wallet.balance < amount:
                    return Response({'error': 'Insufficient wallet balance'}, status=status.HTTP_400_BAD_REQUEST)
                wallet.balance -= amount
            wallet.save(update_fields=['balance', 'updated_at'])

            tx = serializer.save(created_by=request.user)

        return Response(TuckTransactionSerializer(tx).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tuck_low_balance_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    threshold = request.query_params.get('threshold', '5')
    try:
        threshold_amount = Decimal(threshold)
    except Exception:
        threshold_amount = Decimal('5')

    qs = TuckWallet.objects.filter(
        student__user__school=school,
        student__residence_type='boarding',
        balance__lte=threshold_amount,
    ).select_related('student__user')

    qs = _student_scope_filter(request, qs, student_field='student_id')
    return Response(TuckWalletSerializer(qs, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def laundry_schedules_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = LaundrySchedule.objects.filter(school=school).select_related('dormitory')

    if request.method == 'GET':
        return Response(LaundryScheduleSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can manage laundry schedules'}, status=status.HTTP_403_FORBIDDEN)

    serializer = LaundryScheduleSerializer(data=request.data)
    if serializer.is_valid():
        dormitory = serializer.validated_data.get('dormitory')
        if dormitory and dormitory.school_id != school.id:
            return Response({'error': 'Invalid dormitory for your school'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def lost_items_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = LostItemReport.objects.filter(school=school).select_related('student__user')

    if request.method == 'GET':
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        if request.user.role in ('student', 'parent'):
            qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(LostItemReportSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can report lost items'}, status=status.HTTP_403_FORBIDDEN)

    serializer = LostItemReportSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data.get('student')
        if student and (student.user.school_id != school.id or student.residence_type != 'boarding'):
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, reported_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def prep_attendance_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = PrepAttendance.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user')

    if request.method == 'GET':
        date_val = request.query_params.get('date')
        if date_val:
            qs = qs.filter(date=date_val)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(PrepAttendanceSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can mark prep attendance'}, status=status.HTTP_403_FORBIDDEN)

    serializer = PrepAttendanceSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, recorded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def dorm_inspections_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = DormInspectionScore.objects.filter(
        school=school,
        dormitory__school=school,
    ).select_related('dormitory')

    if request.method == 'GET':
        return Response(DormInspectionScoreSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can record dorm inspections'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DormInspectionScoreSerializer(data=request.data)
    if serializer.is_valid():
        dormitory = serializer.validated_data['dormitory']
        if dormitory.school_id != school.id:
            return Response({'error': 'Invalid dormitory for your school'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, inspected_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def wellness_checkins_view(request):
    school, error_response = _boarding_school_or_403(request)
    if error_response:
        return error_response

    qs = StudentWellnessCheckIn.objects.filter(
        school=school,
        student__residence_type='boarding',
    ).select_related('student__user')

    if request.method == 'GET':
        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)
        qs = _student_scope_filter(request, qs, student_field='student_id')
        return Response(StudentWellnessCheckInSerializer(qs, many=True).data)

    if not _write_allowed(request.user):
        return Response({'error': 'Only admin/hr can record wellness check-ins'}, status=status.HTTP_403_FORBIDDEN)

    serializer = StudentWellnessCheckInSerializer(data=request.data)
    if serializer.is_valid():
        student = serializer.validated_data['student']
        if student.user.school_id != school.id or student.residence_type != 'boarding':
            return Response({'error': 'Invalid boarding student'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(school=school, recorded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
