"""
Timetable Generation — Per-class greedy scheduler.

Rules:
1. Max 2 periods of the same subject per day per class
2. Priority subjects (is_priority=True) are scheduled FIRST and get
   at least 1 period every day (2 on some days if slots allow)
3. Normal subjects fill the remaining slots
4. A teacher is NEVER double-booked — global teacher_busy prevents clashes
5. If a subject can't fit on a day (teacher busy), it's prioritized for
   the next day via a carryover mechanism
"""

import logging
import random
from collections import defaultdict

logger = logging.getLogger(__name__)
from .models import Class, Subject, Teacher, Timetable, ClassSubjectAssignment

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


def _find_teacher(subject_teachers, sid, class_id, time_key, teacher_busy, teacher_scoped_classes):
    """Find a teacher for subject `sid` and class who is free at `time_key`."""
    candidates = [
        tid for tid in subject_teachers.get(sid, [])
        if not teacher_scoped_classes.get(tid) or class_id in teacher_scoped_classes[tid]
    ]
    random.shuffle(candidates)
    for tid in candidates:
        if time_key not in teacher_busy[tid]:
            return tid
    return None


def _find_room(rooms, time_key, room_busy):
    """Find a room not booked at `time_key`. Creates one if needed."""
    for r in rooms:
        if time_key not in room_busy[r]:
            return r
    new_room = f"Room {len(rooms) + 1}"
    rooms.append(new_room)
    return new_room


