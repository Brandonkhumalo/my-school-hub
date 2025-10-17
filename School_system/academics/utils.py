import random
from datetime import date
from django.contrib.auth import get_user_model

User = get_user_model()

def generate_unique_student_number(enrollment_year=None, max_tries=10):
    """
    Generate a unique student number like STU22345
    where:
      - STU = prefix
      - 22 = last two digits of enrollment year
      - 345 = 3 random digits
    """
    if not enrollment_year:
        enrollment_year = date.today().year

    year_suffix = str(enrollment_year)[-2:]  # e.g., 2025 -> "25"

    for _ in range(max_tries):
        random_part = str(random.randint(100, 999))
        student_number = f"STU{year_suffix}{random_part}"
        if not User.objects.filter(student_number=student_number).exists():
            return student_number

    raise ValueError("Could not generate unique student number after multiple attempts")
