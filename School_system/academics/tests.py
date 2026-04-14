"""
Test suite for the academics app.

Covers:
  - Subject, Teacher, Class, Student, Result, AssignmentSubmission model creation
  - Subject list/create  GET/POST /api/v1/academics/subjects/
  - Student list/create  GET/POST /api/v1/academics/students/
  - Results             GET/POST /api/v1/academics/results/
  - Timetable list      GET      /api/v1/academics/timetables/
  - Timetable conflicts GET      /api/v1/academics/timetables/conflicts/
  - Student attendance  GET      /api/v1/students/attendance/
  - Grade prediction    GET      /api/v1/academics/students/{id}/grade-prediction/
"""

import datetime
from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import CustomUser, School
from academics.models import (
    Assignment,
    AssignmentSubmission,
    ClassAttendance,
    Class,
    Result,
    Student,
    Subject,
    Teacher,
    Timetable,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_list(response_data):
    """Extract list from paginated or non-paginated DRF response."""
    if isinstance(response_data, dict) and 'results' in response_data:
        return response_data['results']
    return list(response_data)


def make_school(name="Academics Test School"):
    """Execute make school."""
    return School.objects.create(
        name=name,
        code=School.generate_school_code(),
        school_type="secondary",
        curriculum="zimsec",
    )


def make_user(school, username, role="admin", password="testpass123", first_name="Test", last_name="User", email=None):
    """Execute make user."""
    if email is None:
        email = f"{username}@school.test"
    return CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=role,
        school=school,
    )


def make_subject(school, name="Mathematics", code="MATH01"):
    """Execute make subject."""
    return Subject.objects.create(
        name=name,
        code=code,
        school=school,
        ca_weight=0.4,
        exam_weight=0.6,
    )


def make_class(school, teacher_user=None, name="Form 1A", grade_level=1, year="2026"):
    """Execute make class."""
    return Class.objects.create(
        name=name,
        grade_level=grade_level,
        academic_year=year,
        class_teacher=teacher_user,
        school=school,
    )


def make_teacher(school, username="teacher1"):
    """Execute make teacher."""
    user = make_user(school, username, role="teacher",
                     first_name="Jane", last_name="Smith")
    return Teacher.objects.create(
        user=user,
        hire_date=datetime.date(2020, 1, 15),
        qualification="B.Ed",
    )


