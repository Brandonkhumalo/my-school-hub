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
import csv
import io
import json
import urllib.error
from unittest.mock import patch

from django.core.signing import TimestampSigner
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import CustomUser, School, SchoolSettings
from academics.utils import apply_late_penalty
from academics.models import (
    Announcement,
    AnnouncementDismissal,
    Assignment,
    AssignmentSubmission,
    GeneratedTest,
    TestQuestion,
    TestAttempt,
    TestAnswer,
    ClassAttendance,
    Class,
    Parent,
    ParentChildLink,
    ParentTeacherMessage,
    ReportCardApprovalRequest,
    ReportCardDeliveryExclusion,
    ReportCardGeneration,
    ReportCardRelease,
    Result,
    Suspension,
    Student,
    Subject,
    Teacher,
    Timetable,
)
from finances.models import SchoolFees, StudentPaymentRecord


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


class ParentLinkAndMessagingPolicyTests(APITestCase):
    def setUp(self):
        self.school = make_school("Policy School")
        self.other_school = make_school("Other Policy School")
        self.admin = make_user(self.school, "policy_admin", role="admin")
        self.client.force_authenticate(self.admin)

    def test_parent_link_request_rejects_when_student_already_has_three_parents(self):
        class_obj = make_class(self.school, name="Form 2A")
        student = make_student(self.school, class_obj, username="policy_student", student_number="STU900")

        # Seed 3 confirmed parent links.
        for idx in range(3):
            p_user = make_user(self.school, f"seed_parent_{idx}", role="parent")
            parent = Parent.objects.create(user=p_user)
            parent.children.add(student)
            ParentChildLink.objects.create(parent=parent, student=student, is_confirmed=True)

        request_parent_user = make_user(self.school, "request_parent", role="parent")
        request_parent = Parent.objects.create(user=request_parent_user)
        self.client.force_authenticate(request_parent_user)

        response = self.client.post("/api/v1/parents/children/request/", {"student_id": student.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maximum of 3 parents", str(response.data.get("error", "")))

        # Silence unused variable warning in static checkers.
        self.assertIsNotNone(request_parent.id)

    def test_admin_conversation_list_is_school_scoped_with_stats(self):
        teacher_user = make_user(self.school, "policy_teacher", role="teacher", first_name="Tea", last_name="Cher")
        parent_user = make_user(self.school, "policy_parent", role="parent", first_name="Par", last_name="Ent")
        Parent.objects.create(user=parent_user)

        other_parent_user = make_user(self.other_school, "other_parent", role="parent", first_name="Other", last_name="Parent")
        Parent.objects.create(user=other_parent_user)

        ParentTeacherMessage.objects.create(
            sender=teacher_user,
            recipient=parent_user,
            subject="Allowed",
            message="Visible thread",
        )
        ParentTeacherMessage.objects.create(
            sender=teacher_user,
            recipient=other_parent_user,
            subject="Blocked",
            message="Should be excluded",
        )

        response = self.client.get("/api/v1/admin/conversations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("threads", response.data)
        self.assertIn("stats", response.data)
        self.assertEqual(len(response.data["threads"]), 1)
        self.assertEqual(response.data["stats"]["returned_threads"], 1)
        self.assertGreaterEqual(response.data["stats"]["excluded_school_mismatch"], 1)

    @patch("academics.parent_views.check_rate_limit", return_value=True)
    def test_parent_link_request_rate_limit_returns_429(self, _mock_limited):
        parent_user = make_user(self.school, "rate_parent", role="parent")
        Parent.objects.create(user=parent_user)
        self.client.force_authenticate(parent_user)

        class_obj = make_class(self.school, name="Form 3A")
        student = make_student(self.school, class_obj, username="rate_student", student_number="STU901")
        response = self.client.post("/api/v1/parents/children/request/", {"student_id": student.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


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
# API tests — Assignment submissions (teacher ownership)
# ---------------------------------------------------------------------------

class AssignmentSubmissionOwnershipAPITest(APITestCase):
    """Assignment submission endpoints must scope by assignment.teacher."""

    def setUp(self):
        self.client = APIClient()
        self.school = make_school()
        self.cls = make_class(self.school)
        self.subject = make_subject(self.school, code="OWN01")
        self.owner_teacher = make_teacher(self.school, username="owner_teacher")
        self.other_teacher = make_teacher(self.school, username="other_teacher")
        self.student = make_student(self.school, self.cls, username="owner_student", student_number="OWN001")
        self.assignment = Assignment.objects.create(
            title="Ownership Test Assignment",
            description="Ensure teacher ownership filtering works.",
            subject=self.subject,
            teacher=self.owner_teacher,
            assigned_class=self.cls,
            deadline=timezone.now() + datetime.timedelta(days=2),
        )
        AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_submission="My submission",
            status="submitted",
        )
        self.url = f"/api/v1/teachers/assignments/{self.assignment.id}/submissions/"

    def test_owner_teacher_can_list_submissions(self):
        self.client.force_authenticate(user=self.owner_teacher.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("assignment_id"), self.assignment.id)
        self.assertEqual(response.data.get("submitted_count"), 1)

    def test_non_owner_teacher_gets_not_found(self):
        self.client.force_authenticate(user=self.other_teacher.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AssignmentLatePenaltyAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Penalty School")
        self.cls = make_class(self.school, name="Form 2B")
        self.subject = make_subject(self.school, code="PEN01")
        self.teacher = make_teacher(self.school, username="pen_teacher")
        self.student = make_student(self.school, self.cls, username="pen_student", student_number="PEN001")
        self.assignment = Assignment.objects.create(
            school=self.school,
            title="Penalty Assignment",
            description="Test late penalties",
            subject=self.subject,
            teacher=self.teacher,
            assigned_class=self.cls,
            deadline=timezone.now() - datetime.timedelta(days=1),
            max_score=100,
            allow_late=False,
        )

    def test_student_submit_rejected_when_late_not_allowed(self):
        self.client.force_authenticate(user=self.student.user)
        response = self.client.post(
            f"/api/v1/students/assignments/{self.assignment.id}/submit/",
            {"text_submission": "late work"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("late submissions", str(response.data.get("error", "")).lower())

    def test_grade_submission_applies_penalty(self):
        self.assignment.allow_late = True
        self.assignment.save(update_fields=["allow_late"])
        submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_submission="late work",
            status="late",
            is_late=True,
        )
        SchoolSettings.objects.update_or_create(
            school=self.school,
            defaults={
                "late_assignment_penalty_mode": "percentage",
                "late_assignment_penalty_percent": 10,
            },
        )
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(
            f"/api/v1/teachers/submissions/{submission.id}/grade/",
            {"grade": 80, "feedback": "graded"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        submission.refresh_from_db()
        self.assertEqual(submission.grade, 72.0)
        self.assertEqual(response.data.get("penalty_points"), 8.0)


class AssignmentPenaltyUtilsTest(TestCase):
    def test_apply_late_penalty_percentage_mode(self):
        final_grade, penalty_points = apply_late_penalty(80, 100, mode="percentage", percent=10)
        self.assertEqual(final_grade, 72.0)
        self.assertEqual(penalty_points, 8.0)


class GeneratedTestFinalizeWritebackAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Generated Tests School")
        self.teacher = make_teacher(self.school, username="gt_teacher")
        self.cls = make_class(self.school, name="Form 3B", grade_level=10, year="2026")
        self.subject = make_subject(self.school, name="Geography", code="GEO01")
        self.student = make_student(self.school, self.cls, username="gt_student", student_number="GT001")
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])

        self.test = GeneratedTest.objects.create(
            school=self.school,
            subject=self.subject,
            level_kind="form",
            level_number=10,
            title="Generated Geography Test",
            duration_minutes=45,
            total_marks=20,
            created_by=self.teacher,
            status="published",
            counts_for_report=False,
            academic_year="2026",
            academic_term="Term 1",
        )
        TestQuestion.objects.create(
            test=self.test,
            order=1,
            prompt_text="Capital city?",
            marks=20,
            question_type="short",
            correct_answer="Harare",
        )
        self.attempt = TestAttempt.objects.create(
            test=self.test,
            student=self.student,
            auto_score=15,
            manual_score=0,
            final_score=15,
            status="graded",
            submitted_at=timezone.now(),
        )

    def test_finalize_pushes_results_and_marks_attempt(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(
            f"/api/v1/teachers/tests/{self.test.id}/finalize/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.attempt.refresh_from_db()
        self.test.refresh_from_db()
        self.assertTrue(self.attempt.pushed_to_results)
        self.assertEqual(self.attempt.status, "finalized")
        self.assertEqual(self.test.status, "closed")
        self.assertTrue(
            Result.objects.filter(
                student=self.student,
                subject=self.subject,
                teacher=self.teacher,
                exam_type="test",
                academic_year="2026",
                academic_term="Term 1",
            ).exists()
        )


class GeneratedTestAttemptGradingAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Generated Grading School")
        self.teacher = make_teacher(self.school, username="gg_teacher")
        self.cls = make_class(self.school, name="Form 4A", grade_level=11, year="2026")
        self.subject = make_subject(self.school, name="History", code="HIS01")
        self.student = make_student(self.school, self.cls, username="gg_student", student_number="GG001")

        self.test = GeneratedTest.objects.create(
            school=self.school,
            subject=self.subject,
            level_kind="form",
            level_number=11,
            title="Generated History Test",
            duration_minutes=60,
            total_marks=30,
            created_by=self.teacher,
            status="published",
            academic_year="2026",
            academic_term="Term 2",
        )
        self.long_question = TestQuestion.objects.create(
            test=self.test,
            order=1,
            prompt_text="Explain the causes.",
            marks=10,
            question_type="long",
        )
        self.short_question = TestQuestion.objects.create(
            test=self.test,
            order=2,
            prompt_text="Year of independence?",
            marks=5,
            question_type="short",
            correct_answer="1980",
        )
        self.attempt = TestAttempt.objects.create(
            test=self.test,
            student=self.student,
            auto_score=5,
            manual_score=0,
            final_score=5,
            status="submitted",
            submitted_at=timezone.now(),
        )
        TestAnswer.objects.create(
            attempt=self.attempt,
            question=self.long_question,
            answer_text="Student long response",
            awarded_marks=0,
        )
        TestAnswer.objects.create(
            attempt=self.attempt,
            question=self.short_question,
            answer_text="1980",
            awarded_marks=5,
        )

    def test_teacher_can_get_attempt_detail_and_grade_long_answers(self):
        self.client.force_authenticate(user=self.teacher.user)
        detail = self.client.get(f"/api/v1/teachers/attempts/{self.attempt.id}/grade/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data.get("attempt_id"), self.attempt.id)
        self.assertEqual(len(detail.data.get("questions", [])), 2)

        grade = self.client.post(
            f"/api/v1/teachers/attempts/{self.attempt.id}/grade/",
            {
                "answers": [
                    {
                        "question_id": self.long_question.id,
                        "awarded_marks": 8,
                        "teacher_comment": "Good structure",
                    }
                ],
                "finalize": True,
            },
            format="json",
        )
        self.assertEqual(grade.status_code, status.HTTP_200_OK)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.manual_score, 8.0)
        self.assertEqual(self.attempt.final_score, 13.0)
        self.assertEqual(self.attempt.status, "finalized")


class GoServicesUrlResolutionTests(TestCase):
    def test_teacher_views_go_services_url_precedence(self):
        from academics import teacher_views

        cases = [
            (
                {'GO_SERVICES_INTERNAL_URL': 'http://internal:8082', 'GO_SERVICES_UPSTREAM': 'http://upstream:8082', 'GO_SERVICES_URL': 'http://url:8082'},
                'http://internal:8082',
            ),
            (
                {'GO_SERVICES_UPSTREAM': 'http://upstream:8082', 'GO_SERVICES_URL': 'http://url:8082'},
                'http://upstream:8082',
            ),
            (
                {'GO_SERVICES_URL': 'http://url:8082'},
                'http://url:8082',
            ),
            ({}, 'http://localhost:8082'),
        ]

        for env_map, expected in cases:
            with self.subTest(expected=expected):
                with patch.dict('os.environ', env_map, clear=True):
                    self.assertEqual(teacher_views._go_services_base_url(), expected)

    def test_papers_views_go_services_url_precedence(self):
        from academics import papers_views

        cases = [
            (
                {'GO_SERVICES_INTERNAL_URL': 'http://internal:8082', 'GO_SERVICES_UPSTREAM': 'http://upstream:8082', 'GO_SERVICES_URL': 'http://url:8082'},
                'http://internal:8082',
            ),
            (
                {'GO_SERVICES_UPSTREAM': 'http://upstream:8082', 'GO_SERVICES_URL': 'http://url:8082'},
                'http://upstream:8082',
            ),
            (
                {'GO_SERVICES_URL': 'http://url:8082'},
                'http://url:8082',
            ),
            ({}, 'http://localhost:8082'),
        ]

        for env_map, expected in cases:
            with self.subTest(expected=expected):
                with patch.dict('os.environ', env_map, clear=True):
                    self.assertEqual(papers_views._go_services_base_url(), expected)


class GenerateTestFromPaperUpstreamAPITest(APITestCase):
    def setUp(self):
        self.school = make_school("Paper Extract School")
        self.teacher = make_teacher(self.school, username="extract_teacher")
        self.subject = make_subject(self.school, name="Science", code="SCI01")
        self.subject_alt = make_subject(self.school, name="History", code="HIS77")
        self.client.force_authenticate(self.teacher.user)

        from academics.models import PastExamPaper
        self.paper = PastExamPaper.objects.create(
            school=self.school,
            subject=self.subject,
            level_kind='form',
            level_number=2,
            year=2025,
            exam_session='June',
            paper_number=1,
            title='Form 2 Science June 2025',
            uploaded_by=self.teacher,
            file_key=f"{self.school.id}/science-paper.pdf",
            original_filename='science-paper.pdf',
            mime_type='application/pdf',
            size_bytes=1024,
            page_count=3,
        )
        self.paper_2 = PastExamPaper.objects.create(
            school=self.school,
            subject=self.subject,
            level_kind='form',
            level_number=2,
            year=2024,
            exam_session='November',
            paper_number=2,
            title='Form 2 Science Nov 2024',
            uploaded_by=self.teacher,
            file_key=f"{self.school.id}/science-paper-2.pdf",
            original_filename='science-paper-2.pdf',
            mime_type='application/pdf',
            size_bytes=1024,
            page_count=2,
        )
        self.paper_other_subject = PastExamPaper.objects.create(
            school=self.school,
            subject=self.subject_alt,
            level_kind='form',
            level_number=2,
            year=2025,
            exam_session='June',
            paper_number=1,
            title='Form 2 History June 2025',
            uploaded_by=self.teacher,
            file_key=f"{self.school.id}/history-paper.pdf",
            original_filename='history-paper.pdf',
            mime_type='application/pdf',
            size_bytes=1024,
            page_count=3,
        )

    @patch('academics.teacher_views.urllib.request.urlopen')
    def test_generate_from_paper_returns_201_when_extraction_succeeds(self, mock_urlopen):
        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps({
                    'questions': [
                        {'prompt_text': 'What is photosynthesis?', 'marks': 5, 'question_type': 'short', 'source_page': 1}
                    ]
                }).encode('utf-8')

        mock_urlopen.return_value = _Resp()

        response = self.client.post(
            "/api/v1/teachers/tests/generate-from-paper/",
            {'source_paper_ids': [self.paper.id], 'title': 'Generated Science Test', 'duration_minutes': 60},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('test', response.data)
        self.assertEqual(response.data['test']['title'], 'Generated Science Test')

    @patch('academics.teacher_views.urllib.request.urlopen')
    def test_generate_from_multiple_papers_returns_201(self, mock_urlopen):
        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps({
                    'questions': [
                        {'prompt_text': 'What is photosynthesis?', 'marks': 5, 'question_type': 'short', 'source_page': 1}
                    ]
                }).encode('utf-8')

        mock_urlopen.return_value = _Resp()

        response = self.client.post(
            "/api/v1/teachers/tests/generate-from-paper/",
            {'source_paper_ids': [self.paper.id, self.paper_2.id], 'title': 'Generated Science Test', 'duration_minutes': 60},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        questions = response.data.get('test', {}).get('questions', [])
        self.assertEqual(len(questions), 2)

    @patch('academics.teacher_views.urllib.request.urlopen', side_effect=urllib.error.URLError("connection refused"))
    def test_generate_from_paper_returns_503_when_extraction_unreachable(self, _mock_urlopen):
        response = self.client.post(
            "/api/v1/teachers/tests/generate-from-paper/",
            {'source_paper_ids': [self.paper.id], 'title': 'Generated Science Test', 'duration_minutes': 60},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('go-services unreachable', str(response.data.get('error', '')))

    def test_generate_from_multiple_papers_rejects_mixed_subjects(self):
        response = self.client.post(
            "/api/v1/teachers/tests/generate-from-paper/",
            {'source_paper_ids': [self.paper.id, self.paper_other_subject.id], 'title': 'Generated Mixed Test', 'duration_minutes': 60},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('same subject and form/grade', str(response.data.get('error', '')))


class TeacherTestsListAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Teacher Tests List School")
        self.teacher = make_teacher(self.school, username="ttl_teacher")
        self.other_teacher = make_teacher(self.school, username="ttl_other_teacher")
        self.subject1 = make_subject(self.school, name="Mathematics", code="TTL01")
        self.subject2 = make_subject(self.school, name="Biology", code="TTL02")
        self.test1 = GeneratedTest.objects.create(
            school=self.school,
            subject=self.subject1,
            level_kind="form",
            level_number=4,
            title="Midterm Algebra",
            duration_minutes=45,
            total_marks=50,
            created_by=self.teacher,
            status="published",
            academic_year="2026",
            academic_term="Term 2",
        )
        self.test2 = GeneratedTest.objects.create(
            school=self.school,
            subject=self.subject2,
            level_kind="form",
            level_number=4,
            title="Draft Cell Biology",
            duration_minutes=30,
            total_marks=30,
            created_by=self.teacher,
            status="draft",
            academic_year="2026",
            academic_term="Term 2",
        )
        GeneratedTest.objects.create(
            school=self.school,
            subject=self.subject1,
            level_kind="form",
            level_number=4,
            title="Other Teacher Test",
            duration_minutes=20,
            total_marks=20,
            created_by=self.other_teacher,
            status="published",
            academic_year="2026",
            academic_term="Term 1",
        )

    def test_teacher_tests_list_is_scoped_and_filterable(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.get("/api/v1/teachers/tests/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pagination", response.data)
        ids = [row["id"] for row in response.data.get("tests", [])]
        self.assertIn(self.test1.id, ids)
        self.assertIn(self.test2.id, ids)
        self.assertEqual(len(ids), 2)

        published = self.client.get("/api/v1/teachers/tests/?status=published")
        self.assertEqual(published.status_code, status.HTTP_200_OK)
        published_ids = [row["id"] for row in published.data.get("tests", [])]
        self.assertEqual(published_ids, [self.test1.id])

        search = self.client.get("/api/v1/teachers/tests/?q=algebra")
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        search_ids = [row["id"] for row in search.data.get("tests", [])]
        self.assertEqual(search_ids, [self.test1.id])


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

    def test_update_student_class_requires_explicit_change_confirmation(self):
        """Student class should not change without explicit change_class flag."""
        student = make_student(self.school, self.cls, username="stu_move_guard", student_number="MOVE001")
        cls2 = make_class(self.school, name="Form 3B", grade_level=3)

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/v1/academics/students/{student.id}/",
            {"student_class": cls2.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        student.refresh_from_db()
        self.assertEqual(student.student_class_id, self.cls.id)

    def test_update_student_class_with_change_flag_succeeds(self):
        """Student class should change only when explicitly confirmed."""
        student = make_student(self.school, self.cls, username="stu_move_ok", student_number="MOVE002")
        cls2 = make_class(self.school, name="Form 4A", grade_level=4)

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/v1/academics/students/{student.id}/",
            {"student_class": cls2.id, "change_class": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student.refresh_from_db()
        self.assertEqual(student.student_class_id, cls2.id)


# ---------------------------------------------------------------------------
# API tests — Promotions
# ---------------------------------------------------------------------------

class PromotionAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Promotion School")
        self.admin = make_user(self.school, "promo_admin", role="admin")
        self.cls_form1_2026 = make_class(self.school, name="Form 1A", grade_level=1, year="2026")
        self.cls_form2_2026 = make_class(self.school, name="Form 2A", grade_level=2, year="2026")
        self.cls_form2_2025 = make_class(self.school, name="Form 2A Legacy", grade_level=2, year="2025")
        self.student = make_student(
            self.school, self.cls_form1_2026, username="promo_student", student_number="PROMO001"
        )
        self.preview_url = "/api/v1/academics/promotions/preview/"
        self.process_url = "/api/v1/academics/promotions/"

    def test_preview_rejects_class_year_mismatch(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.preview_url, {
            "class_id": self.cls_form1_2026.id,
            "academic_year": "2025",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_suggests_next_class_from_same_academic_year(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.preview_url, {
            "class_id": self.cls_form1_2026.id,
            "academic_year": "2026",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student_preview = response.data["students"][0]
        self.assertEqual(student_preview["suggested_to_class"]["id"], self.cls_form2_2026.id)
        self.assertFalse(student_preview["requires_manual_target"])

    def test_preview_requires_manual_target_when_multiple_next_classes_exist(self):
        make_class(self.school, name="Form 2B", grade_level=2, year="2026")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.preview_url, {
            "class_id": self.cls_form1_2026.id,
            "academic_year": "2026",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student_preview = response.data["students"][0]
        self.assertIsNone(student_preview["suggested_to_class"])
        self.assertTrue(student_preview["requires_manual_target"])
        self.assertGreaterEqual(len(student_preview["candidate_next_classes"]), 2)

    def test_process_requires_explicit_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.process_url, {
            "academic_year": "2026",
            "promotions": [{
                "student_id": self.student.id,
                "action": "promote",
                "to_class_id": self.cls_form2_2026.id,
                "from_class_id": self.cls_form1_2026.id,
            }],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.student.refresh_from_db()
        self.assertEqual(self.student.student_class_id, self.cls_form1_2026.id)

    def test_process_rejects_wrong_year_target_class(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.process_url, {
            "academic_year": "2026",
            "confirm_class_changes": True,
            "promotions": [{
                "student_id": self.student.id,
                "action": "promote",
                "to_class_id": self.cls_form2_2025.id,
                "from_class_id": self.cls_form1_2026.id,
            }],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["promoted"], 0)
        self.assertGreaterEqual(len(response.data["summary"]["errors"]), 1)
        self.student.refresh_from_db()
        self.assertEqual(self.student.student_class_id, self.cls_form1_2026.id)

    def test_process_promotes_student_when_confirmed_and_validated(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.process_url, {
            "academic_year": "2026",
            "confirm_class_changes": True,
            "promotions": [{
                "student_id": self.student.id,
                "action": "promote",
                "to_class_id": self.cls_form2_2026.id,
                "from_class_id": self.cls_form1_2026.id,
            }],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["promoted"], 1)
        self.student.refresh_from_db()
        self.assertEqual(self.student.student_class_id, self.cls_form2_2026.id)


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
# API tests — Permissions for announcements & suspensions
# ---------------------------------------------------------------------------

class AnnouncementSuspensionPermissionAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Permission School")
        self.admin = make_user(self.school, "perm_admin", role="admin")
        self.hr = make_user(self.school, "perm_hr", role="hr")
        self.teacher = make_teacher(self.school, username="perm_teacher")
        self.cls = make_class(self.school, teacher_user=self.teacher.user, name="Form 3A", grade_level=10)
        self.student = make_student(self.school, self.cls, username="perm_student", student_number="PERM001")

        self.announcements_url = "/api/v1/academics/announcements/"
        self.suspensions_url = "/api/v1/academics/suspensions/"

    def test_teacher_cannot_create_announcement(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.announcements_url, {
            "title": "Staff Notice",
            "content": "Teachers meeting after class.",
            "target_audience": "all",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Announcement.objects.count(), 0)

    def test_hr_can_create_announcement(self):
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self.announcements_url, {
            "title": "HR Notice",
            "content": "Updated school policy.",
            "target_audience": "all",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Announcement.objects.count(), 1)

    def test_hr_can_create_multi_audience_announcement(self):
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self.announcements_url, {
            "title": "Audience Notice",
            "content": "Important for students, parents and teachers.",
            "target_audiences": ["student", "parent", "teacher"],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        announcement = Announcement.objects.get(id=response.data["id"])
        self.assertEqual(announcement.target_audiences, ["student", "parent", "teacher"])

    def test_hr_can_create_announcement_with_duration_days(self):
        self.client.force_authenticate(user=self.hr)
        response = self.client.post(self.announcements_url, {
            "title": "Limited Notice",
            "content": "This announcement expires soon.",
            "target_audience": "all",
            "duration_days": 2,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        announcement = Announcement.objects.get(id=response.data["id"])
        self.assertIsNotNone(announcement.expires_at)
        self.assertGreater(announcement.expires_at, timezone.now())

    def test_author_can_delete_own_announcement(self):
        announcement = Announcement.objects.create(
            title="Own Notice",
            content="Delete me",
            author=self.hr,
            target_audience="all",
            target_audiences=["all"],
        )
        self.client.force_authenticate(user=self.hr)
        response = self.client.delete(f"{self.announcements_url}{announcement.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Announcement.objects.filter(id=announcement.id).exists())

    def test_non_author_teacher_cannot_delete_announcement(self):
        announcement = Announcement.objects.create(
            title="School Notice",
            content="Cannot delete",
            author=self.hr,
            target_audience="all",
            target_audiences=["all"],
        )
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.delete(f"{self.announcements_url}{announcement.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Announcement.objects.filter(id=announcement.id).exists())

    def test_teacher_can_clear_announcement_from_own_feed(self):
        announcement = Announcement.objects.create(
            title="General Notice",
            content="Visible to everyone",
            author=self.hr,
            target_audience="all",
            target_audiences=["all"],
        )
        self.client.force_authenticate(user=self.teacher.user)
        list_before = self.client.get(self.announcements_url, format="json")
        ids_before = [item["id"] for item in get_list(list_before.data)]
        self.assertIn(announcement.id, ids_before)

        dismiss_response = self.client.post(f"{self.announcements_url}{announcement.id}/dismiss/", {}, format="json")
        self.assertEqual(dismiss_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AnnouncementDismissal.objects.filter(user=self.teacher.user, announcement=announcement).exists()
        )

        list_after = self.client.get(self.announcements_url, format="json")
        ids_after = [item["id"] for item in get_list(list_after.data)]
        self.assertNotIn(announcement.id, ids_after)

    def test_teacher_can_clear_all_announcements_from_own_feed(self):
        Announcement.objects.create(
            title="Notice 1",
            content="One",
            author=self.hr,
            target_audience="all",
            target_audiences=["all"],
        )
        Announcement.objects.create(
            title="Notice 2",
            content="Two",
            author=self.hr,
            target_audience="all",
            target_audiences=["all"],
        )
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(f"{self.announcements_url}dismiss-all/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data.get("dismissed", 0), 2)

        list_after = self.client.get(self.announcements_url, format="json")
        self.assertEqual(len(get_list(list_after.data)), 0)

    def test_teacher_cannot_issue_suspension(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.suspensions_url, {
            "student": self.student.id,
            "teacher": self.teacher.id,
            "reason": "Misconduct",
            "start_date": "2026-02-01",
            "end_date": "2026-02-05",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Suspension.objects.count(), 0)

    def test_admin_can_issue_suspension_using_class_teacher_fallback(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.suspensions_url, {
            "student": self.student.id,
            "reason": "Bullying",
            "start_date": "2026-03-01",
            "end_date": "2026-03-03",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        suspension = Suspension.objects.get(id=response.data["id"])
        self.assertEqual(suspension.teacher_id, self.teacher.id)


class BulkImportWizardAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Bulk Import School")
        self.admin = make_user(self.school, "bulk_admin", role="admin")
        self.teacher = make_teacher(self.school, username="bulk_teacher")
        self.class_a = make_class(self.school, teacher_user=self.teacher.user, name="Form 1A", grade_level=1)
        self.catalog_url = "/api/v1/academics/bulk-import/catalog/"
        self.validate_url = "/api/v1/academics/bulk-import/validate/"
        self.commit_url = "/api/v1/academics/bulk-import/commit/"
        self.history_url = "/api/v1/academics/bulk-import/history/"

    def _csv_file(self, rows):
        if not rows:
            headers = ["first_name", "last_name", "grade", "class"]
            content = ",".join(headers) + "\n"
        else:
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
            content = buf.getvalue()
        return SimpleUploadedFile("students.csv", content.encode("utf-8"), content_type="text/csv")

    def test_catalog_admin_ok(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.catalog_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK, msg=getattr(res, "data", None))
        self.assertIn("parameter_library", res.data)
        self.assertIn("students", res.data["parameter_library"])

    def test_catalog_teacher_forbidden(self):
        self.client.force_authenticate(user=self.teacher.user)
        res = self.client.get(self.catalog_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_validate_missing_required_fields_reports_errors(self):
        self.client.force_authenticate(user=self.admin)
        file_obj = self._csv_file([{"first_name": "John", "last_name": "", "grade": "1"}])
        res = self.client.post(self.validate_url, {
            "import_type": "students",
            "class_id": str(self.class_a.id),
            "selected_parameters": '["first_name","last_name","grade"]',
            "file": file_obj,
        }, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK, msg=getattr(res, "data", None))
        self.assertFalse(res.data["valid"])
        self.assertGreaterEqual(len(res.data["errors"]), 1)

    def test_commit_students_uses_existing_student_import(self):
        self.client.force_authenticate(user=self.admin)
        file_obj = self._csv_file([{
            "full_name": "John Doe",
            "email": "john.bulk@example.com",
            "phone": "0770000000",
            "class_name": "Form 1A",
            "date_of_birth": "2012-05-01",
            "gender": "M",
        }])
        res = self.client.post(self.commit_url, {
            "import_type": "students",
            "class_id": str(self.class_a.id),
            "file": file_obj,
        }, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK, msg=str(getattr(res, "data", None)))
        self.assertIn("created", res.data)

    def test_commit_subjects_creates_subject(self):
        self.client.force_authenticate(user=self.admin)
        file_obj = self._csv_file([{"name": "Mathematics", "code": "MTH100", "is_priority": "true"}])
        res = self.client.post(self.commit_url, {
            "import_type": "subjects",
            "file": file_obj,
        }, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Subject.objects.filter(school=self.school, code="MTH100").count(), 1)

    def test_commit_classes_creates_class(self):
        self.client.force_authenticate(user=self.admin)
        file_obj = self._csv_file([{"name": "Form 2B", "grade": "2", "academic_year": "2026"}])
        res = self.client.post(self.commit_url, {
            "import_type": "classes",
            "file": file_obj,
        }, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Class.objects.filter(school=self.school, name="Form 2B", academic_year="2026").count(), 1)

    def test_commit_with_mapping_and_then_rollback(self):
        self.client.force_authenticate(user=self.admin)
        file_obj = self._csv_file([{"Class Name": "Form 3C", "Grade Level": "3", "Year": "2026"}])
        res = self.client.post(self.commit_url, {
            "import_type": "classes",
            "mapping": '{"name":"Class Name","grade":"Grade Level","academic_year":"Year"}',
            "file": file_obj,
        }, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Class.objects.filter(school=self.school, name="Form 3C", academic_year="2026").count(), 1)
        job_id = res.data.get("job_id")
        self.assertTrue(job_id)

        hist = self.client.get(self.history_url)
        self.assertEqual(hist.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(hist.data), 1)

        rb = self.client.post(f"{self.history_url}{job_id}/rollback/", {}, format="json")
        self.assertEqual(rb.status_code, status.HTTP_200_OK)
        self.assertEqual(Class.objects.filter(school=self.school, name="Form 3C", academic_year="2026").count(), 0)


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


class ParentLinkRequestApprovalFlowAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Parent Link Flow School")
        self.admin = make_user(self.school, "flow_admin", role="admin")
        self.parent_user = make_user(self.school, "flow_parent", role="parent")
        self.parent_profile = Parent.objects.create(user=self.parent_user, occupation="Engineer")
        self.cls = make_class(self.school, name="Form 2A", grade_level=9)
        self.student = make_student(self.school, self.cls, username="flow_student", student_number="FLOW001")

    def test_parent_request_and_admin_approval_flow(self):
        self.client.force_authenticate(user=self.parent_user)
        request_response = self.client.post("/api/v1/parents/children/request/", {
            "student_id": self.student.id,
        }, format="json")
        self.assertEqual(request_response.status_code, status.HTTP_201_CREATED)

        link = ParentChildLink.objects.get(parent=self.parent_profile, student=self.student)
        self.assertFalse(link.is_confirmed)

        self.client.force_authenticate(user=self.admin)
        pending_response = self.client.get("/api/v1/academics/parent-link-requests/")
        self.assertEqual(pending_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["id"] == link.id for item in pending_response.data))

        approve_response = self.client.post(f"/api/v1/academics/parent-link-requests/{link.id}/approve/", {}, format="json")
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        link.refresh_from_db()
        self.assertTrue(link.is_confirmed)
        self.assertTrue(self.parent_profile.children.filter(id=self.student.id).exists())

    def test_parent_cannot_access_admin_pending_requests_endpoint(self):
        self.client.force_authenticate(user=self.parent_user)
        response = self.client.get("/api/v1/academics/parent-link-requests/")
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


# ---------------------------------------------------------------------------
# API tests — Teacher form/grade assignment scope
# ---------------------------------------------------------------------------

class TeacherAssignmentScopeAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Scope School")
        self.teacher = make_teacher(self.school, username="scope_teacher")
        self.subject = make_subject(self.school, name="History", code="HIS01")
        self.cls_form1 = make_class(self.school, name="Form 1A", grade_level=8)
        self.cls_form5 = make_class(self.school, name="Form 5A", grade_level=12)
        self.cls_other = make_class(self.school, name="Form 4A", grade_level=11)

        self.stu_form1 = make_student(self.school, self.cls_form1, username="scope_stu_1", student_number="SCP001")
        self.stu_form5 = make_student(self.school, self.cls_form5, username="scope_stu_2", student_number="SCP002")
        self.stu_other = make_student(self.school, self.cls_other, username="scope_stu_3", student_number="SCP003")

        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls_form1, self.cls_form5])

        self.students_url = f"/api/v1/teachers/subjects/{self.subject.id}/students/"
        self.marks_url = "/api/v1/teachers/marks/add/"

    def test_subject_students_returns_multiple_assigned_forms(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.get(self.students_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data}
        self.assertIn(self.stu_form1.id, ids)
        self.assertIn(self.stu_form5.id, ids)
        self.assertNotIn(self.stu_other.id, ids)

    def test_add_mark_rejects_student_in_unassigned_form(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.marks_url, {
            "student_id": self.stu_other.id,
            "subject_id": self.subject.id,
            "exam_type": "Test",
            "score": 65,
            "max_score": 100,
            "academic_term": "Term 1",
            "academic_year": "2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_mark_allows_student_in_assigned_form(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.marks_url, {
            "student_id": self.stu_form5.id,
            "subject_id": self.subject.id,
            "exam_type": "Test",
            "score": 78,
            "max_score": 100,
            "academic_term": "Term 1",
            "academic_year": "2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class TeacherAdminAssignmentAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Admin Assign School")
        self.admin = make_user(self.school, "assign_admin", role="admin")
        self.subject_math = make_subject(self.school, name="Math", code="MAT01")
        self.subject_history = make_subject(self.school, name="History", code="HIS02")
        self.cls_form1 = make_class(self.school, name="Form 1B", grade_level=8)
        self.cls_form5 = make_class(self.school, name="Form 5B", grade_level=12)
        self.url = "/api/v1/academics/teachers/"

    def test_admin_can_assign_subjects_and_multiple_forms_on_teacher_create(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "first_name": "Tariro",
            "last_name": "Moyo",
            "email": "tariro.moyo@assign.test",
            "phone_number": "+263771000111",
            "hire_date": "2026-01-10",
            "qualification": "B.Ed",
            "password": "teachpass123",
            "is_secondary_teacher": True,
            "subject_ids": [self.subject_math.id, self.subject_history.id],
            "teaching_class_ids": [self.cls_form1.id, self.cls_form5.id],
            "assigned_class_id": None,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_teacher = Teacher.objects.get(id=response.data["id"])
        subject_ids = set(created_teacher.subjects_taught.values_list("id", flat=True))
        class_ids = set(created_teacher.teaching_classes.values_list("id", flat=True))
        self.assertEqual(subject_ids, {self.subject_math.id, self.subject_history.id})
        self.assertEqual(class_ids, {self.cls_form1.id, self.cls_form5.id})

    def test_admin_can_set_teacher_salary_on_create(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {
            "first_name": "Salary",
            "last_name": "Teacher",
            "email": "salary.teacher@assign.test",
            "phone_number": "+263771000777",
            "hire_date": "2026-01-10",
            "qualification": "B.Ed",
            "salary": "1450.50",
            "password": "teachpass123",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_teacher = Teacher.objects.get(id=response.data["id"])
        self.assertTrue(hasattr(created_teacher.user, "staff"))
        self.assertEqual(str(created_teacher.user.staff.salary), "1450.50")
        self.assertEqual(created_teacher.user.staff.position, "teacher")

    def test_admin_can_update_teacher_salary(self):
        teacher = make_teacher(self.school, username="salary_update_teacher")
        self.client.force_authenticate(user=self.admin)

        detail_url = f"/api/v1/academics/teachers/{teacher.id}/"
        response = self.client.patch(detail_url, {
            "salary": "2100.00",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        teacher.refresh_from_db()
        self.assertTrue(hasattr(teacher.user, "staff"))
        self.assertEqual(str(teacher.user.staff.salary), "2100.00")


class TeacherMarksValidationAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Marks Validation School")
        self.teacher = make_teacher(self.school, username="marks_teacher")
        self.subject = make_subject(self.school, name="Accounting", code="ACC01")
        self.cls = make_class(self.school, name="Form 3A", grade_level=10)
        self.student = make_student(self.school, self.cls, username="marks_student", student_number="MRK001")
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])
        self.url = "/api/v1/teachers/marks/add/"

    def test_add_mark_allows_zero_score(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.url, {
            "student_id": self.student.id,
            "subject_id": self.subject.id,
            "exam_type": "Test",
            "score": 0,
            "max_score": 100,
            "academic_term": "Term 1",
            "academic_year": "2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Result.objects.filter(student=self.student, subject=self.subject).count(), 1)

    def test_add_mark_preserves_submitted_score_value(self):
        self.client.force_authenticate(user=self.teacher.user)
        response = self.client.post(self.url, {
            "student_id": self.student.id,
            "subject_id": self.subject.id,
            "exam_type": "Paper 1",
            "score": "95",
            "max_score": "100",
            "academic_term": "Term 1",
            "academic_year": "2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        result = Result.objects.get(student=self.student, subject=self.subject, exam_type="Paper 1")
        self.assertAlmostEqual(result.score, 95.0)
        self.assertAlmostEqual(result.max_score, 100.0)
        self.assertEqual(response.data.get("score"), result.score)

    def test_add_mark_detects_duplicate_without_override(self):
        self.client.force_authenticate(user=self.teacher.user)
        payload = {
            "student_id": self.student.id,
            "subject_id": self.subject.id,
            "exam_type": "Test 1",
            "score": 72,
            "max_score": 100,
            "academic_term": "Term 1",
            "academic_year": "2026",
        }
        first_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        second_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(second_response.data.get("duplicate"))
        self.assertIn("already entered", second_response.data.get("error", "").lower())
        self.assertEqual(Result.objects.filter(student=self.student, subject=self.subject, exam_type="Test 1").count(), 1)

    def test_add_mark_overrides_duplicate_when_confirmed(self):
        self.client.force_authenticate(user=self.teacher.user)
        initial_payload = {
            "student_id": self.student.id,
            "subject_id": self.subject.id,
            "exam_type": "Assignment 1",
            "score": 40,
            "max_score": 50,
            "academic_term": "Term 2",
            "academic_year": "2026",
        }
        create_response = self.client.post(self.url, initial_payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        override_payload = {
            **initial_payload,
            "score": 45,
            "override_existing": True,
        }
        override_response = self.client.post(self.url, override_payload, format="json")
        self.assertEqual(override_response.status_code, status.HTTP_200_OK)
        self.assertTrue(override_response.data.get("overridden"))

        qs = Result.objects.filter(student=self.student, subject=self.subject, exam_type="Assignment 1")
        self.assertEqual(qs.count(), 1)
        self.assertAlmostEqual(qs.first().score, 45.0)


class ReportFeedbackSignoffWorkflowAPITest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Report Signoff School")
        self.admin = make_user(self.school, "wf_admin", role="admin")
        self.teacher = make_teacher(self.school, username="wf_teacher")
        self.subject = make_subject(self.school, name="Biology", code="BIO01")
        self.cls = make_class(self.school, name="Form 2A", grade_level=9)
        self.student = make_student(self.school, self.cls, username="wf_student", student_number="WF001")
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])

        parent_user = make_user(self.school, "wf_parent", role="parent")
        self.parent = Parent.objects.create(user=parent_user)
        ParentChildLink.objects.create(parent=self.parent, student=self.student, is_confirmed=True)

        self.teacher_submit_url = "/api/v1/teachers/report-feedback/submit/"
        self.teacher_status_url = "/api/v1/teachers/report-feedback/status/"
        self.admin_list_url = "/api/v1/academics/reports/approval-requests/"
        self.admin_generate_url = "/api/v1/academics/reports/generate/"

    def test_teacher_submit_then_admin_reject_then_approve(self):
        self.client.force_authenticate(user=self.teacher.user)
        blocked_submit_response = self.client.post(self.teacher_submit_url, {
            "class_id": self.cls.id,
            "year": "2026",
            "term": "Term 1",
        }, format="json")
        self.assertEqual(blocked_submit_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.admin)
        generate_response = self.client.post(self.admin_generate_url, {
            "class_id": self.cls.id,
            "year": "2026",
            "term": "Term 1",
        }, format="json")
        self.assertIn(generate_response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertTrue(
            ReportCardGeneration.objects.filter(
                school=self.school, class_obj=self.cls, academic_year="2026", academic_term="Term 1"
            ).exists()
        )

        self.client.force_authenticate(user=self.teacher.user)
        submit_response = self.client.post(self.teacher_submit_url, {
            "class_id": self.cls.id,
            "year": "2026",
            "term": "Term 1",
        }, format="json")
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            ReportCardApprovalRequest.objects.get(
                school=self.school, class_obj=self.cls, academic_year="2026", academic_term="Term 1"
            ).status,
            "pending",
        )

        self.client.force_authenticate(user=self.admin)
        list_response = self.client.get(self.admin_list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        request_id = list_response.data["requests"][0]["id"]

        reject_response = self.client.post(
            f"/api/v1/academics/reports/approval-requests/{request_id}/review/",
            {"decision": "reject", "admin_note": "Please improve comments for weaker students."},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.teacher.user)
        status_response = self.client.get(self.teacher_status_url, {
            "class_id": self.cls.id,
            "year": "2026",
            "term": "Term 1",
        })
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.data["status"], "rejected")
        self.assertIn("improve comments", status_response.data["admin_note"])

        resubmit_response = self.client.post(self.teacher_submit_url, {
            "class_id": self.cls.id,
            "year": "2026",
            "term": "Term 1",
        }, format="json")
        self.assertEqual(resubmit_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.admin)
        approve_response = self.client.post(
            f"/api/v1/academics/reports/approval-requests/{request_id}/review/",
            {"decision": "approve"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            ReportCardRelease.objects.filter(
                school=self.school, class_obj=self.cls, academic_year="2026", academic_term="Term 1"
            ).exists()
        )


class ReportCardFullyPaidAccessAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Report Access School")
        self.admin = make_user(self.school, "access_admin", role="admin")
        self.teacher = make_teacher(self.school, username="access_teacher")
        self.subject = make_subject(self.school, name="History", code="HIS01")
        self.cls = make_class(self.school, name="Form 3A", grade_level=10, year="2026")
        self.student = make_student(self.school, self.cls, username="access_student", student_number="ACC001")
        self.student_user = self.student.user
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])

        self.parent_user = make_user(self.school, "access_parent", role="parent")
        self.parent = Parent.objects.create(user=self.parent_user)
        ParentChildLink.objects.create(parent=self.parent, student=self.student, is_confirmed=True)

        # Minimal result row so PDF generation has report data.
        Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Term Test",
            score=70,
            max_score=100,
            academic_term="Term 1",
            academic_year="2026",
            include_in_report=True,
        )

        # Fee configuration for outstanding checks.
        SchoolFees.objects.create(
            school=self.school,
            grade_level=10,
            grade_name="Form 3",
            tuition_fee=100,
            levy_fee=0,
            sports_fee=0,
            computer_fee=0,
            other_fees=0,
            boarding_fee=0,
            transport_fee=0,
            academic_year="2026",
            academic_term="term_1",
            created_by=self.admin,
        )

        ReportCardRelease.objects.create(
            school=self.school,
            class_obj=self.cls,
            academic_year="2026",
            academic_term="Term 1",
            access_scope="fully_paid",
            published_by=self.admin,
        )
        self.report_url = f"/api/v1/academics/students/{self.student.id}/report-card/?year=2026&term=Term+1"

    def test_parent_blocked_when_outstanding_without_plan(self):
        self.client.force_authenticate(user=self.parent_user)
        response = self.client.get(self.report_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("fully-paid", str(response.data.get("error", "")).lower())

    def test_parent_gets_access_after_payment(self):
        StudentPaymentRecord.objects.create(
            student=self.student,
            school=self.school,
            payment_type="school_fees",
            payment_plan="one_term",
            academic_year="2026",
            academic_term="term_1",
            total_amount_due=100,
            amount_paid=100,
            payment_status="paid",
            payment_method="cash",
            recorded_by=self.admin,
        )
        self.client.force_authenticate(user=self.parent_user)
        response = self.client.get(self.report_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")


class ReportCardDataIssueExclusionAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="Report Exclusion School")
        self.admin = make_user(self.school, "exclude_admin", role="admin")
        self.teacher = make_teacher(self.school, username="exclude_teacher")
        self.subject = make_subject(self.school, name="Science", code="SCI01")
        self.cls = make_class(self.school, name="Form 4A", grade_level=11, year="2026")
        self.student = make_student(self.school, self.cls, username="exclude_student", student_number="EXC001")
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])

        self.parent_user = make_user(self.school, "exclude_parent", role="parent")
        self.parent = Parent.objects.create(user=self.parent_user)
        ParentChildLink.objects.create(parent=self.parent, student=self.student, is_confirmed=True)

        Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Exam",
            score=76,
            max_score=100,
            academic_term="Term 1",
            academic_year="2026",
            include_in_report=True,
        )
        ReportCardRelease.objects.create(
            school=self.school,
            class_obj=self.cls,
            academic_year="2026",
            academic_term="Term 1",
            access_scope="all",
            published_by=self.admin,
        )
        self.toggle_url = "/api/v1/academics/reports/delivery-exclusions/"
        self.list_url = "/api/v1/academics/reports/approval-requests/"
        self.report_url = f"/api/v1/academics/students/{self.student.id}/report-card/?year=2026&term=Term+1"

    def test_admin_can_toggle_data_issue_exclusion(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.toggle_url, {
            "class_id": self.cls.id,
            "student_id": self.student.id,
            "year": "2026",
            "term": "Term 1",
            "excluded": True,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            ReportCardDeliveryExclusion.objects.filter(
                school=self.school,
                class_obj=self.cls,
                student=self.student,
                academic_year="2026",
                academic_term="Term 1",
            ).exists()
        )

        response = self.client.post(self.toggle_url, {
            "class_id": self.cls.id,
            "student_id": self.student.id,
            "year": "2026",
            "term": "Term 1",
            "excluded": False,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ReportCardDeliveryExclusion.objects.filter(
                school=self.school,
                class_obj=self.cls,
                student=self.student,
                academic_year="2026",
                academic_term="Term 1",
            ).exists()
        )

    def test_parent_report_access_blocked_when_excluded(self):
        ReportCardDeliveryExclusion.objects.create(
            school=self.school,
            class_obj=self.cls,
            student=self.student,
            academic_year="2026",
            academic_term="Term 1",
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.parent_user)
        response = self.client.get(self.report_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("data issue", str(response.data.get("error", "")).lower())

    def test_publish_all_returns_structured_exclusion_counts(self):
        ReportCardRelease.objects.filter(
            school=self.school,
            class_obj=self.cls,
            academic_year="2026",
            academic_term="Term 1",
        ).delete()
        ReportCardGeneration.objects.create(
            school=self.school,
            class_obj=self.cls,
            academic_year="2026",
            academic_term="Term 1",
            generated_by=self.admin,
        )
        ReportCardApprovalRequest.objects.create(
            school=self.school,
            class_obj=self.cls,
            academic_year="2026",
            academic_term="Term 1",
            requested_by=self.teacher.user,
            status="pending",
        )
        ReportCardDeliveryExclusion.objects.create(
            school=self.school,
            class_obj=self.cls,
            student=self.student,
            academic_year="2026",
            academic_term="Term 1",
            created_by=self.admin,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/v1/academics/reports/publish-all/",
            {"year": "2026", "term": "Term 1", "access_scope": "all"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("published_details", response.data)
        self.assertTrue(len(response.data["published_details"]) >= 1)
        first = response.data["published_details"][0]
        self.assertEqual(first["class_id"], self.cls.id)
        self.assertEqual(first["class_name"], self.cls.name)
        self.assertEqual(first["excluded_students_count"], 1)


class ReportQrVerificationAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = make_school(name="QR Verify School")
        self.admin = make_user(self.school, "qr_admin", role="admin")
        self.teacher = make_teacher(self.school, username="qr_teacher")
        self.subject = make_subject(self.school, name="English", code="ENG01")
        self.cls = make_class(self.school, name="Form 2A", grade_level=9, year="2026")
        self.student = make_student(self.school, self.cls, username="qr_student", student_number="QR001")
        self.teacher.subjects_taught.add(self.subject)
        self.teacher.teaching_classes.set([self.cls])

        Result.objects.create(
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            exam_type="Exam",
            score=84,
            max_score=100,
            academic_term="Term 1",
            academic_year="2026",
            include_in_report=True,
        )

        signer = TimestampSigner(salt="report-card")
        self.v2_token = signer.sign(f"v2|{self.school.id}|{self.student.id}|2026|Term 1")
        self.legacy_token = signer.sign(f"{self.student.id}|2026|Term 1")
        self.v2_url = f"/api/v1/auth/reports/verify/{self.v2_token}/"
        self.legacy_url = f"/api/v1/auth/reports/verify/{self.legacy_token}/"

    def test_verify_qr_returns_html_page_by_default(self):
        response = self.client.get(self.v2_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/html", response["Content-Type"])
        self.assertIn("Authentic School Report Card", response.content.decode("utf-8"))

    def test_verify_qr_download_returns_pdf(self):
        response = self.client.get(f"{self.v2_url}?download=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_verify_qr_supports_legacy_signed_token(self):
        response = self.client.get(f"{self.legacy_url}?format=json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["student_number"], "QR001")
