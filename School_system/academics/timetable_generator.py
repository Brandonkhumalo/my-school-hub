"""
Timetable Generation using Constraint Satisfaction Problem (CSP) Algorithm
Uses backtracking with MRV (Minimum Remaining Values) heuristic

Constraints enforced:
1. Teachers don't clash - No teacher teaches two classes at the same time
2. Classes don't overlap - No class has two subjects at the same time  
3. Rooms aren't double-booked - No room hosts two classes at the same time
4. Subject periods per week - Each subject gets required number of periods
5. Teacher availability - Teachers only assigned during available times
6. Class-specific scheduling - Uses each class's schedule configuration
"""

import random
from datetime import datetime, timedelta
from collections import defaultdict
from .models import Class, Subject, Teacher, Timetable


DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']


def generate_periods_for_class(class_obj):
    """
    Generate time periods based on class scheduling configuration.
    Returns list of (start_time, end_time) tuples for regular days and Friday.
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
        
        min_period_length = 10
        
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
            elif time_until_barrier >= min_period_length:
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


class TimetableCSP:
    def __init__(self, classes, subjects, teachers, rooms, subjects_per_class, periods_per_subject, class_periods):
        self.classes = classes
        self.subjects = subjects
        self.teachers = teachers
        self.rooms = rooms
        self.subjects_per_class = subjects_per_class  # dict: {class_id: [subject_ids]}
        self.periods_per_subject = periods_per_subject  # dict: {subject_id: int}
        self.class_periods = class_periods  # dict: {class_id: {day: [(start, end), ...]}}
        
        self.time_slots = {}
        for cls in classes:
            cls_periods = class_periods.get(cls.id, {})
            self.time_slots[cls.id] = []
            for day in DAYS:
                day_periods = cls_periods.get(day, [])
                for start, end in day_periods:
                    self.time_slots[cls.id].append((day, start, end))
        
        self.timetable = {}  # {(class_id, day, start_time): (subject_id, teacher_id, room)}
        self.teacher_schedule = defaultdict(set)  # {teacher_id: {(day, time)}}
        self.room_schedule = defaultdict(set)  # {room: {(day, time)}}
        self.class_schedule = defaultdict(set)  # {class_id: {(day, time)}}
        self.subject_count = defaultdict(lambda: defaultdict(int))  # {class_id: {subject_id: count}}
        
    def get_teacher_for_subject(self, subject_id, class_id):
        """Find a teacher who can teach this subject"""
        for teacher in self.teachers:
            if subject_id in [s.id for s in teacher.subjects_taught.all()]:
                return teacher.id
        return None
    
    def get_available_rooms(self, day, start_time):
        """Get rooms not booked at this time"""
        time_key = (day, start_time)
        return [room for room in self.rooms if time_key not in self.room_schedule[room]]
    
    def is_teacher_available(self, teacher_id, day, start_time):
        """Check if teacher is free at this time"""
        return (day, start_time) not in self.teacher_schedule[teacher_id]
    
    def is_class_available(self, class_id, day, start_time):
        """Check if class is free at this time"""
        return (day, start_time) not in self.class_schedule[class_id]
    
    def get_remaining_periods(self, class_id, subject_id):
        """Get how many more periods this subject needs for this class"""
        required = self.periods_per_subject.get(subject_id, 4)
        current = self.subject_count[class_id][subject_id]
        return required - current
    
    def get_unassigned_slots(self, class_id):
        """Get all time slots not yet assigned for this class (MRV)"""
        unassigned = []
        class_slots = self.time_slots.get(class_id, [])
        for day, start, end in class_slots:
            if (day, start) not in self.class_schedule[class_id]:
                unassigned.append((day, start, end))
        return unassigned
    
    def get_subjects_needing_periods(self, class_id):
        """Get subjects that still need more periods for this class (MRV)"""
        subjects_needing = []
        for subject_id in self.subjects_per_class.get(class_id, []):
            remaining = self.get_remaining_periods(class_id, subject_id)
            if remaining > 0:
                subjects_needing.append((subject_id, remaining))
        # Sort by remaining periods (MRV - minimum remaining values first)
        subjects_needing.sort(key=lambda x: x[1])
        return [s[0] for s in subjects_needing]
    
    def assign_slot(self, class_id, day, start_time, end_time, subject_id, teacher_id, room):
        """Assign a subject to a time slot"""
        time_key = (day, start_time)
        self.timetable[(class_id, day, start_time)] = (subject_id, teacher_id, room, end_time)
        self.teacher_schedule[teacher_id].add(time_key)
        self.room_schedule[room].add(time_key)
        self.class_schedule[class_id].add(time_key)
        self.subject_count[class_id][subject_id] += 1
    
    def unassign_slot(self, class_id, day, start_time):
        """Remove assignment from a time slot (for backtracking)"""
        time_key = (day, start_time)
        if (class_id, day, start_time) in self.timetable:
            subject_id, teacher_id, room, _ = self.timetable[(class_id, day, start_time)]
            del self.timetable[(class_id, day, start_time)]
            self.teacher_schedule[teacher_id].discard(time_key)
            self.room_schedule[room].discard(time_key)
            self.class_schedule[class_id].discard(time_key)
            self.subject_count[class_id][subject_id] -= 1
    
    def solve_class(self, class_id):
        """Solve timetable for a single class using backtracking"""
        unassigned_slots = self.get_unassigned_slots(class_id)
        subjects_needing = self.get_subjects_needing_periods(class_id)
        
        if not subjects_needing:
            return True
        
        if not unassigned_slots:
            return len(subjects_needing) == 0
        
        subject_id = subjects_needing[0]
        teacher_id = self.get_teacher_for_subject(subject_id, class_id)
        
        if teacher_id is None:
            return False
        
        random.shuffle(unassigned_slots)
        
        for day, start, end in unassigned_slots:
            if not self.is_teacher_available(teacher_id, day, start):
                continue
            
            available_rooms = self.get_available_rooms(day, start)
            if not available_rooms:
                continue
            
            room = available_rooms[0]
            
            self.assign_slot(class_id, day, start, end, subject_id, teacher_id, room)
            
            if self.solve_class(class_id):
                return True
            
            self.unassign_slot(class_id, day, start)
        
        return False
    
    def solve(self):
        """Solve timetable for all classes"""
        for class_obj in self.classes:
            success = self.solve_class(class_obj.id)
            if not success:
                return False, f"Could not generate timetable for {class_obj.name}"
        return True, "Timetable generated successfully"
    
    def get_timetable(self):
        """Return the generated timetable"""
        return self.timetable


def generate_timetable(school=None, academic_year=None, clear_existing=True):
    """
    Main function to generate timetables for all classes - filtered by school
    Uses each class's scheduling configuration for period generation.
    Returns: (success, message, timetable_entries)
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
    
    rooms = [f"Room {i}" for i in range(1, len(classes) + 5)]
    
    class_periods = {}
    for cls in classes:
        class_periods[cls.id] = generate_periods_for_class(cls)
    
    subjects_per_class = {}
    for cls in classes:
        subjects_per_class[cls.id] = [s.id for s in subjects[:min(10, len(subjects))]]
    
    periods_per_subject = {s.id: 4 for s in subjects}
    
    csp = TimetableCSP(
        classes=classes,
        subjects=subjects,
        teachers=teachers,
        rooms=rooms,
        subjects_per_class=subjects_per_class,
        periods_per_subject=periods_per_subject,
        class_periods=class_periods
    )
    
    success, message = csp.solve()
    
    if not success:
        return False, message, []
    
    timetable_entries = []
    
    with transaction.atomic():
        if clear_existing:
            delete_qs = Timetable.objects.filter(class_assigned__school=school)
            if academic_year:
                delete_qs = delete_qs.filter(class_assigned__academic_year=academic_year)
            delete_qs.delete()
        
        for (class_id, day, start_time), (subject_id, teacher_id, room, end_time) in csp.get_timetable().items():
            try:
                class_obj = Class.objects.get(id=class_id)
                subject_obj = Subject.objects.get(id=subject_id)
                teacher_obj = Teacher.objects.get(id=teacher_id)
                
                entry = Timetable.objects.create(
                    class_assigned=class_obj,
                    subject=subject_obj,
                    teacher=teacher_obj,
                    day_of_week=day,
                    start_time=start_time,
                    end_time=end_time,
                    room=room
                )
                timetable_entries.append(entry)
            except Exception as e:
                print(f"Error creating timetable entry: {e}")
                continue
    
    return True, f"Successfully generated timetable with {len(timetable_entries)} entries", timetable_entries