def make_student(school, class_obj, username="student1", student_number="STU001"):
    """Execute make student."""
    user = make_user(school, username, role="student",
                     first_name="John", last_name="Doe")
    user.student_number = student_number
    user.save()
    return Student.objects.create(
        user=user,
        student_class=class_obj,
        admission_date=datetime.date(2024, 1, 10),
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class SubjectModelTest(TestCase):

    """Represents SubjectModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()

    def test_subject_creation(self):
        """Test that subject creation."""
        subj = make_subject(self.school)
        self.assertIsNotNone(subj.pk)
        self.assertEqual(subj.name, "Mathematics")
        self.assertFalse(subj.is_deleted)

    def test_subject_str(self):
        """Test that subject str."""
        subj = make_subject(self.school)
        self.assertIn("MATH01", str(subj))
        self.assertIn("Mathematics", str(subj))

    def test_subject_soft_delete(self):
        """Test that subject soft delete."""
        subj = make_subject(self.school)
        subj.delete()
        self.assertTrue(Subject.objects.all_with_deleted().get(pk=subj.pk).is_deleted)
        # Default manager should not return soft-deleted records
        self.assertFalse(Subject.objects.filter(pk=subj.pk).exists())

    def test_subject_unique_code_per_school(self):
        """Test that subject unique code per school."""
        make_subject(self.school, name="Math A", code="UNIQ01")
        with self.assertRaises(Exception):
            # Same code in same school must fail
            Subject.objects.create(name="Math B", code="UNIQ01", school=self.school)


class ClassModelTest(TestCase):

    """Represents ClassModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.teacher = make_teacher(self.school, username="cls_teacher")

    def test_class_creation(self):
        """Test that class creation."""
        cls = make_class(self.school, teacher_user=self.teacher.user)
        self.assertIsNotNone(cls.pk)
        self.assertEqual(cls.name, "Form 1A")
        self.assertEqual(cls.academic_year, "2026")

    def test_class_str(self):
        """Test that class str."""
        cls = make_class(self.school)
        self.assertIn("Form 1A", str(cls))


class TeacherModelTest(TestCase):

    """Represents TeacherModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()

    def test_teacher_creation(self):
        """Test that teacher creation."""
        teacher = make_teacher(self.school)
        self.assertIsNotNone(teacher.pk)
        self.assertEqual(teacher.user.role, "teacher")

    def test_teacher_str(self):
        """Test that teacher str."""
        teacher = make_teacher(self.school, username="tstr")
        self.assertIn("Teacher", str(teacher))

    def test_teacher_can_have_subjects(self):
        """Test that teacher can have subjects."""
        teacher = make_teacher(self.school)
        subj = make_subject(self.school)
        teacher.subjects_taught.add(subj)
        self.assertIn(subj, teacher.subjects_taught.all())


class StudentModelTest(TestCase):

    """Represents StudentModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.cls = make_class(self.school)

    def test_student_creation(self):
        """Test that student creation."""
        student = make_student(self.school, self.cls)
        self.assertIsNotNone(student.pk)
        self.assertEqual(student.student_class, self.cls)

    def test_student_str(self):
        """Test that student str."""
        student = make_student(self.school, self.cls)
        self.assertIn("STU001", str(student))


class ResultModelTest(TestCase):

    """Represents ResultModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.cls = make_class(self.school)
        self.teacher = make_teacher(self.school, username="res_teacher")
        self.subject = make_subject(self.school)
        self.student = make_student(self.school, self.cls, username="res_student")

    def test_result_creation(self):
        """Test that result creation."""
        result = Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Midterm",
            score=75.0,
            max_score=100.0,
            academic_term="Term 1",
            academic_year="2026",
        )
        self.assertIsNotNone(result.pk)
        self.assertEqual(result.score, 75.0)

    def test_result_percentage_property(self):
        """Test that result percentage property."""
        result = Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Final",
            score=80.0,
            max_score=100.0,
            academic_term="Term 1",
            academic_year="2026",
        )
        self.assertAlmostEqual(result.percentage, 80.0)

    def test_result_str(self):
        """Test that result str."""
        result = Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Quiz",
            score=60.0,
            max_score=80.0,
            academic_term="Term 2",
            academic_year="2026",
        )
        self.assertIn("Mathematics", str(result))


class AssignmentSubmissionModelTest(TestCase):

    """Represents AssignmentSubmissionModelTest."""
    def setUp(self):
        """Execute setUp."""
        self.school = make_school()
        self.cls = make_class(self.school)
        self.teacher = make_teacher(self.school, username="asub_teacher")
        self.subject = make_subject(self.school)
        self.student = make_student(self.school, self.cls, username="asub_student")
        self.assignment = Assignment.objects.create(
            title="Essay on History",
            description="Write 500 words",
            subject=self.subject,
            teacher=self.teacher,
            assigned_class=self.cls,
            deadline=datetime.datetime(2026, 6, 30, 23, 59),
        )

    def test_assignment_submission_creation(self):
        """Test that assignment submission creation."""
        sub = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_submission="My essay here.",
            status="submitted",
        )
        self.assertIsNotNone(sub.pk)
        self.assertEqual(sub.status, "submitted")
        self.assertIsNone(sub.grade)

    def test_submission_str(self):
        """Test that submission str."""
        sub = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_submission="Test content",
        )
        self.assertIn(self.student.user.full_name, str(sub))
        self.assertIn(self.assignment.title, str(sub))

    def test_submission_unique_per_student_assignment(self):
        """Test that submission unique per student assignment."""
        AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_submission="First",
        )
        with self.assertRaises(Exception):
            AssignmentSubmission.objects.create(
                assignment=self.assignment,
                student=self.student,
                text_submission="Duplicate",
            )


# ---------------------------------------------------------------------------
# API tests — Subjects
# ---------------------------------------------------------------------------

class SubjectAPITest(APITestCase):

    """Represents SubjectAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "subj_admin", role="admin")
        self.url = "/api/v1/academics/subjects/"

    def test_list_subjects_returns_200(self):
        """Test that list subjects returns 200."""
        make_subject(self.school)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_subjects_scoped_to_school(self):
        """Test that list subjects scoped to school."""
        make_subject(self.school, name="Math", code="M01")
        other_school = make_school(name="Other School")
        make_subject(other_school, name="Science", code="S01")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        # Only this school's subjects should be returned
        names = [s["name"] for s in get_list(response.data)]
        self.assertIn("Math", names)
        self.assertNotIn("Science", names)

    def test_create_subject_as_admin_returns_201(self):
        """Test that create subject as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "name": "Physics",
            "code": "PHY01",
            "ca_weight": 0.3,
            "exam_weight": 0.7,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Physics")

    def test_create_subject_assigns_school_automatically(self):
        """Test that create subject assigns school automatically."""
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, {
            "name": "Chemistry",
            "code": "CHEM01",
        }, format="json")
        self.assertTrue(Subject.objects.filter(code="CHEM01", school=self.school).exists())

    def test_list_subjects_requires_authentication(self):
        """Test that list subjects requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Students
