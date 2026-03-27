"""
Timetable Generation — Greedy scheduler with per-class subject allocation
and teacher clash prevention.

Key design:
- Each class gets its OWN subject list and period count (per-class, not global)
- Teachers are never double-booked — before assigning, we check global teacher_busy
- Slots are filled across ALL days (Mon-Fri) evenly, not front-loaded
- If a teacher is busy for a subject at a given time, we try another teacher
  who teaches the same subject, or skip to the next subject
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

    Per-class logic:
    1. Determine which subjects this class takes (subjects that have a teacher)
    2. Calculate how many periods each subject gets FOR THIS CLASS
    3. Fill slots day-by-day, spreading subjects across the whole week
    4. Never double-book a teacher — check global teacher_busy before assigning
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

    # ── Build subject → [teacher_ids] map ──
    subject_teachers = defaultdict(list)
    for teacher in teachers:
        for subj in teacher.subjects_taught.all():
            subject_teachers[subj.id].append(teacher.id)

    teachable_subject_ids = set(subject_teachers.keys())
    if not teachable_subject_ids:
        return False, "No subjects have assigned teachers. Assign teachers to subjects first.", []

    # ── Generate time slots per class ──
    class_periods = {}
    for cls in classes:
        class_periods[cls.id] = generate_periods_for_class(cls)

    rooms = [f"Room {i}" for i in range(1, len(classes) + 5)]

    # ── GLOBAL teacher schedule — prevents any teacher from being in two places at once ──
    teacher_busy = defaultdict(set)   # teacher_id → {(day, start_time), ...}
    room_busy = defaultdict(set)      # room → {(day, start_time), ...}

    assignments = []  # (class_id, subject_id, teacher_id, room, day, start, end)

    # Shuffle class order for fairness
    class_order = list(classes)
    random.shuffle(class_order)

    for cls in class_order:
        # ── Per-class: determine subjects and periods ──
        cls_subject_ids = [sid for sid in teachable_subject_ids]
        random.shuffle(cls_subject_ids)

        # Count total available slots for THIS class across the whole week
        total_slots = 0
        for day in DAYS:
            total_slots += len(class_periods.get(cls.id, {}).get(day, []))

        if total_slots == 0 or len(cls_subject_ids) == 0:
            continue

        # Per-class periods: distribute slots evenly across this class's subjects
        periods_per_subj = max(1, min(total_slots // len(cls_subject_ids), 6))

        # Per-class tracker: how many periods each subject has been assigned
        cls_subject_count = defaultdict(int)
        # Per-class tracker: which days each subject has been placed on (for spreading)
        cls_subject_days = defaultdict(set)

        # Build a round-robin subject queue for this class
        subj_queue = list(cls_subject_ids)

        # ── Fill slots day by day (ensures all days get entries, not just Friday) ──
        for day in DAYS:
            day_slots = class_periods.get(cls.id, {}).get(day, [])

            for start, end in day_slots:
                time_key = (day, start)

                # Try each subject in the queue
                placed = False
                attempts = 0
                max_attempts = len(subj_queue)

                while attempts < max_attempts:
                    sid = subj_queue[0]
                    attempts += 1

                    # Check if this subject still needs periods for this class
                    if cls_subject_count[sid] >= periods_per_subj:
                        subj_queue.append(subj_queue.pop(0))
                        continue

                    # Prefer spreading: skip if this subject already has a slot today
                    # (but allow it if we've tried everything else)
                    if day in cls_subject_days[sid] and attempts < max_attempts:
                        subj_queue.append(subj_queue.pop(0))
                        continue

                    # Find an available teacher (NOT busy at this time globally)
                    teacher_id = None
                    candidates = list(subject_teachers.get(sid, []))
                    random.shuffle(candidates)
                    for tid in candidates:
                        if time_key not in teacher_busy[tid]:
                            teacher_id = tid
                            break

                    if teacher_id is None:
                        # Every teacher for this subject is busy at this time
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

                    # ── Assign — mark teacher as busy globally ──
                    teacher_busy[teacher_id].add(time_key)
                    room_busy[room].add(time_key)
                    cls_subject_count[sid] += 1
                    cls_subject_days[sid].add(day)
                    assignments.append((cls.id, sid, teacher_id, room, day, start, end))
                    placed = True

                    # Rotate to next subject for variety
                    subj_queue.append(subj_queue.pop(0))
                    break

                # If not placed — free period (that's fine)

    # ── Write to database ──
    class_map = {c.id: c for c in classes}
    subject_map = {s.id: s for s in subjects}
    teacher_map = {t.id: t for t in teachers}

    timetable_entries = []

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
                    room=room,
                )
                timetable_entries.append(entry)
            except Exception as e:
                logger.error("Error creating timetable entry: %s", e, exc_info=True)
                continue

    return True, f"Successfully generated timetable with {len(timetable_entries)} entries", timetable_entries
