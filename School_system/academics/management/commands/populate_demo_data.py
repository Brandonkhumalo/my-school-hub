from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, date, timedelta
from academics.models import (
    Class, Subject, Teacher, Student, Result, Assignment, 
    SchoolEvent, Announcement, Timetable, Attendance
)
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Populate database with demo data for teachers, marks, submissions, calendar, announcements, and timetable'

    def handle(self, *args, **kwargs):
        self.stdout.write('Starting demo data population...')
        
        # Get all secondary forms (grade 8+)
        secondary_classes = Class.objects.filter(grade_level__gte=8)
        subjects = list(Subject.objects.exclude(code='').all())
        
        self.stdout.write(f'Found {secondary_classes.count()} secondary classes and {len(subjects)} subjects')
        
        # Step 1: Create teachers for each class
        self.create_teachers(secondary_classes, subjects)
        
        # Step 2: Populate student marks
        self.populate_marks(subjects)
        
        # Step 3: Create demo submissions (15 Nov and after)
        self.create_submissions(secondary_classes, subjects)
        
        # Step 4: Populate calendar events
        self.populate_calendar()
        
        # Step 5: Populate announcements
        self.populate_announcements()
        
        # Step 6: Populate timetable
        self.populate_timetable(secondary_classes, subjects)
        
        self.stdout.write(self.style.SUCCESS('Demo data population completed!'))

    def create_teachers(self, secondary_classes, subjects):
        """Create at least 5 teachers for each secondary form with assigned subjects"""
        self.stdout.write('Creating teachers...')
        
        teacher_names = [
            ('John', 'Smith'), ('Mary', 'Johnson'), ('Robert', 'Williams'),
            ('Patricia', 'Brown'), ('Michael', 'Jones'), ('Linda', 'Garcia'),
            ('William', 'Martinez'), ('Elizabeth', 'Rodriguez'), ('David', 'Wilson'),
            ('Jennifer', 'Anderson'), ('Richard', 'Taylor'), ('Maria', 'Thomas'),
            ('Charles', 'Hernandez'), ('Susan', 'Moore'), ('Joseph', 'Martin'),
            ('Margaret', 'Jackson'), ('Thomas', 'Thompson'), ('Dorothy', 'White'),
            ('Christopher', 'Lopez'), ('Lisa', 'Lee'), ('Daniel', 'Gonzalez'),
            ('Nancy', 'Harris'), ('Matthew', 'Clark'), ('Karen', 'Lewis'),
            ('Donald', 'Robinson'), ('Betty', 'Walker'), ('Mark', 'Perez'),
            ('Helen', 'Hall'), ('Steven', 'Young'), ('Sandra', 'Allen')
        ]
        
        teacher_index = 0
        for class_obj in secondary_classes:
            # Create 6 teachers per class
            for i in range(6):
                if teacher_index >= len(teacher_names):
                    teacher_index = 0
                
                first_name, last_name = teacher_names[teacher_index]
                username = f"{first_name.lower()}.{last_name.lower()}.{class_obj.id}.{i}"
                email = f"{username}@school.com"
                
                # Check if user already exists
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': email,
                        'first_name': first_name,
                        'last_name': last_name,
                        'role': 'teacher',
                        'phone_number': f'+263{random.randint(70000000, 79999999)}'
                    }
                )
                
                if created:
                    user.set_password('teacher123')
                    user.save()
                    
                    # Create teacher profile
                    teacher = Teacher.objects.create(
                        user=user,
                        hire_date=date(2020, random.randint(1, 12), random.randint(1, 28)),
                        qualification='Bachelor of Education'
                    )
                    
                    # Assign 2-3 subjects to each teacher
                    num_subjects = random.randint(2, 3)
                    assigned_subjects = random.sample(subjects, min(num_subjects, len(subjects)))
                    teacher.subjects_taught.set(assigned_subjects)
                    
                    self.stdout.write(f'  Created teacher: {user.get_full_name()} for {class_obj.name}')
                
                teacher_index += 1

    def populate_marks(self, subjects):
        """Populate student marks for all students"""
        self.stdout.write('Populating student marks...')
        
        students = Student.objects.all()
        exam_types = ['Test 1', 'Test 2', 'Mid-term Exam', 'Assignment 1', 'Assignment 2', 'Final Exam']
        teachers = list(Teacher.objects.all())
        
        if not teachers:
            self.stdout.write('  No teachers found, skipping marks population')
            return
        
        for student in students:
            # Get subjects for student's class from timetable
            class_subjects = student.student_class.timetable.values_list('subject', flat=True).distinct() if student.student_class else []
            
            if not class_subjects:
                # Use random subjects if no timetable
                class_subjects = random.sample([s.id for s in subjects], min(6, len(subjects)))
            
            for subject_id in class_subjects:
                try:
                    subject = Subject.objects.get(id=subject_id)
                    
                    # Get teacher for this subject
                    teacher = random.choice(teachers)
                    
                    # Create 3-5 results per subject
                    for exam_type in random.sample(exam_types, random.randint(3, 5)):
                        score = random.randint(45, 95)
                        max_score = 100
                        
                        Result.objects.get_or_create(
                            student=student,
                            subject=subject,
                            exam_type=exam_type,
                            academic_term='Term 3',
                            academic_year='2025',
                            defaults={
                                'teacher': teacher,
                                'score': score,
                                'max_score': max_score
                            }
                        )
                except Subject.DoesNotExist:
                    continue
        
        self.stdout.write(f'  Created marks for {students.count()} students')

    def create_submissions(self, secondary_classes, subjects):
        """Create demo submissions with dates from 15 November onwards"""
        self.stdout.write('Creating demo submissions...')
        
        submission_titles = [
            'Research Essay', 'Lab Report', 'Project Presentation',
            'Case Study Analysis', 'Group Assignment', 'Book Review',
            'Practical Assignment', 'Term Paper', 'Problem Set'
        ]
        
        teachers = list(Teacher.objects.all())
        if not teachers:
            self.stdout.write('  No teachers found, skipping submissions')
            return
        
        # Dates from 15 November onwards  
        base_date = datetime(2025, 11, 15)
        
        for class_obj in secondary_classes:
            # Get subjects for this class from timetable or use random
            class_subjects = class_obj.timetable.values_list('subject', flat=True).distinct() if class_obj else []
            
            if not class_subjects:
                class_subjects = [s.id for s in random.sample(subjects, min(5, len(subjects)))]
            
            for subject_id in class_subjects:
                try:
                    subject = Subject.objects.get(id=subject_id)
                    teacher = random.choice(teachers)
                    
                    # Create 1-2 submissions per subject
                    for i in range(random.randint(1, 2)):
                        title = random.choice(submission_titles)
                        deadline = base_date + timedelta(days=random.randint(0, 30))
                        
                        Assignment.objects.get_or_create(
                            assigned_class=class_obj,
                            subject=subject,
                            title=f"{subject.name} - {title}",
                            deadline=deadline,
                            defaults={
                                'teacher': teacher,
                                'description': f'{title} for {subject.name}'
                            }
                        )
                except Subject.DoesNotExist:
                    continue
        
        self.stdout.write(f'  Created submissions for {secondary_classes.count()} classes')

    def populate_calendar(self):
        """Populate calendar with demo events"""
        self.stdout.write('Populating calendar events...')
        
        # Get admin user
        admin_user = User.objects.filter(role='admin').first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username='admin',
                password='admin123',
                role='admin',
                first_name='School',
                last_name='Administrator'
            )
        
        events = [
            {
                'title': 'Sports Day',
                'description': 'Annual inter-house sports competition',
                'event_type': 'school_activity',
                'start_date': datetime(2025, 11, 10).date(),
                'end_date': datetime(2025, 11, 10).date(),
                'location': 'School Sports Field',
                'created_by': admin_user
            },
            {
                'title': 'Final Examinations Start',
                'description': 'End of year final examinations begin',
                'event_type': 'exam',
                'start_date': datetime(2025, 11, 15).date(),
                'end_date': datetime(2025, 11, 29).date(),
                'location': 'All Classrooms',
                'created_by': admin_user
            },
            {
                'title': 'School Closes for December Holiday',
                'description': 'Last day of school term',
                'event_type': 'holiday',
                'start_date': datetime(2025, 12, 13).date(),
                'end_date': datetime(2026, 1, 10).date(),
                'location': 'School Campus',
                'created_by': admin_user
            },
            {
                'title': 'Prize Giving Ceremony',
                'description': 'Annual awards and prize distribution',
                'event_type': 'school_activity',
                'start_date': datetime(2025, 12, 12).date(),
                'end_date': datetime(2025, 12, 12).date(),
                'location': 'School Hall',
                'created_by': admin_user
            },
            {
                'title': 'Parent-Teacher Meetings',
                'description': 'Discuss student progress with parents',
                'event_type': 'school_activity',
                'start_date': datetime(2025, 11, 8).date(),
                'end_date': datetime(2025, 11, 9).date(),
                'location': 'Various Classrooms',
                'created_by': admin_user
            }
        ]
        
        for event_data in events:
            SchoolEvent.objects.get_or_create(
                title=event_data['title'],
                start_date=event_data['start_date'],
                defaults=event_data
            )
        
        self.stdout.write(f'  Created {len(events)} calendar events')

    def populate_announcements(self):
        """Populate announcements with demo data"""
        self.stdout.write('Populating announcements...')
        
        # Get admin user or create one
        admin_user = User.objects.filter(role='admin').first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username='admin',
                password='admin123',
                role='admin',
                first_name='School',
                last_name='Administrator'
            )
        
        announcements = [
            {
                'title': 'Examination Timetable Released',
                'content': 'The final examination timetable for November 2025 has been published. Please check the notice board or your class teacher for details.',
                'target_audience': 'students'
            },
            {
                'title': 'Sports Day Participation',
                'content': 'All students are required to participate in Sports Day activities on November 10th. Please bring appropriate sports attire and water bottles.',
                'target_audience': 'all'
            },
            {
                'title': 'Library Hours Extended',
                'content': 'The school library will remain open until 6 PM during examination period to accommodate students who need study space.',
                'target_audience': 'students'
            },
            {
                'title': 'School Fees Payment Reminder',
                'content': 'Parents are reminded that outstanding school fees should be cleared before the end of term. Please contact the bursar for payment arrangements.',
                'target_audience': 'parents'
            },
            {
                'title': 'COVID-19 Safety Protocols',
                'content': 'Students are reminded to maintain social distancing and wear masks in crowded areas. Hand sanitizer stations are available throughout the school.',
                'target_audience': 'all'
            },
            {
                'title': 'Career Guidance Workshop',
                'content': 'A career guidance workshop will be held for Form 5 and 6 students on November 20th. Guest speakers from various universities will be present.',
                'target_audience': 'students'
            }
        ]
        
        for ann_data in announcements:
            Announcement.objects.get_or_create(
                title=ann_data['title'],
                defaults={
                    'content': ann_data['content'],
                    'target_audience': ann_data['target_audience'],
                    'author': admin_user
                }
            )
        
        self.stdout.write(f'  Created {len(announcements)} announcements')

    def populate_timetable(self, secondary_classes, subjects):
        """Populate timetable with demo data"""
        self.stdout.write('Populating timetable...')
        
        days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        time_slots = [
            ('07:30', '08:30'), ('08:30', '09:30'), ('09:30', '10:30'),
            ('11:00', '12:00'), ('12:00', '13:00'), ('14:00', '15:00')
        ]
        
        rooms = ['Room A1', 'Room A2', 'Room B1', 'Room B2', 'Lab 1', 'Lab 2', 'Library']
        
        for class_obj in secondary_classes:
            # Get teachers who teach subjects
            available_teachers = Teacher.objects.filter(
                subjects_taught__in=subjects
            ).distinct()
            
            if not available_teachers.exists():
                continue
            
            # Create timetable for this class
            for day in days_of_week:
                for start_time, end_time in time_slots:
                    # Random subject and teacher
                    subject = random.choice(subjects)
                    teachers_for_subject = available_teachers.filter(
                        subjects_taught=subject
                    )
                    
                    if teachers_for_subject.exists():
                        teacher = random.choice(teachers_for_subject)
                    else:
                        teacher = random.choice(available_teachers)
                    
                    room = random.choice(rooms)
                    
                    Timetable.objects.get_or_create(
                        class_assigned=class_obj,
                        day_of_week=day,
                        start_time=start_time,
                        defaults={
                            'end_time': end_time,
                            'subject': subject,
                            'teacher': teacher,
                            'room': room
                        }
                    )
        
        total_entries = Timetable.objects.count()
        self.stdout.write(f'  Created timetable entries: {total_entries}')