# ---------------------------------------------------------------------------

class StudentAPITest(APITestCase):

    """Represents StudentAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "stu_admin", role="admin")
        self.cls = make_class(self.school, name="Form 2B", grade_level=2)
        self.url = "/api/v1/academics/students/"

    def test_list_students_returns_200(self):
        """Test that list students returns 200."""
        make_student(self.school, self.cls)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_students_scoped_to_school(self):
        """Test that list students scoped to school."""
        make_student(self.school, self.cls, username="stu_mine", student_number="S001")
        other_school = make_school(name="Other")
        other_cls = make_class(other_school, name="OtherClass", grade_level=1)
        make_student(other_school, other_cls, username="stu_other", student_number="S999")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        # S999 should not appear; student_number is nested inside user dict
        numbers = [s["user"]["student_number"] for s in get_list(response.data)]
        self.assertIn("S001", numbers)
        self.assertNotIn("S999", numbers)

    def test_create_student_as_admin_returns_201(self):
        """Test that create student as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "user": {
                "first_name": "Alice",
                "last_name": "Smith",
                "password": "testpass123",
            },
            "student_class": self.cls.pk,
            "admission_date": "2026-01-10",
            "gender": "Female",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_filter_students_by_class(self):
        """Test that filter students by class."""
        cls2 = make_class(self.school, name="Form 3A", grade_level=3)
        make_student(self.school, self.cls, username="stu_c1", student_number="C1001")
        make_student(self.school, cls2, username="stu_c2", student_number="C2001")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"class": self.cls.pk})
        numbers = [s["user"]["student_number"] for s in get_list(response.data)]
        self.assertIn("C1001", numbers)
        self.assertNotIn("C2001", numbers)

    def test_list_students_requires_authentication(self):
        """Test that list students requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Results
# ---------------------------------------------------------------------------

class ResultAPITest(APITestCase):

    """Represents ResultAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "res_admin", role="admin")
        self.teacher = make_teacher(self.school, username="res_api_teacher")
        self.subject = make_subject(self.school)
        self.cls = make_class(self.school)
        self.student = make_student(self.school, self.cls, username="res_api_student")
        self.url = "/api/v1/academics/results/"

    def test_list_results_returns_200(self):
        """Test that list results returns 200."""
        Result.objects.create(
            student=self.student, subject=self.subject, teacher=self.teacher,
            exam_type="Midterm", score=70, max_score=100,
            academic_term="Term 1", academic_year="2026",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_result_as_admin_returns_201(self):
        """Test that create result as admin returns 201."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "student": self.student.pk,
            "subject": self.subject.pk,
            "teacher": self.teacher.pk,
            "exam_type": "Final",
            "score": 85,
            "max_score": 100,
            "academic_term": "Term 1",
            "academic_year": "2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["score"], 85.0)

    def test_list_results_filtered_by_student(self):
        """Test that list results filtered by student."""
        student2_user = make_user(self.school, "res_stu2", role="student")
        student2 = Student.objects.create(
            user=student2_user, student_class=self.cls,
            admission_date=datetime.date(2024, 1, 1),
        )
        Result.objects.create(
            student=self.student, subject=self.subject, teacher=self.teacher,
            exam_type="Quiz", score=50, max_score=100,
            academic_term="Term 1", academic_year="2026",
        )
        Result.objects.create(
            student=student2, subject=self.subject, teacher=self.teacher,
            exam_type="Quiz", score=60, max_score=100,
            academic_term="Term 1", academic_year="2026",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"student": self.student.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student_ids = {r["student"] for r in get_list(response.data)}
        self.assertEqual(student_ids, {self.student.pk})

    def test_list_results_requires_authentication(self):
        """Test that list results requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Timetable
# ---------------------------------------------------------------------------

class TimetableAPITest(APITestCase):

    """Represents TimetableAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "tt_admin", role="admin")
        self.teacher = make_teacher(self.school, username="tt_teacher")
        self.subject = make_subject(self.school)
        self.cls = make_class(self.school)
        self.list_url = "/api/v1/academics/timetables/"
        self.conflicts_url = "/api/v1/academics/timetables/conflicts/"

    def _create_timetable_entry(self, day="Monday",
                                 start="08:00", end="08:45", room="101"):
        """Execute create timetable entry."""
        return Timetable.objects.create(
            class_assigned=self.cls,
            subject=self.subject,
            teacher=self.teacher,
            day_of_week=day,
            start_time=start,
            end_time=end,
            room=room,
        )

    def test_list_timetables_returns_200(self):
        """Test that list timetables returns 200."""
        self._create_timetable_entry()
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_timetables_filtered_by_class(self):
        """Test that list timetables filtered by class."""
        cls2 = make_class(self.school, name="Form 2B", grade_level=2)
        self._create_timetable_entry()
        Timetable.objects.create(
            class_assigned=cls2, subject=self.subject,
            teacher=self.teacher, day_of_week="Tuesday",
            start_time="09:00", end_time="09:45",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.list_url, {"class": self.cls.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for entry in get_list(response.data):
            self.assertEqual(entry["class_assigned"], self.cls.pk)

    def test_list_timetables_requires_authentication(self):
        """Test that list timetables requires authentication."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_conflict_check_admin_only(self):
        """Test that conflict check admin only."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.conflicts_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("conflicts", response.data)

    def test_conflict_check_detects_teacher_double_booking(self):
        # Two overlapping slots for the same teacher on same day
        """Test that conflict check detects teacher double booking."""
        self._create_timetable_entry(day="Monday", start="08:00", end="08:45")
        Timetable.objects.create(
            class_assigned=self.cls,
            subject=self.subject,
            teacher=self.teacher,
            day_of_week="Monday",
            start_time="08:30",
            end_time="09:15",
            room="102",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.conflicts_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conflict_types = [c["type"] for c in response.data["conflicts"]]
        self.assertIn("teacher", conflict_types)

    def test_conflict_check_forbidden_for_teacher_role(self):
        """Test that conflict check forbidden for teacher role."""
        teacher_user = self.teacher.user
        teacher_user.role = "teacher"
        teacher_user.save()
        self.client.force_authenticate(user=teacher_user)
        response = self.client.get(self.conflicts_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Student attendance (student portal)
# ---------------------------------------------------------------------------

class StudentAttendanceAPITest(APITestCase):

    """Represents StudentAttendanceAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "att_admin", role="admin")
        self.cls = make_class(self.school)
        self.student = make_student(
            self.school, self.cls, username="att_student", student_number="ATT001"
        )
        self.student_user = self.student.user
        self.student_user.role = "student"
        self.student_user.save()

        ClassAttendance.objects.create(
            student=self.student,
            class_assigned=self.cls,
            date=datetime.date(2026, 3, 1),
            status="present",
            recorded_by=self.admin,
        )
        self.url = "/api/v1/students/attendance/"

    def test_student_can_view_own_attendance(self):
        """Test that student can view own attendance."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_attendance_response_contains_records(self):
        """Test that attendance response contains records."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The response body should contain attendance information
        self.assertIsNotNone(response.data)

    def test_attendance_requires_authentication(self):
        """Test that attendance requires authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# API tests — Grade prediction
# ---------------------------------------------------------------------------

class GradePredictionAPITest(APITestCase):

    """Represents GradePredictionAPITest."""
    def setUp(self):
        """Execute setUp."""
        self.client = APIClient()
        self.school = make_school()
        self.admin = make_user(self.school, "pred_admin", role="admin")
        self.teacher = make_teacher(self.school, username="pred_teacher")
        self.cls = make_class(self.school)
        self.student = make_student(
            self.school, self.cls, username="pred_student", student_number="PRD001"
        )
        self.subject = make_subject(self.school)

    def _url(self, student_id):
        """Execute url."""
        return f"/api/v1/academics/students/{student_id}/grade-prediction/"

    @patch("academics.ml_predictions.predict_student_grades", return_value=[
        {"subject": "Mathematics", "predicted_percentage": 82.5, "trend": "improving"}
    ])
    def test_grade_prediction_returns_200(self, mock_predict):
        """Test that grade prediction returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url(self.student.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("predictions", response.data)
        self.assertIn("student", response.data)

    @patch("academics.ml_predictions.predict_student_grades", return_value=[])
    def test_grade_prediction_404_for_unknown_student(self, mock_predict):
        """Test that grade prediction 404 for unknown student."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url(99999))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("academics.ml_predictions.predict_student_grades", return_value=[])
    def test_grade_prediction_forbidden_for_hr_role(self, mock_predict):
        """Test that grade prediction forbidden for hr role."""
        hr_user = make_user(self.school, "pred_hr", role="hr")
        self.client.force_authenticate(user=hr_user)
        response = self.client.get(self._url(self.student.pk))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("academics.ml_predictions.predict_student_grades", return_value=[])
    def test_grade_prediction_requires_authentication(self, mock_predict):
        """Test that grade prediction requires authentication."""
        response = self.client.get(self._url(self.student.pk))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
