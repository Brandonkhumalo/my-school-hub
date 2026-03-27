"""
Timetable Generation — Greedy scheduler with teacher clash avoidance.

Approach:
- For each class, iterate over its time slots
- Pick the next subject that still needs periods
- Find an AVAILABLE teacher for that subject at that time
- If no teacher is free, try the next subject
- If no subject can be placed, leave the slot empty (free period)

This always succeeds — it places as many periods as possible
without ever double-booking a teacher.
"""

import logging
import random
from collections import defaultdict

logger = logging.getLogger(__name__)
from .models import Class, Subject, Teacher, Timetable


DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']


def generate_periods_for_class(class_obj):
    """
    Generate time periods based on class scheduling configuration.
    Returns dict: {day: [(start_time_str, end_time_str), ...]}
    """
    first_start = class_obj.first_period_start
    last_end = class_obj.last_period_end
    friday_end = class_obj.friday_last_period_end or last_end
    base_duration = class_obj.period_duration_minutes or 45
    transition = 5 if class_obj.include_transition_time else 0
    duration = base_duration - transition if transition > 0 else base_duration

    break_start = class_obj.break_start
    break_end = class_obj.break_end
    lunch_start = class_obj.lunch_start
    lunch_end = class_obj.lunch_end

    if not first_start or not last_end:
        return {day: [('08:00', '08:45'), ('08:45', '09:30'), ('09:30', '10:15'),
                      ('10:30', '11:15'), ('11:15', '12:00'), ('14:00', '14:45')] for day in DAYS}

    def time_to_minutes(t):
        return t.hour * 60 + t.minute

    def minutes_to_time_str(mins):
        return f"{mins // 60:02d}:{mins % 60:02d}"

    def generate_day_periods(end_time):
        periods = []
        current = time_to_minutes(first_start)
        end_mins = time_to_minutes(end_time)
        break_start_mins = time_to_minutes(break_start) if break_start else None
        break_end_mins = time_to_minutes(break_end) if break_end else None
        lunch_start_mins = time_to_minutes(lunch_start) if lunch_start else None
        lunch_end_mins = time_to_minutes(lunch_end) if lunch_end else None

        max_iterations = 50
        iterations = 0

        while current < end_mins and iterations < max_iterations:
            iterations += 1
            previous_current = current

            if break_start_mins and break_end_mins and break_end_mins > break_start_mins:
                if current >= break_start_mins and current < break_end_mins:
                    current = break_end_mins
                    continue

            if lunch_start_mins and lunch_end_mins and lunch_end_mins > lunch_start_mins:
                if current >= lunch_start_mins and current < lunch_end_mins:
                    current = lunch_end_mins
                    continue

            next_barrier = end_mins
            if break_start_mins and current < break_start_mins:
                next_barrier = min(next_barrier, break_start_mins)
            if lunch_start_mins and current < lunch_start_mins:
                next_barrier = min(next_barrier, lunch_start_mins)

            time_until_barrier = next_barrier - current

            if time_until_barrier >= duration:
                period_end = current + duration
                periods.append((minutes_to_time_str(current), minutes_to_time_str(period_end)))
                current = period_end + transition
            elif time_until_barrier >= 10:
                period_end = next_barrier
                periods.append((minutes_to_time_str(current), minutes_to_time_str(period_end)))
                if next_barrier == break_start_mins:
                    current = break_end_mins
                elif next_barrier == lunch_start_mins:
                    current = lunch_end_mins
                else:
                    current = period_end + transition
            else:
                if next_barrier == break_start_mins:
                    current = break_end_mins
                elif next_barrier == lunch_start_mins:
                    current = lunch_end_mins
                else:
                    break

            if current <= previous_current:
                current = previous_current + 1

        return periods

    day_periods = {}
    for day in DAYS:
        if day == 'Friday':
            day_periods[day] = generate_day_periods(friday_end)
        else:
            day_periods[day] = generate_day_periods(last_end)

    return day_periods


