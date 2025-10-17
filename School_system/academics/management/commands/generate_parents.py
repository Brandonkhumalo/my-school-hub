from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from academics.models import Student, Parent, ParentChildLink
import random
import secrets
import string

User = get_user_model()

FIRST_NAMES = [
    'John', 'Mary', 'David', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Lisa',
    'William', 'Patricia', 'James', 'Linda', 'Richard', 'Barbara', 'Joseph', 'Elizabeth',
    'Thomas', 'Susan', 'Charles', 'Jessica', 'Christopher', 'Karen', 'Daniel', 'Nancy',
    'Matthew', 'Margaret', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
    'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
    'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Laura',
    'Jeffrey', 'Sharon', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen', 'Stephen', 'Anna'
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
    'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
    'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
    'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter',
    'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz'
]


class Command(BaseCommand):
    help = 'Generate random parent users for all existing students and link them'

    def generate_secure_password(self, length=12):
        """Generate a cryptographically secure random password using secrets module"""
        characters = string.ascii_letters + string.digits + "!@#$%"
        password = ''.join(secrets.choice(characters) for _ in range(length))
        return password

    def handle(self, *args, **options):
        students = Student.objects.all()
        
        if not students.exists():
            self.stdout.write(self.style.WARNING('No students found in the database.'))
            return

        created_parents = 0
        created_links = 0
        parent_credentials = []  # Store credentials to display at the end

        for student in students:
            # Check if student already has a confirmed parent
            existing_link = ParentChildLink.objects.filter(
                student=student,
                is_confirmed=True
            ).first()

            if existing_link:
                self.stdout.write(
                    self.style.WARNING(
                        f'Student {student.user.first_name} {student.user.last_name} '
                        f'already has a parent (ID: {existing_link.parent.id})'
                    )
                )
                continue

            # Generate random parent name
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            
            # Create username from student info to make it traceable
            # Format: parent_studentfirstname_studentlastname_random
            username = f"parent_{student.user.first_name.lower()}_{student.user.last_name.lower()}_{random.randint(100, 999)}"
            
            # Generate secure random password
            password = self.generate_secure_password()
            
            # Create User for parent
            try:
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    email=f'{username}@school.com',
                    phone_number=f'+263{random.randint(700000000, 799999999)}',
                    role='parent'
                )
                
                # Create Parent profile
                parent = Parent.objects.create(user=user)
                created_parents += 1
                
                # Create ParentChildLink with confirmed=True
                link = ParentChildLink.objects.create(
                    parent=parent,
                    student=student,
                    is_confirmed=True,
                    confirmed_date=timezone.now()
                )
                created_links += 1
                
                # Store credentials
                parent_credentials.append({
                    'parent_name': f'{first_name} {last_name}',
                    'username': username,
                    'password': password,
                    'parent_id': parent.id,
                    'student_name': f'{student.user.first_name} {student.user.last_name}'
                })
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Created parent "{first_name} {last_name}" (username: {username}) '
                        f'for student {student.user.first_name} {student.user.last_name} '
                        f'(Parent ID: {parent.id})'
                    )
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Failed to create parent for student {student.user.first_name} {student.user.last_name}: {str(e)}'
                    )
                )
                continue

        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*60}'
                f'\n=== SUMMARY ==='
                f'\n{"="*60}'
                f'\nTotal students processed: {students.count()}'
                f'\nParents created: {created_parents}'
                f'\nLinks created: {created_links}'
            )
        )
        
        if parent_credentials:
            self.stdout.write(
                self.style.WARNING(
                    f'\n{"="*60}'
                    f'\n=== PARENT CREDENTIALS (SAVE THESE SECURELY) ==='
                    f'\n{"="*60}'
                )
            )
            
            for cred in parent_credentials:
                self.stdout.write(
                    self.style.WARNING(
                        f'\nParent: {cred["parent_name"]} (ID: {cred["parent_id"]})'
                        f'\nStudent: {cred["student_name"]}'
                        f'\nUsername: {cred["username"]}'
                        f'\nPassword: {cred["password"]}'
                        f'\n{"-"*40}'
                    )
                )
            
            self.stdout.write(
                self.style.WARNING(
                    f'\n{"="*60}'
                    f'\nIMPORTANT: Save these credentials securely!'
                    f'\nParents should change their password upon first login.'
                    f'\n{"="*60}\n'
                )
            )