def generate_timetable(school=None, academic_year=None, clear_existing=True):
    """
    Generate timetables for all classes.
    Priority subjects → scheduled first, 1-2 periods/day across all 5 days.
    Normal subjects → fill remaining slots, max 2 per day.
    """
    from django.db import transaction

    if not school:
        return False, "School is required for timetable generation", []

    class_qs = Class.objects.filter(school=school)
    if academic_year:
        class_qs = class_qs.filter(academic_year=academic_year)
    classes = list(class_qs)
    subjects = list(Subject.objects.filter(school=school, is_deleted=False))
    teachers = list(Teacher.objects.filter(user__school=school).prefetch_related('subjects_taught', 'teaching_classes'))

    if not classes:
        return False, "No classes found", []
    if not teachers:
        return False, "No teachers found", []
    if not subjects:
        return False, "No subjects found", []

    # ── Maps ──
    subject_map = {s.id: s for s in subjects}
    subject_teachers = defaultdict(list)
    for teacher in teachers:
        for subj in teacher.subjects_taught.all():
            subject_teachers[subj.id].append(teacher.id)

    teachable = [s for s in subjects if s.id in subject_teachers]
    if not teachable:
        return False, "No subjects have assigned teachers. Assign teachers to subjects first.", []

    # Teacher class scopes:
    # - Empty set means unrestricted (legacy behavior) so existing schools continue to work.
    # - Non-empty set means admin explicitly limited this teacher to those forms/grades.
    teacher_scoped_classes = {
        teacher.id: set(teacher.teaching_classes.values_list('id', flat=True))
        for teacher in teachers
    }

    # ── Periods per class ──
    class_periods = {}
    for cls in classes:
        class_periods[cls.id] = generate_periods_for_class(cls)

    rooms = [f"Room {i}" for i in range(1, len(classes) + 5)]

    # ── Global state — prevents teacher double-booking ──
    teacher_busy = defaultdict(set)
    room_busy = defaultdict(set)
    assignments = []

    # Shuffle class order for fairness
    class_order = list(classes)
    random.shuffle(class_order)

    MAX_PER_DAY = 2  # Hard cap: no subject gets more than 2 periods on any day

    # Canonical class-subject mapping:
    # use explicit class assignments first; fallback to legacy subject pool only when missing.
    assignment_qs = ClassSubjectAssignment.objects.filter(
        school=school,
        class_obj_id__in=[c.id for c in classes],
    ).select_related('subject', 'teacher')
    if academic_year:
        assignment_qs = assignment_qs.filter(academic_year=academic_year)

    class_subject_assignments = defaultdict(list)
    for assignment in assignment_qs:
        if assignment.subject_id in subject_map:
            class_subject_assignments[assignment.class_obj_id].append(assignment)

    for cls in class_order:
        day_periods_map = class_periods.get(cls.id, {})
        total_slots = sum(len(slots) for slots in day_periods_map.values())
        if total_slots == 0:
            continue

        assignment_rows = class_subject_assignments.get(cls.id, [])
        assignment_teacher_map = {}
        class_teachable_subjects = []

        if assignment_rows:
            for row in assignment_rows:
                subj = row.subject
                teacher_ids = subject_teachers.get(subj.id, [])
                scoped_teacher_ids = [
                    tid for tid in teacher_ids
                    if not teacher_scoped_classes.get(tid) or cls.id in teacher_scoped_classes[tid]
                ]
                if not scoped_teacher_ids:
                    continue
                class_teachable_subjects.append(subj)
                if row.teacher_id and row.teacher_id in scoped_teacher_ids:
                    assignment_teacher_map[subj.id] = row.teacher_id
        else:
            for subj in teachable:
                teacher_ids = subject_teachers.get(subj.id, [])
                if any(
                    not teacher_scoped_classes.get(tid) or cls.id in teacher_scoped_classes[tid]
                    for tid in teacher_ids
                ):
                    class_teachable_subjects.append(subj)

        if not class_teachable_subjects:
            logger.warning(
                "Skipping class %s (%s): no teachers assigned for its allowed form/grade scope.",
                cls.id,
                cls.name,
            )
            continue

        priority_subjects = [s for s in class_teachable_subjects if s.is_priority]
        normal_subjects = [s for s in class_teachable_subjects if not s.is_priority]

        # ── Per-class: calculate how many weekly periods each subject gets ──
        # Priority subjects: 1 period/day = 5/week, or 2/day on some days
        # if few priority subjects relative to slots
        n_priority = len(priority_subjects)
        n_normal = len(normal_subjects)

        # Reserve slots for priority: each priority subject gets ~5 periods/week (1/day)
        priority_weekly = {}
        for s in priority_subjects:
            priority_weekly[s.id] = 5  # 1 per day across 5 days

        # Remaining slots for normal subjects
        reserved = sum(priority_weekly.values())
        remaining_slots = max(0, total_slots - reserved)
        normal_weekly = {}
        if n_normal > 0 and remaining_slots > 0:
            per_normal = max(1, min(remaining_slots // n_normal, 5))
            for s in normal_subjects:
                normal_weekly[s.id] = per_normal

        # Combined weekly budget per subject for this class
        weekly_budget = {}
        weekly_budget.update(priority_weekly)
        weekly_budget.update(normal_weekly)

        # ── Per-class trackers ──
        week_count = defaultdict(int)      # subject_id → total periods assigned this week
        day_count = defaultdict(lambda: defaultdict(int))  # subject_id → {day → count}

        # Subjects that couldn't be placed today → get priority tomorrow
        carryover = []

        for day in DAYS:
            day_slots = day_periods_map.get(day, [])
            if not day_slots:
                continue

            # ── Build today's subject queue ──
            # 1. Carryover subjects from yesterday (they were skipped)
            # 2. Priority subjects (ensure they get at least 1 today)
            # 3. Normal subjects
            todays_queue = []

            # Carryover first
            for sid in carryover:
                if week_count[sid] < weekly_budget.get(sid, 0):
                    todays_queue.append(sid)
            carryover = []

            # Priority subjects that haven't had a slot today yet
            priority_ids = [s.id for s in priority_subjects
                           if s.id not in todays_queue
                           and week_count[s.id] < weekly_budget.get(s.id, 0)]
            random.shuffle(priority_ids)
            todays_queue.extend(priority_ids)

            # Normal subjects
            normal_ids = [s.id for s in normal_subjects
                         if s.id not in todays_queue
                         and week_count[s.id] < weekly_budget.get(s.id, 0)]
            random.shuffle(normal_ids)
            todays_queue.extend(normal_ids)

            # ── Fill each slot ──
            for start, end in day_slots:
                time_key = (day, start)
                placed = False

                # Try each subject in queue order
                tried = 0
                while tried < len(todays_queue):
                    sid = todays_queue[0]
                    tried += 1

                    # Check weekly budget
                    if week_count[sid] >= weekly_budget.get(sid, 0):
                        todays_queue.pop(0)
                        tried -= 1  # list shrank, don't increment
                        continue

                    # Check max 2 per day
                    if day_count[sid][day] >= MAX_PER_DAY:
                        todays_queue.append(todays_queue.pop(0))
                        continue

                    # Find available teacher
                    preferred_tid = assignment_teacher_map.get(sid)
                    if preferred_tid:
                        in_scope = (
                            not teacher_scoped_classes.get(preferred_tid)
                            or cls.id in teacher_scoped_classes[preferred_tid]
                        )
                        if in_scope and time_key not in teacher_busy[preferred_tid]:
                            tid = preferred_tid
                        else:
                            tid = _find_teacher(
                                subject_teachers,
                                sid,
                                cls.id,
                                time_key,
                                teacher_busy,
                                teacher_scoped_classes,
                            )
                    else:
                        tid = _find_teacher(
                            subject_teachers,
                            sid,
                            cls.id,
                            time_key,
                            teacher_busy,
                            teacher_scoped_classes,
                        )
                    if tid is None:
                        # Teacher busy — carry this subject over to next day
                        if sid not in carryover:
                            carryover.append(sid)
                        todays_queue.append(todays_queue.pop(0))
                        continue

                    # Find room
                    room = _find_room(rooms, time_key, room_busy)

                    # ── Assign ──
                    teacher_busy[tid].add(time_key)
                    room_busy[room].add(time_key)
                    week_count[sid] += 1
                    day_count[sid][day] += 1
                    assignments.append((cls.id, sid, tid, room, day, start, end))
                    placed = True

                    # Rotate subject to back for variety
                    todays_queue.append(todays_queue.pop(0))
                    break

    # ── Write to database ──
    class_map = {c.id: c for c in classes}
    teacher_map_db = {t.id: t for t in teachers}
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
                    teacher=teacher_map_db[teach_id],
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