def generate_timetable(school=None, academic_year=None, clear_existing=True):
    """
    Generate timetables for all classes in a school.
    Uses a greedy approach that never fails — places as many periods as
    possible while respecting teacher availability.
    """
    from django.db import transaction

    if not school:
        return False, "School is required for timetable generation", []

    class_qs = Class.objects.filter(school=school)
    if academic_year:
        class_qs = class_qs.filter(academic_year=academic_year)
    classes = list(class_qs)
    subjects = list(Subject.objects.filter(school=school))
    teachers = list(Teacher.objects.filter(user__school=school).prefetch_related('subjects_taught'))

    if not classes:
        return False, "No classes found", []
    if not teachers:
        return False, "No teachers found", []
    if not subjects:
        return False, "No subjects found", []

    # Build subject→teachers map (which teachers can teach each subject)
    subject_teachers = defaultdict(list)
    for teacher in teachers:
        for subj in teacher.subjects_taught.all():
            subject_teachers[subj.id].append(teacher.id)

    # Only use subjects that have at least one teacher
    teachable_subjects = [s for s in subjects if s.id in subject_teachers]
    if not teachable_subjects:
        return False, "No subjects have assigned teachers. Assign teachers to subjects first.", []

    # Generate rooms (one per class + extras)
    rooms = [f"Room {i}" for i in range(1, len(classes) + 5)]

    # Generate periods for each class
    class_periods = {}
    for cls in classes:
        class_periods[cls.id] = generate_periods_for_class(cls)

    # Calculate how many periods each subject should get per class per week
    # Distribute slots evenly, cap at 6
    subject_ids = [s.id for s in teachable_subjects]

    def get_periods_per_subject(cls):
        day_periods = class_periods.get(cls.id, {})
        total_slots = sum(len(slots) for slots in day_periods.values())
        n = len(subject_ids)
        if n == 0:
            return {}
        per_subj = max(1, min(total_slots // n, 6))
        return {sid: per_subj for sid in subject_ids}

    # ── Greedy scheduler ──
    # Global state: tracks which (day, start_time) each teacher is busy
    teacher_busy = defaultdict(set)  # teacher_id → {(day, start_time), ...}
    room_busy = defaultdict(set)     # room → {(day, start_time), ...}

    # Result: list of (class_id, subject_id, teacher_id, room, day, start, end)
    assignments = []
    skipped_classes = []

    # Shuffle classes for fairness (earlier classes don't hog all teachers)
    class_order = list(classes)
    random.shuffle(class_order)

    for cls in class_order:
        periods_needed = get_periods_per_subject(cls)
        subject_count = defaultdict(int)  # how many periods assigned so far

        # Build slot list for this class
        slots = []
        for day in DAYS:
            for start, end in class_periods.get(cls.id, {}).get(day, []):
                slots.append((day, start, end))

        # Shuffle subjects for variety, then cycle through them
        subj_queue = list(subject_ids)
        random.shuffle(subj_queue)

        for day, start, end in slots:
            time_key = (day, start)
            placed = False

            # Try each subject that still needs periods
            for _ in range(len(subj_queue)):
                sid = subj_queue[0]
                needed = periods_needed.get(sid, 0)

                if subject_count[sid] >= needed:
                    # This subject is full, rotate and try next
                    subj_queue.append(subj_queue.pop(0))
                    continue

                # Find an available teacher for this subject at this time
                teacher_id = None
                candidates = subject_teachers.get(sid, [])
                random.shuffle(candidates)
                for tid in candidates:
                    if time_key not in teacher_busy[tid]:
                        teacher_id = tid
                        break

                if teacher_id is None:
                    # No teacher free for this subject now, try next subject
                    subj_queue.append(subj_queue.pop(0))
                    continue

                # Find an available room
                room = None
                for r in rooms:
                    if time_key not in room_busy[r]:
                        room = r
                        break
                if room is None:
                    room = f"Room {len(rooms) + 1}"
                    rooms.append(room)

                # Assign
                teacher_busy[teacher_id].add(time_key)
                room_busy[room].add(time_key)
                subject_count[sid] += 1
                assignments.append((cls.id, sid, teacher_id, room, day, start, end))
                placed = True

                # Rotate subject to back of queue for variety
                subj_queue.append(subj_queue.pop(0))
                break

            # If nothing could be placed, slot becomes a free period (that's OK)

    # ── Write to database ──
    timetable_entries = []

    # Pre-fetch objects for efficiency
    class_map = {c.id: c for c in classes}
    subject_map = {s.id: s for s in subjects}
    teacher_map = {t.id: t for t in teachers}

    with transaction.atomic():
        if clear_existing:
            delete_qs = Timetable.objects.filter(class_assigned__school=school)
            if academic_year:
                delete_qs = delete_qs.filter(class_assigned__academic_year=academic_year)
            delete_qs.delete()

        for cls_id, subj_id, teach_id, room, day, start, end in assignments:
            try:
                entry = Timetable.objects.create(
                    class_assigned=class_map[cls_id],
                    subject=subject_map[subj_id],
                    teacher=teacher_map[teach_id],
                    day_of_week=day,
                    start_time=start,
                    end_time=end,
                    room=room
                )
                timetable_entries.append(entry)
            except Exception as e:
                logger.error("Error creating timetable entry: %s", e, exc_info=True)
                continue

    return True, f"Successfully generated timetable with {len(timetable_entries)} entries", timetable_entries
