from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    ConferenceSlot, ConferenceBooking, Teacher, Parent, Student
)


# ---------------------------------------------------------------
# Teacher Conference Slot endpoints
# ---------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def teacher_conference_slots(request):
    """
    GET  — List all conference slots for the authenticated teacher.
    POST — Bulk-create available time slots.
           Expects: { "slots": [{"date": "2026-04-01", "start_time": "08:00", "end_time": "08:30"}, ...] }
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can manage conference slots'}, status=status.HTTP_403_FORBIDDEN)

    try:
        teacher = Teacher.objects.get(user=request.user)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        slots = ConferenceSlot.objects.filter(teacher=teacher).select_related('teacher__user')
        data = []
        for s in slots:
            slot_data = {
                'id': s.id,
                'date': str(s.date),
                'start_time': s.start_time.strftime('%H:%M'),
                'end_time': s.end_time.strftime('%H:%M'),
                'is_booked': s.is_booked,
            }
            # Include booking info if booked
            if s.is_booked and hasattr(s, 'booking'):
                try:
                    booking = s.booking
                    slot_data['booking'] = {
                        'id': booking.id,
                        'parent_name': booking.parent.user.full_name,
                        'student_name': booking.student.user.full_name,
                        'purpose': booking.purpose,
                        'status': booking.status,
                        'date_booked': booking.date_booked.isoformat(),
                    }
                except ConferenceBooking.DoesNotExist:
                    pass
            data.append(slot_data)
        return Response({'results': data, 'count': len(data)})

    # POST — bulk create
    slots_data = request.data.get('slots', [])
    if not slots_data:
        return Response({'error': 'Provide a "slots" array'}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    errors = []
    for idx, slot in enumerate(slots_data):
        date = slot.get('date')
        start_time = slot.get('start_time')
        end_time = slot.get('end_time')
        if not all([date, start_time, end_time]):
            errors.append(f'Slot {idx}: date, start_time, end_time required')
            continue
        try:
            obj = ConferenceSlot.objects.create(
                teacher=teacher,
                date=date,
                start_time=start_time,
                end_time=end_time,
                school=request.user.school,
            )
            created.append({
                'id': obj.id,
                'date': str(obj.date),
                'start_time': obj.start_time.strftime('%H:%M'),
                'end_time': obj.end_time.strftime('%H:%M'),
            })
        except Exception as e:
            errors.append(f'Slot {idx}: {str(e)}')

    return Response({
        'created': created,
        'errors': errors,
        'message': f'{len(created)} slot(s) created'
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def teacher_delete_conference_slot(request, slot_id):
    """Delete an unbooked conference slot."""
    if request.user.role != 'teacher':
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        teacher = Teacher.objects.get(user=request.user)
        slot = ConferenceSlot.objects.get(id=slot_id, teacher=teacher)
    except (Teacher.DoesNotExist, ConferenceSlot.DoesNotExist):
        return Response({'error': 'Slot not found'}, status=status.HTTP_404_NOT_FOUND)

    if slot.is_booked:
        return Response({'error': 'Cannot delete a booked slot'}, status=status.HTTP_400_BAD_REQUEST)

    slot.delete()
    return Response({'message': 'Slot deleted'})


# ---------------------------------------------------------------
# Parent Conference endpoints
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_available_conference_slots(request):
    """
    List available (unbooked) slots for a given teacher.
    Query param: ?teacher_id=X
    """
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can view available slots'}, status=status.HTTP_403_FORBIDDEN)

    teacher_id = request.query_params.get('teacher_id')
    if not teacher_id:
        return Response({'error': 'teacher_id query parameter required'}, status=status.HTTP_400_BAD_REQUEST)

    slots = ConferenceSlot.objects.filter(
        teacher_id=teacher_id,
        is_booked=False,
        school=request.user.school,
    ).select_related('teacher__user')

    data = [
        {
            'id': s.id,
            'teacher_name': s.teacher.user.full_name,
            'date': str(s.date),
            'start_time': s.start_time.strftime('%H:%M'),
            'end_time': s.end_time.strftime('%H:%M'),
        }
        for s in slots
    ]
    return Response({'results': data, 'count': len(data)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def parent_book_conference(request):
    """
    Book an available slot.
    Expects: { "slot_id": 1, "student_id": 2, "purpose": "Discuss grades" }
    """
    if request.user.role != 'parent':
        return Response({'error': 'Only parents can book conferences'}, status=status.HTTP_403_FORBIDDEN)

    slot_id = request.data.get('slot_id')
    student_id = request.data.get('student_id')
    purpose = request.data.get('purpose', '')

    if not slot_id or not student_id:
        return Response({'error': 'slot_id and student_id are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        parent = Parent.objects.get(user=request.user)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        slot = ConferenceSlot.objects.get(id=slot_id, school=request.user.school)
    except ConferenceSlot.DoesNotExist:
        return Response({'error': 'Slot not found'}, status=status.HTTP_404_NOT_FOUND)

    if slot.is_booked:
        return Response({'error': 'This slot is already booked'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    booking = ConferenceBooking.objects.create(
        slot=slot,
        parent=parent,
        student=student,
        purpose=purpose,
    )
    slot.is_booked = True
    slot.save()

    return Response({
        'message': 'Conference booked successfully',
        'booking': {
            'id': booking.id,
            'teacher_name': slot.teacher.user.full_name,
            'date': str(slot.date),
            'start_time': slot.start_time.strftime('%H:%M'),
            'end_time': slot.end_time.strftime('%H:%M'),
            'student_name': student.user.full_name,
            'purpose': booking.purpose,
            'status': booking.status,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def parent_conferences(request):
    """List all conference bookings for the authenticated parent."""
    if request.user.role != 'parent':
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        parent = Parent.objects.get(user=request.user)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent profile not found'}, status=status.HTTP_404_NOT_FOUND)

    bookings = ConferenceBooking.objects.filter(parent=parent).select_related(
        'slot__teacher__user', 'student__user'
    )
    data = [
        {
            'id': b.id,
            'teacher_name': b.slot.teacher.user.full_name,
            'date': str(b.slot.date),
            'start_time': b.slot.start_time.strftime('%H:%M'),
            'end_time': b.slot.end_time.strftime('%H:%M'),
            'student_name': b.student.user.full_name,
            'purpose': b.purpose,
            'status': b.status,
            'date_booked': b.date_booked.isoformat(),
            'notes': b.notes,
        }
        for b in bookings
    ]
    return Response({'results': data, 'count': len(data)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def parent_cancel_conference(request, booking_id):
    """Cancel a conference booking."""
    if request.user.role != 'parent':
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        parent = Parent.objects.get(user=request.user)
        booking = ConferenceBooking.objects.get(id=booking_id, parent=parent)
    except (Parent.DoesNotExist, ConferenceBooking.DoesNotExist):
        return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

    if booking.status == 'cancelled':
        return Response({'error': 'Already cancelled'}, status=status.HTTP_400_BAD_REQUEST)

    booking.status = 'cancelled'
    booking.save()

    # Free up the slot
    slot = booking.slot
    slot.is_booked = False
    slot.save()

    return Response({'message': 'Conference cancelled successfully'})
