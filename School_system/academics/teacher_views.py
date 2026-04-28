import logging
import os
import json as _json
import urllib.request
import urllib.error
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db.models import Avg, Count, Q, Max, Min
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from .models import (
    Teacher, Student, Subject, Result, ClassAttendance, SubjectAttendance, Class, Timetable,
    SubjectTermFeedback, AssessmentPlan, ReportCardApprovalRequest, ReportCardGeneration,
    AttendancePermission,
)
from .serializers import ResultSerializer, ClassAttendanceSerializer, SubjectAttendanceSerializer
from users.models import SchoolSettings
from .utils import apply_late_penalty, log_school_audit

MAX_PAGE_SIZE = 200


def _normalize_report_year(year):
    return str(year or '').strip()


def _normalize_report_term(term):
    raw = str(term or '').strip()
    lowered = raw.lower().replace('_', ' ')
    compact = lowered.replace(' ', '')
    mapping = {
        'term1': 'Term 1',
        'term2': 'Term 2',
        'term3': 'Term 3',
        '1': 'Term 1',
        '2': 'Term 2',
        '3': 'Term 3',
    }
    return mapping.get(compact, raw)


def _paginate_queryset(request, qs, default_page_size=25):
    try:
        page = max(1, int(request.GET.get("page", 1)))
    except Exception:
        page = 1
    try:
        page_size = int(request.GET.get("page_size", default_page_size))
    except Exception:
        page_size = default_page_size
    page_size = max(1, min(MAX_PAGE_SIZE, page_size))

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    return qs[start:end], {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size,
        "has_next": end < total,
        "has_prev": page > 1,
    }


def _teacher_authorized_class_ids(teacher, subject_id=None, fallback_to_school=True):
    """
    Return class IDs this teacher can teach for the given subject.

    Sources:
    - class teacher ownership
    - explicit admin form/grade assignments (`teaching_classes`)
    - generated timetable entries (optionally filtered by subject)
    """
    class_ids = set(
        Class.objects.filter(class_teacher=teacher.user).values_list('id', flat=True)
    )
    class_ids.update(teacher.teaching_classes.values_list('id', flat=True))

    timetable_qs = Timetable.objects.filter(teacher=teacher)
    if subject_id is not None:
        timetable_qs = timetable_qs.filter(subject_id=subject_id)
    class_ids.update(timetable_qs.values_list('class_assigned_id', flat=True).distinct())

    if class_ids or not fallback_to_school:
        return class_ids

    # Legacy fallback: if no explicit mapping exists yet, allow existing behavior.
    return set(
        Class.objects.filter(school=teacher.user.school).values_list('id', flat=True)
    )


def _report_batch_generated(school, class_id, year, term):
    return ReportCardGeneration.objects.filter(
        school=school,
        class_obj_id=class_id,
        academic_year=year,
        academic_term=term,
    ).exists()


def _parse_attachment_rows(raw_items):
    import json
    if isinstance(raw_items, str):
        try:
            raw_items = json.loads(raw_items)
        except Exception:
            raw_items = []
    rows = []
    if not isinstance(raw_items, list):
        return rows
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        file_key = str(item.get('file_key') or '').strip()
        if not file_key:
            continue
        rows.append({
            'file_key': file_key,
            'original_filename': str(item.get('original_filename') or file_key).strip()[:255],
            'mime_type': str(item.get('mime_type') or '').strip()[:100],
            'size_bytes': int(item.get('size_bytes') or 0),
        })
    return rows


def _as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def _extract_questions_from_file_key(*, file_key, user):
    base = os.environ.get('GO_SERVICES_INTERNAL_URL') or os.environ.get('GO_SERVICES_UPSTREAM') or 'http://localhost:8082'
    url = f'{base}/api/v1/services/papers/extract'
    body = _json.dumps({'file_key': file_key}).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-Gateway-Auth', 'true')
    req.add_header('X-User-ID', str(user.id))
    req.add_header('X-User-Role', user.role)
    req.add_header('X-User-School-ID', str(user.school.id))
    with urllib.request.urlopen(req, timeout=30) as resp:
        return _json.loads(resp.read().decode('utf-8'))


def _normalize_candidate_questions(payload_questions):
    normalized = []
    if not isinstance(payload_questions, list):
        return normalized
    for i, q in enumerate(payload_questions, start=1):
        if not isinstance(q, dict):
            continue
        prompt = (
            q.get('prompt_text')
            or q.get('question')
            or q.get('text')
            or q.get('prompt')
            or ''
        ).strip()
        if not prompt:
            continue
        q_type = (q.get('question_type') or q.get('type') or 'short').strip().lower()
        if q_type not in ('short', 'long', 'mcq'):
            q_type = 'short'
        try:
            marks = float(q.get('marks') or 1)
        except (TypeError, ValueError):
            marks = 1
        normalized.append({
            'order': i,
            'prompt_text': prompt,
            'marks': marks if marks > 0 else 1,
            'question_type': q_type,
            'options': q.get('options') if isinstance(q.get('options'), list) else [],
            'correct_answer': str(q.get('correct_answer') or q.get('answer') or '').strip()[:255],
            'source_page': q.get('source_page') or q.get('page'),
        })
    return normalized


def _serialize_generated_test(test):
    return {
        'id': test.id,
        'title': test.title,
        'subject_id': test.subject_id,
        'subject_name': test.subject.name,
        'level_kind': test.level_kind,
        'level_number': test.level_number,
        'duration_minutes': test.duration_minutes,
        'total_marks': test.total_marks,
        'status': test.status,
        'counts_for_report': test.counts_for_report,
        'assessment_plan_id': test.assessment_plan_id,
        'component_index': test.component_index,
        'schedule_mode': test.schedule_mode,
        'available_from': test.available_from.isoformat() if test.available_from else None,
        'available_until': test.available_until.isoformat() if test.available_until else None,
        'academic_year': test.academic_year,
        'academic_term': test.academic_term,
        'source_paper_id': test.source_paper_id,
        'questions': [
            {
                'id': q.id,
                'order': q.order,
                'prompt_text': q.prompt_text,
                'marks': q.marks,
                'question_type': q.question_type,
                'options': q.options,
                'correct_answer': q.correct_answer,
                'source_page': q.source_page,
            }
            for q in test.questions.all().order_by('order', 'id')
        ],
    }


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_test_from_paper(request):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import Teacher, PastExamPaper, GeneratedTest, TestQuestion
    try:
        teacher = Teacher.objects.get(user=request.user)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    source_paper_id = request.data.get('source_paper_id')
    title = (request.data.get('title') or '').strip()
    duration_minutes = request.data.get('duration_minutes') or 60
    if not source_paper_id or not title:
        return Response({'error': 'source_paper_id and title are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        duration_minutes = int(duration_minutes)
    except (TypeError, ValueError):
        return Response({'error': 'duration_minutes must be a number'}, status=status.HTTP_400_BAD_REQUEST)
    if duration_minutes <= 0:
        return Response({'error': 'duration_minutes must be > 0'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        paper = PastExamPaper.objects.get(id=source_paper_id, school=request.user.school)
    except PastExamPaper.DoesNotExist:
        return Response({'error': 'Past paper not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        payload = _extract_questions_from_file_key(file_key=paper.file_key, user=request.user)
    except urllib.error.HTTPError as e:
        return Response({'error': f'Extraction failed: {e}'}, status=status.HTTP_502_BAD_GATEWAY)
    except (urllib.error.URLError, TimeoutError) as e:
        return Response({'error': f'go-services unreachable: {e}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    candidates = _normalize_candidate_questions(payload.get('questions', []))
    total_marks = sum(float(q['marks']) for q in candidates) if candidates else 0
    test = GeneratedTest.objects.create(
        school=request.user.school,
        subject=paper.subject,
        level_kind=paper.level_kind,
        level_number=paper.level_number,
        source_paper=paper,
        title=title,
        duration_minutes=duration_minutes,
        total_marks=total_marks if total_marks > 0 else 100,
        created_by=teacher,
        status='draft',
        academic_year=str(request.data.get('academic_year') or timezone.now().year),
        academic_term=str(request.data.get('academic_term') or 'Term 1'),
    )
    for item in candidates:
        TestQuestion.objects.create(test=test, **item)
    test.total_marks = sum(float(q.marks) for q in test.questions.all()) or test.total_marks
    test.save(update_fields=['total_marks'])
    log_school_audit(
        user=request.user,
        action='CREATE',
        model_name='GeneratedTest',
        object_id=test.id,
        object_repr=test.title,
        changes={'source_paper_id': paper.id, 'question_count': len(candidates)},
        status_code=201,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'test': _serialize_generated_test(test)}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def teacher_test_detail(request, test_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import GeneratedTest, Teacher, AssessmentPlan
    try:
        teacher = Teacher.objects.get(user=request.user)
        test = GeneratedTest.objects.select_related('subject', 'assessment_plan').prefetch_related('questions').get(
            id=test_id, school=request.user.school, created_by=teacher
        )
    except (Teacher.DoesNotExist, GeneratedTest.DoesNotExist):
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'test': _serialize_generated_test(test)})

    before = {
        'title': test.title,
        'duration_minutes': test.duration_minutes,
        'total_marks': float(test.total_marks or 0),
        'academic_year': test.academic_year,
        'academic_term': test.academic_term,
        'status': test.status,
        'schedule_mode': test.schedule_mode,
        'counts_for_report': test.counts_for_report,
        'assessment_plan_id': test.assessment_plan_id,
        'component_index': test.component_index,
        'available_from': test.available_from.isoformat() if test.available_from else None,
        'available_until': test.available_until.isoformat() if test.available_until else None,
    }

    for field in ('title', 'duration_minutes', 'total_marks', 'academic_year', 'academic_term', 'status', 'schedule_mode'):
        if field in request.data:
            setattr(test, field, request.data.get(field))
    if 'counts_for_report' in request.data:
        test.counts_for_report = _as_bool(request.data.get('counts_for_report'))
    if 'component_index' in request.data:
        raw_component_index = request.data.get('component_index')
        test.component_index = int(raw_component_index) if raw_component_index not in (None, '') else None
    if 'assessment_plan_id' in request.data or 'assessment_plan' in request.data:
        plan_id = request.data.get('assessment_plan_id', request.data.get('assessment_plan'))
        if plan_id in (None, ''):
            test.assessment_plan = None
        else:
            try:
                test.assessment_plan = AssessmentPlan.objects.get(id=plan_id, school=request.user.school)
            except AssessmentPlan.DoesNotExist:
                return Response({'error': 'Assessment plan not found'}, status=status.HTTP_404_NOT_FOUND)
    if 'available_from' in request.data:
        test.available_from = request.data.get('available_from') or None
    if 'available_until' in request.data:
        test.available_until = request.data.get('available_until') or None
    try:
        test.full_clean()
    except Exception as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    test.save()
    after = {
        'title': test.title,
        'duration_minutes': test.duration_minutes,
        'total_marks': float(test.total_marks or 0),
        'academic_year': test.academic_year,
        'academic_term': test.academic_term,
        'status': test.status,
        'schedule_mode': test.schedule_mode,
        'counts_for_report': test.counts_for_report,
        'assessment_plan_id': test.assessment_plan_id,
        'component_index': test.component_index,
        'available_from': test.available_from.isoformat() if test.available_from else None,
        'available_until': test.available_until.isoformat() if test.available_until else None,
    }
    changes = {k: {'from': before[k], 'to': after[k]} for k in after.keys() if before.get(k) != after.get(k)}
    if changes:
        log_school_audit(
            user=request.user,
            action='UPDATE',
            model_name='GeneratedTest',
            object_id=test.id,
            object_repr=test.title,
            changes=changes,
            status_code=200,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
    return Response({'test': _serialize_generated_test(test)})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_tests(request):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import GeneratedTest, Teacher
    try:
        teacher = Teacher.objects.get(user=request.user)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    status_filter = str(request.query_params.get('status') or '').strip().lower()
    search = str(request.query_params.get('q') or '').strip()
    ordering = str(request.query_params.get('ordering') or '-updated_at').strip()

    qs = GeneratedTest.objects.filter(
        school=request.user.school,
        created_by=teacher,
    ).select_related('subject')
    if status_filter in ('draft', 'published', 'closed'):
        qs = qs.filter(status=status_filter)
    if search:
        qs = qs.filter(Q(title__icontains=search) | Q(subject__name__icontains=search))

    ordering_map = {
        'updated_at': ('updated_at', 'id'),
        '-updated_at': ('-updated_at', '-id'),
        'title': ('title', 'id'),
        '-title': ('-title', '-id'),
        'status': ('status', 'id'),
        '-status': ('-status', '-id'),
    }
    qs = qs.order_by(*(ordering_map.get(ordering) or ordering_map['-updated_at']))
    page_qs, page_meta = _paginate_queryset(request, qs, default_page_size=25)

    tests = []
    for t in page_qs:
        tests.append({
            'id': t.id,
            'title': t.title,
            'subject_name': t.subject.name,
            'status': t.status,
            'duration_minutes': t.duration_minutes,
            'total_marks': t.total_marks,
            'academic_year': t.academic_year,
            'academic_term': t.academic_term,
            'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            'attempts_count': t.attempts.count(),
        })
    return Response({'tests': tests, 'pagination': page_meta})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def teacher_test_questions(request, test_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import GeneratedTest, Teacher, TestQuestion
    try:
        teacher = Teacher.objects.get(user=request.user)
        test = GeneratedTest.objects.get(id=test_id, school=request.user.school, created_by=teacher)
    except (Teacher.DoesNotExist, GeneratedTest.DoesNotExist):
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

    action = (request.data.get('action') or 'replace').strip().lower()
    before_count = test.questions.count()
    before_total_marks = float(test.total_marks or 0)
    if action == 'replace':
        questions = _normalize_candidate_questions(request.data.get('questions') or [])
        TestQuestion.objects.filter(test=test).delete()
        for q in questions:
            TestQuestion.objects.create(test=test, **q)
    elif action == 'delete':
        qid = request.data.get('question_id')
        TestQuestion.objects.filter(test=test, id=qid).delete()
    else:  # upsert
        q = request.data.get('question') or {}
        qid = q.get('id')
        payload = _normalize_candidate_questions([q])
        if not payload:
            return Response({'error': 'Invalid question payload'}, status=status.HTTP_400_BAD_REQUEST)
        row = payload[0]
        if qid:
            TestQuestion.objects.filter(test=test, id=qid).update(**row)
        else:
            TestQuestion.objects.create(test=test, **row)

    test.total_marks = sum(float(x.marks) for x in test.questions.all()) or test.total_marks
    test.save(update_fields=['total_marks'])
    after_count = test.questions.count()
    log_school_audit(
        user=request.user,
        action='UPDATE',
        model_name='GeneratedTest',
        object_id=test.id,
        object_repr=test.title,
        changes={
            'questions_action': action,
            'question_count': {'from': before_count, 'to': after_count},
            'total_marks': {'from': before_total_marks, 'to': float(test.total_marks or 0)},
        },
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'test': _serialize_generated_test(test)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def publish_test(request, test_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import GeneratedTest, Teacher
    try:
        teacher = Teacher.objects.get(user=request.user)
        test = GeneratedTest.objects.get(id=test_id, school=request.user.school, created_by=teacher)
    except (Teacher.DoesNotExist, GeneratedTest.DoesNotExist):
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)
    test.status = 'published'
    try:
        test.full_clean()
    except Exception as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    test.save(update_fields=['status', 'updated_at'])
    log_school_audit(
        user=request.user,
        action='APPROVE',
        model_name='GeneratedTest',
        object_id=test.id,
        object_repr=test.title,
        changes={'status': 'published'},
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'message': 'Test published.', 'test': _serialize_generated_test(test)})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_test_attempts(request, test_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import GeneratedTest, Teacher
    try:
        teacher = Teacher.objects.get(user=request.user)
        test = GeneratedTest.objects.get(id=test_id, school=request.user.school, created_by=teacher)
    except (Teacher.DoesNotExist, GeneratedTest.DoesNotExist):
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)
    attempts = test.attempts.select_related('student__user').order_by('-started_at')
    return Response({
        'attempts': [
            {
                'id': a.id,
                'student_id': a.student_id,
                'student_name': a.student.user.full_name,
                'started_at': a.started_at.isoformat() if a.started_at else None,
                'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
                'auto_score': a.auto_score,
                'manual_score': a.manual_score,
                'final_score': a.final_score,
                'status': a.status,
                'pushed_to_results': a.pushed_to_results,
            }
            for a in attempts
        ]
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def grade_test_attempt(request, attempt_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import Teacher, TestAttempt, TestAnswer
    try:
        teacher = Teacher.objects.get(user=request.user)
        attempt = TestAttempt.objects.select_related('test', 'student__user').get(
            id=attempt_id, test__school=request.user.school, test__created_by=teacher
        )
    except (Teacher.DoesNotExist, TestAttempt.DoesNotExist):
        return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        question_map = {q.id: q for q in attempt.test.questions.all().order_by('order', 'id')}
        answer_map = {a.question_id: a for a in attempt.answers.all()}
        rows = []
        for qid, q in question_map.items():
            ans = answer_map.get(qid)
            rows.append({
                'question_id': q.id,
                'order': q.order,
                'question_type': q.question_type,
                'prompt_text': q.prompt_text,
                'marks': q.marks,
                'correct_answer': q.correct_answer,
                'student_answer': ans.answer_text if ans else '',
                'awarded_marks': ans.awarded_marks if ans and ans.awarded_marks is not None else 0,
                'teacher_comment': ans.teacher_comment if ans else '',
                'is_auto_graded': q.question_type in ('mcq', 'short'),
            })
        return Response({
            'attempt_id': attempt.id,
            'test_id': attempt.test_id,
            'test_title': attempt.test.title,
            'student_name': attempt.student.user.full_name,
            'status': attempt.status,
            'auto_score': attempt.auto_score,
            'manual_score': attempt.manual_score,
            'final_score': attempt.final_score,
            'questions': rows,
        })

    answers_payload = request.data.get('answers') or []
    for row in answers_payload:
        if not isinstance(row, dict):
            continue
        qid = row.get('question_id')
        if not qid:
            continue
        marks = row.get('awarded_marks', 0) or 0
        comment = row.get('teacher_comment') or ''
        ans, _ = TestAnswer.objects.get_or_create(attempt=attempt, question_id=qid)
        ans.awarded_marks = float(marks)
        ans.teacher_comment = comment
        ans.save(update_fields=['awarded_marks', 'teacher_comment'])

    long_answer_ids = set(attempt.test.questions.filter(question_type='long').values_list('id', flat=True))
    manual_score = sum(
        float(a.awarded_marks or 0)
        for a in attempt.answers.filter(question_id__in=long_answer_ids)
    )
    attempt.manual_score = manual_score
    attempt.final_score = float(attempt.auto_score or 0) + float(manual_score or 0)
    finalize = _as_bool(request.data.get('finalize'), default=False)
    attempt.status = 'finalized' if finalize else 'graded'
    attempt.save(update_fields=['manual_score', 'final_score', 'status'])
    log_school_audit(
        user=request.user,
        action='UPDATE',
        model_name='TestAttempt',
        object_id=attempt.id,
        object_repr=f'{attempt.test.title} / {attempt.student.user.full_name}',
        changes={
            'status': attempt.status,
            'manual_score': attempt.manual_score,
            'final_score': attempt.final_score,
            'graded_answers': len([r for r in answers_payload if isinstance(r, dict) and r.get('question_id')]),
        },
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({
        'attempt_id': attempt.id,
        'auto_score': attempt.auto_score,
        'manual_score': attempt.manual_score,
        'final_score': attempt.final_score,
        'status': attempt.status,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def finalize_test_results(request, test_id):
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can do this'}, status=status.HTTP_403_FORBIDDEN)
    from .models import Teacher, GeneratedTest, TestAttempt, Result
    try:
        teacher = Teacher.objects.get(user=request.user)
        test = GeneratedTest.objects.select_related('subject', 'assessment_plan').get(
            id=test_id, school=request.user.school, created_by=teacher
        )
    except (Teacher.DoesNotExist, GeneratedTest.DoesNotExist):
        return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

    attempts = TestAttempt.objects.filter(
        test=test, submitted_at__isnull=False, pushed_to_results=False
    ).select_related('student')
    pushed = 0
    for attempt in attempts:
        if attempt.status not in ('graded', 'finalized'):
            continue
        score = float(attempt.final_score or 0)
        Result.objects.update_or_create(
            student=attempt.student,
            subject=test.subject,
            teacher=teacher,
            exam_type='test',
            academic_term=test.academic_term,
            academic_year=test.academic_year,
            assessment_plan=test.assessment_plan if test.counts_for_report else None,
            component_kind='test' if test.counts_for_report else '',
            component_index=test.component_index if test.counts_for_report else None,
            defaults={
                'score': score,
                'max_score': float(test.total_marks or 100),
                'include_in_report': True,
                'report_term': test.academic_term,
            },
        )
        attempt.pushed_to_results = True
        attempt.status = 'finalized'
        attempt.save(update_fields=['pushed_to_results', 'status'])
        pushed += 1

    if test.status != 'closed':
        test.status = 'closed'
        test.save(update_fields=['status', 'updated_at'])

    log_school_audit(
        user=request.user,
        action='APPROVE',
        model_name='GeneratedTest',
        object_id=test.id,
        object_repr=test.title,
        changes={'pushed_attempts': pushed, 'status': test.status},
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'message': f'Finalized test and pushed {pushed} result(s).', 'pushed': pushed})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def teacher_assignments(request):
    """Teacher list/create assignments with optional file-key attachments."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import Assignment, AssignmentAttachment

    if request.method == 'GET':
        qs = Assignment.objects.filter(
            teacher=teacher, school=request.user.school
        ).select_related('subject', 'assigned_class').prefetch_related('attachments').order_by('-date_created')
        data = []
        for a in qs:
            data.append({
                'id': a.id,
                'title': a.title,
                'description': a.description,
                'subject_id': a.subject_id,
                'subject_name': a.subject.name,
                'class_id': a.assigned_class_id,
                'class_name': a.assigned_class.name,
                'deadline': a.deadline.isoformat(),
                'max_score': a.max_score,
                'allow_late': a.allow_late,
                'date_created': a.date_created.isoformat(),
                'attachments': [
                    {
                        'id': att.id,
                        'file_key': att.file_key,
                        'original_filename': att.original_filename,
                        'mime_type': att.mime_type,
                        'size_bytes': att.size_bytes,
                    }
                    for att in a.attachments.all()
                ],
            })
        return Response({'assignments': data})

    title = (request.data.get('title') or '').strip()
    description = (request.data.get('description') or '').strip()
    subject_id = request.data.get('subject_id') or request.data.get('subject')
    class_id = request.data.get('class_id') or request.data.get('assigned_class')
    deadline = request.data.get('deadline')
    max_score = request.data.get('max_score', 100)
    allow_late = _as_bool(request.data.get('allow_late', False))
    if not all([title, description, subject_id, class_id, deadline]):
        return Response({'error': 'title, description, subject_id, class_id, deadline are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
        class_obj = Class.objects.get(id=class_id, school=request.user.school)
    except (Subject.DoesNotExist, Class.DoesNotExist):
        return Response({'error': 'Subject/class not found'}, status=status.HTTP_404_NOT_FOUND)
    if not teacher.subjects_taught.filter(id=subject.id).exists():
        return Response({'error': 'You can only create assignments for your own subjects'}, status=status.HTTP_403_FORBIDDEN)
    try:
        max_score = float(max_score)
    except (TypeError, ValueError):
        return Response({'error': 'max_score must be a number'}, status=status.HTTP_400_BAD_REQUEST)
    if max_score <= 0:
        return Response({'error': 'max_score must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

    assignment = Assignment.objects.create(
        school=request.user.school,
        title=title,
        description=description,
        subject=subject,
        teacher=teacher,
        assigned_class=class_obj,
        deadline=deadline,
        max_score=max_score,
        allow_late=allow_late,
    )
    for row in _parse_attachment_rows(request.data.get('attachments') or []):
        AssignmentAttachment.objects.create(assignment=assignment, **row)
    log_school_audit(
        user=request.user,
        action='CREATE',
        model_name='Assignment',
        object_id=assignment.id,
        object_repr=assignment.title,
        changes={'class_id': class_obj.id, 'subject_id': subject.id, 'max_score': assignment.max_score, 'allow_late': assignment.allow_late},
        status_code=201,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'id': assignment.id, 'message': 'Assignment created successfully.'}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def teacher_assignment_detail(request, assignment_id):
    """Teacher detail/update/delete assignment."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    from .models import Assignment, AssignmentAttachment
    try:
        assignment = Assignment.objects.select_related('subject', 'assigned_class').prefetch_related('attachments').get(
            id=assignment_id, teacher=teacher, school=request.user.school
        )
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            'id': assignment.id,
            'title': assignment.title,
            'description': assignment.description,
            'subject_id': assignment.subject_id,
            'subject_name': assignment.subject.name,
            'class_id': assignment.assigned_class_id,
            'class_name': assignment.assigned_class.name,
            'deadline': assignment.deadline.isoformat(),
            'max_score': assignment.max_score,
            'allow_late': assignment.allow_late,
            'attachments': [
                {
                    'id': att.id,
                    'file_key': att.file_key,
                    'original_filename': att.original_filename,
                    'mime_type': att.mime_type,
                    'size_bytes': att.size_bytes,
                }
                for att in assignment.attachments.all()
            ],
        })

    if request.method == 'DELETE':
        title = assignment.title
        assignment.delete()
        log_school_audit(
            user=request.user,
            action='DELETE',
            model_name='Assignment',
            object_id=assignment_id,
            object_repr=title,
            status_code=200,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'message': 'Assignment deleted.'})

    changed = {}
    for field in ('title', 'description', 'deadline'):
        if field in request.data:
            setattr(assignment, field, request.data.get(field))
            changed[field] = request.data.get(field)
    if 'max_score' in request.data:
        try:
            assignment.max_score = float(request.data.get('max_score'))
            changed['max_score'] = assignment.max_score
        except (TypeError, ValueError):
            return Response({'error': 'max_score must be a number'}, status=status.HTTP_400_BAD_REQUEST)
    if 'allow_late' in request.data:
        assignment.allow_late = _as_bool(request.data.get('allow_late'))
        changed['allow_late'] = assignment.allow_late
    assignment.save()
    if 'attachments' in request.data:
        AssignmentAttachment.objects.filter(assignment=assignment).delete()
        for row in _parse_attachment_rows(request.data.get('attachments') or []):
            AssignmentAttachment.objects.create(assignment=assignment, **row)
        changed['attachments_replaced'] = True
    log_school_audit(
        user=request.user,
        action='UPDATE',
        model_name='Assignment',
        object_id=assignment.id,
        object_repr=assignment.title,
        changes=changed,
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return Response({'message': 'Assignment updated.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_subjects(request):
    """Get all subjects taught by the logged-in teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subjects = teacher.subjects_taught.filter(school=request.user.school)
        
        data = []
        for subject in subjects:
            authorized_class_ids = _teacher_authorized_class_ids(teacher, subject_id=subject.id)
            students_count = Student.objects.filter(
                student_class_id__in=authorized_class_ids,
                user__is_active=True
            ).count()
            
            data.append({
                'id': subject.id,
                'name': subject.name,
                'code': subject.code,
                'description': subject.description,
                'students_count': students_count
            })
        
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_students(request, subject_id):
    """Get students enrolled in classes for a specific subject taught by the teacher"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Get students who have existing results for this subject
        students_with_results = Student.objects.filter(
            results__subject=subject,
            results__teacher=teacher
        ).distinct().values_list('id', flat=True)

        # Classes explicitly/implicitly assigned for this subject
        authorized_class_ids = _teacher_authorized_class_ids(teacher, subject_id=subject.id)

        # Combine both filters so historical entries remain visible
        students = Student.objects.filter(
            Q(id__in=students_with_results) | Q(student_class_id__in=authorized_class_ids),
            student_class__school=request.user.school,
            user__is_active=True
        ).distinct().select_related('user', 'student_class')
        
        data = []
        for student in students:
            # Get latest result for this student and subject
            latest_result = Result.objects.filter(
                student=student,
                subject=subject,
                teacher=teacher
            ).order_by('-date_recorded').first()
            
            data.append({
                'id': student.id,
                'student_number': student.user.student_number or '',
                'name': student.user.first_name,
                'surname': student.user.last_name,
                'class': student.student_class.name if student.student_class else 'Not Assigned',
                'class_id': student.student_class_id,
                'grade_level': student.student_class.grade_level if student.student_class else None,
                'latest_score': latest_result.score if latest_result else None,
                'latest_max_score': latest_result.max_score if latest_result else None,
                'latest_exam_type': latest_result.exam_type if latest_result else None
            })
        
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_student_mark(request):
    """Add or update a student's mark for a subject"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        student_id = request.data.get('student_id')
        subject_id = request.data.get('subject_id')
        exam_type = (request.data.get('exam_type') or '').strip()
        score = request.data.get('score')
        max_score = request.data.get('max_score')
        academic_term = request.data.get('academic_term', 'Term 1')
        academic_year = request.data.get('academic_year', str(datetime.now().year))
        include_in_report = request.data.get('include_in_report', True)
        report_term = request.data.get('report_term', '')
        override_existing = request.data.get('override_existing', False)
        
        # Assessment plan fields (optional, for component tracking)
        assessment_plan_id = request.data.get('assessment_plan')
        component_kind = (request.data.get('component_kind', '') or '').strip().lower()
        component_index = request.data.get('component_index')
        
        # Validation
        if (
            student_id in (None, '')
            or subject_id in (None, '')
            or not exam_type
            or score in (None, '')
            or max_score in (None, '')
        ):
            return Response({'error': 'All fields are required'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        try:
            score = Decimal(str(score)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            max_score = Decimal(str(max_score)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'Score and max_score must be numbers'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        if max_score <= 0:
            return Response({'error': 'max_score must be greater than 0'},
                           status=status.HTTP_400_BAD_REQUEST)
        if score < 0:
            return Response({'error': 'score cannot be negative'},
                           status=status.HTTP_400_BAD_REQUEST)
        if score > max_score:
            return Response({'error': 'Score cannot exceed max_score'}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Get student and subject
        try:
            student = Student.objects.get(id=student_id, student_class__school=request.user.school)
            subject = Subject.objects.get(id=subject_id, school=request.user.school)
        except (Student.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Student or subject not found'}, 
                           status=status.HTTP_404_NOT_FOUND)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)

        authorized_class_ids = _teacher_authorized_class_ids(teacher, subject_id=subject.id)
        if student.student_class_id not in authorized_class_ids:
            return Response(
                {'error': "You are not assigned to teach this student's class for this subject"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # SECURITY: Verify student is active and exists
        if not student.user.is_active:
            return Response({'error': 'Cannot add marks for inactive students'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        if component_index in ('', None):
            component_index = None
        else:
            try:
                component_index = int(component_index)
            except (TypeError, ValueError):
                return Response({'error': 'component_index must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate assessment plan if provided
        assessment_plan_obj = None
        if assessment_plan_id:
            try:
                assessment_plan_obj = AssessmentPlan.objects.get(
                    id=assessment_plan_id, 
                    school=request.user.school,
                    subjects=subject
                )
                
                # Validate component_index is in range for the component_kind (1-based indexing).
                if component_kind == 'paper':
                    effective_papers = assessment_plan_obj.effective_paper_numbers()
                    if component_index is None:
                        return Response({'error': 'component_index is required for paper components'},
                                        status=status.HTTP_400_BAD_REQUEST)
                    if component_index not in effective_papers:
                        return Response({
                            'error': f'Invalid paper number {component_index}. Valid papers: {effective_papers}'
                        }, status=status.HTTP_400_BAD_REQUEST)
                elif component_kind == 'test':
                    if component_index is None:
                        return Response({'error': 'component_index is required for test components'},
                                        status=status.HTTP_400_BAD_REQUEST)
                    if not (1 <= component_index <= assessment_plan_obj.num_tests):
                        return Response({
                            'error': f'Invalid test number {component_index}. Valid range: 1-{assessment_plan_obj.num_tests}'
                        }, status=status.HTTP_400_BAD_REQUEST)
                elif component_kind == 'assignment':
                    if component_index is None:
                        return Response({'error': 'component_index is required for assignment components'},
                                        status=status.HTTP_400_BAD_REQUEST)
                    if not (1 <= component_index <= assessment_plan_obj.num_assignments):
                        return Response({
                            'error': f'Invalid assignment number {component_index}. Valid range: 1-{assessment_plan_obj.num_assignments}'
                        }, status=status.HTTP_400_BAD_REQUEST)
                elif component_kind == '':
                    # Free-text / manual entry
                    pass
                else:
                    return Response({
                        'error': f'Invalid component_kind: {component_kind}'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except AssessmentPlan.DoesNotExist:
                return Response({'error': 'Assessment plan not found'}, 
                               status=status.HTTP_404_NOT_FOUND)
        elif component_kind:
            return Response(
                {'error': 'assessment_plan is required when component_kind is provided'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if isinstance(override_existing, str):
            override_existing = override_existing.strip().lower() in {'1', 'true', 'yes', 'on'}
        else:
            override_existing = bool(override_existing)

        duplicate_qs = Result.objects.filter(
            student=student,
            subject=subject,
            teacher=teacher,
            academic_term=academic_term,
            academic_year=academic_year,
        )
        if component_kind and component_index is not None:
            duplicate_qs = duplicate_qs.filter(
                component_kind=component_kind,
                component_index=component_index,
            )
            if assessment_plan_obj:
                duplicate_qs = duplicate_qs.filter(assessment_plan=assessment_plan_obj)
        else:
            duplicate_qs = duplicate_qs.filter(exam_type__iexact=exam_type)

        existing_result = duplicate_qs.order_by('-date_recorded', '-id').first()
        if existing_result and not override_existing:
            return Response({
                'error': 'You have already entered this mark. Do you want to override it?',
                'duplicate': True,
                'duplicate_record': {
                    'id': existing_result.id,
                    'exam_type': existing_result.exam_type,
                    'score': existing_result.score,
                    'max_score': existing_result.max_score,
                    'percentage': round((existing_result.score / existing_result.max_score) * 100, 2) if existing_result.max_score else 0,
                    'academic_term': existing_result.academic_term,
                    'academic_year': existing_result.academic_year,
                    'component_kind': existing_result.component_kind,
                    'component_index': existing_result.component_index,
                },
            }, status=status.HTTP_409_CONFLICT)

        if existing_result and override_existing:
            existing_result.exam_type = exam_type
            existing_result.score = float(score)
            existing_result.max_score = float(max_score)
            existing_result.academic_term = academic_term
            existing_result.academic_year = academic_year
            existing_result.include_in_report = include_in_report
            existing_result.report_term = report_term or ''
            existing_result.assessment_plan = assessment_plan_obj
            existing_result.component_kind = component_kind or ''
            existing_result.component_index = component_index if component_index is not None else None
            existing_result.save(update_fields=[
                'exam_type', 'score', 'max_score', 'academic_term', 'academic_year',
                'include_in_report', 'report_term', 'assessment_plan',
                'component_kind', 'component_index',
            ])
            return Response({
                'id': existing_result.id,
                'student': f"{student.user.first_name} {student.user.last_name}",
                'subject': subject.name,
                'exam_type': exam_type,
                'score': existing_result.score,
                'max_score': existing_result.max_score,
                'percentage': round((existing_result.score / existing_result.max_score) * 100, 2),
                'assessment_plan': assessment_plan_obj.id if assessment_plan_obj else None,
                'component_kind': component_kind,
                'component_index': component_index,
                'message': 'Existing mark overridden successfully',
                'overridden': True,
            }, status=status.HTTP_200_OK)
        
        # Create result
        result = Result.objects.create(
            student=student,
            subject=subject,
            teacher=teacher,
            exam_type=exam_type,
            score=float(score),
            max_score=float(max_score),
            academic_term=academic_term,
            academic_year=academic_year,
            include_in_report=include_in_report,
            report_term=report_term or '',
            assessment_plan=assessment_plan_obj,
            component_kind=component_kind or '',
            component_index=component_index if component_index is not None else None,
        )
        
        return Response({
            'id': result.id,
            'student': f"{student.user.first_name} {student.user.last_name}",
            'subject': subject.name,
            'exam_type': exam_type,
            'score': result.score,
            'max_score': result.max_score,
            'percentage': round((result.score / result.max_score) * 100, 2),
            'assessment_plan': assessment_plan_obj.id if assessment_plan_obj else None,
            'component_kind': component_kind,
            'component_index': component_index,
            'message': 'Mark added successfully'
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_performance(request, subject_id):
    """Get performance analytics for a subject"""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Get all results for this subject and teacher
        results = Result.objects.filter(subject=subject, teacher=teacher)
        
        if not results.exists():
            return Response({
                'subject_name': subject.name,
                'subject_code': subject.code,
                'total_students': 0,
                'average_score': 0,
                'highest_score': 0,
                'lowest_score': 0,
                'pass_rate': 0,
                'exam_types': []
            })
        
        # Calculate percentages for each result
        percentages = []
        for result in results:
            if result.max_score > 0:
                percentages.append((result.score / result.max_score) * 100)
        
        # Calculate statistics
        avg_percentage = sum(percentages) / len(percentages) if percentages else 0
        pass_rate = sum(1 for p in percentages if p >= 50) / len(percentages) * 100 if percentages else 0
        
        # Get unique students
        total_students = results.values('student').distinct().count()
        
        # Get exam type breakdown
        exam_types_data = []
        for exam_type in results.values_list('exam_type', flat=True).distinct():
            exam_results = results.filter(exam_type=exam_type)
            exam_percentages = []
            for result in exam_results:
                if result.max_score > 0:
                    exam_percentages.append((result.score / result.max_score) * 100)
            
            exam_types_data.append({
                'exam_type': exam_type,
                'average': round(sum(exam_percentages) / len(exam_percentages), 2) if exam_percentages else 0,
                'count': exam_results.count()
            })
        
        # Get top performers
        top_performers = []
        student_averages = {}
        for result in results:
            student_id = result.student.id
            percentage = (result.score / result.max_score * 100) if result.max_score > 0 else 0
            
            if student_id not in student_averages:
                student_averages[student_id] = {
                    'student': result.student,
                    'scores': [],
                    'total': 0,
                    'count': 0
                }
            
            student_averages[student_id]['scores'].append(percentage)
            student_averages[student_id]['total'] += percentage
            student_averages[student_id]['count'] += 1
        
        for student_id, data in student_averages.items():
            avg = data['total'] / data['count']
            top_performers.append({
                'student_name': f"{data['student'].user.first_name} {data['student'].user.last_name}",
                'student_number': data['student'].user.student_number or '',
                'average_percentage': round(avg, 2)
            })
        
        # Sort by average and get top 5
        top_performers = sorted(top_performers, key=lambda x: x['average_percentage'], reverse=True)[:5]
        
        return Response({
            'subject_name': subject.name,
            'subject_code': subject.code,
            'total_students': total_students,
            'total_results': results.count(),
            'average_percentage': round(avg_percentage, 2),
            'highest_percentage': round(max(percentages), 2) if percentages else 0,
            'lowest_percentage': round(min(percentages), 2) if percentages else 0,
            'pass_rate': round(pass_rate, 2),
            'exam_types': exam_types_data,
            'top_performers': top_performers
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, 
                       status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_marks_breakdown(request, student_id):
    """
    Detailed marks for one student from teacher performance page.

    Query params:
    - subject (required): selected subject from the teacher page

    Scope rules:
    - If the requesting teacher is this student's class teacher, return all subjects.
    - Otherwise return only the selected subject (if teacher is authorised for it).
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)

    subject_id = request.query_params.get('subject')
    if not subject_id:
        return Response({'error': 'subject is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        subject_id_int = int(subject_id)
    except (TypeError, ValueError):
        return Response({'error': 'subject must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        teacher = request.user.teacher
        student = Student.objects.select_related('user', 'student_class').get(
            id=student_id, student_class__school=request.user.school
        )
        subject = Subject.objects.get(id=subject_id_int, school=request.user.school)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

    is_class_teacher = bool(student.student_class_id) and Class.objects.filter(
        id=student.student_class_id, class_teacher=request.user
    ).exists()

    if not is_class_teacher:
        teaches_subject = teacher.subjects_taught.filter(id=subject_id_int).exists()
        if not teaches_subject:
            return Response({'error': 'You do not teach this subject'}, status=status.HTTP_403_FORBIDDEN)

        authorised_class_ids = _teacher_authorized_class_ids(teacher, subject_id=subject_id_int)
        has_historical_result = Result.objects.filter(
            student=student, subject_id=subject_id_int, teacher=teacher
        ).exists()
        if student.student_class_id not in authorised_class_ids and not has_historical_result:
            return Response(
                {'error': "You are not assigned to teach this student's class for this subject"},
                status=status.HTTP_403_FORBIDDEN,
            )

    results_qs = Result.objects.filter(student=student).select_related(
        'student__user', 'subject', 'teacher__user', 'assessment_plan'
    )
    if not is_class_teacher:
        results_qs = results_qs.filter(subject_id=subject_id_int)

    results_qs = results_qs.order_by('-academic_year', '-academic_term', 'subject__name', '-date_recorded', '-id')
    serialized = ResultSerializer(results_qs, many=True).data

    by_subject = {}
    for row in serialized:
        key = row.get('subject_name') or 'Unknown Subject'
        bucket = by_subject.setdefault(key, {'subject_name': key, 'count': 0, 'total_percentage': 0.0})
        bucket['count'] += 1
        bucket['total_percentage'] += float(row.get('percentage') or 0)

    summaries = []
    for item in by_subject.values():
        count = item['count']
        avg = (item['total_percentage'] / count) if count else 0.0
        summaries.append({
            'subject_name': item['subject_name'],
            'result_count': count,
            'average_percentage': round(avg, 2),
        })
    summaries.sort(key=lambda s: s['subject_name'])

    return Response({
        'student': {
            'id': student.id,
            'name': student.user.get_full_name(),
            'student_number': student.user.student_number or '',
            'class_name': student.student_class.name if student.student_class_id else '',
        },
        'selected_subject': {
            'id': subject.id,
            'name': subject.name,
            'code': subject.code,
        },
        'scope': 'all_subjects' if is_class_teacher else 'selected_subject',
        'is_class_teacher_view': is_class_teacher,
        'total_results': len(serialized),
        'subject_summaries': summaries,
        'results': serialized,
    })


## --------------- helpers ---------------

def _parse_date(raw):
    """Return a date object or None."""
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None

VALID_STATUSES = {'present', 'absent', 'late', 'excused'}


def _period_tracking_active(school, attendance_date):
    settings = SchoolSettings.objects.filter(school=school).first()
    if not settings or not settings.attendance_period_tracking_start_date:
        return False
    return attendance_date >= settings.attendance_period_tracking_start_date


def _has_approved_permission(student, class_obj, attendance_date, period_number):
    permission_qs = AttendancePermission.objects.filter(
        student=student,
        class_assigned=class_obj,
        date=attendance_date,
        approved=True,
    )
    if period_number is not None:
        permission_qs = permission_qs.filter(Q(period_number=period_number) | Q(period_number__isnull=True))
    return permission_qs.exists()


## --------------- CLASS attendance ---------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def class_attendance_register(request):
    """Return the class attendance register for the class teacher's class."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_date = _parse_date(request.query_params.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Class attendance is only for the class teacher's own class
        teacher_class = Class.objects.filter(class_teacher=request.user).first()
        if not teacher_class:
            return Response({
                'no_class': True,
                'error': 'You are not a class teacher. Contact admin to assign you as a class teacher.',
                'students': [],
                'class_name': ''
            })

        students = (Student.objects.filter(student_class=teacher_class)
                    .select_related('user', 'student_class')
                    .order_by('user__last_name', 'user__first_name'))

        records = ClassAttendance.objects.filter(date=attendance_date, student__in=students)
        att_map = {r.student_id: {'status': r.status, 'remarks': r.remarks, 'id': r.id} for r in records}

        # locked = at least one record already exists for this date+class
        locked = records.exists()

        data = []
        for s in students:
            info = att_map.get(s.id, {'status': None, 'remarks': '', 'id': None})
            data.append({
                'student_id': s.id,
                'student_number': s.user.student_number or '',
                'name': s.user.first_name,
                'surname': s.user.last_name,
                'class': s.student_class.name if s.student_class else 'Not Assigned',
                'attendance_id': info['id'],
                'status': info['status'],
                'remarks': info['remarks'],
            })

        return Response({
            'date': str(attendance_date),
            'class_name': teacher_class.name,
            'class_id': teacher_class.id,
            'locked': locked,
            'students': data,
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_class_attendance(request):
    """Bulk-create class attendance for a day. Rejects if already marked."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_data = request.data.get('attendance', [])
        attendance_date = _parse_date(request.data.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not attendance_data:
            return Response({'error': 'Attendance data is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Only class teacher can mark class attendance
        teacher_class = Class.objects.filter(class_teacher=request.user).first()
        if not teacher_class:
            return Response({'error': 'You are not a class teacher'},
                            status=status.HTTP_403_FORBIDDEN)

        # Lock check — if any record already exists for this class+date, reject
        already_exists = ClassAttendance.objects.filter(
            class_assigned=teacher_class, date=attendance_date
        ).exists()
        if already_exists:
            return Response({'error': 'Class attendance for this date has already been submitted and cannot be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []
        for item in attendance_data:
            student_id = item.get('student_id')
            status_value = item.get('status')
            remarks = item.get('remarks', '')

            if not student_id or not status_value:
                errors.append('Missing student_id or status for an entry')
                continue
            if status_value not in VALID_STATUSES:
                errors.append(f"Invalid status '{status_value}' for student {student_id}")
                continue
            try:
                student = Student.objects.get(id=student_id)
                if student.student_class_id != teacher_class.id:
                    errors.append(f'Student {student_id} is not in your class')
                    continue
                ClassAttendance.objects.create(
                    student=student,
                    class_assigned=teacher_class,
                    date=attendance_date,
                    status=status_value,
                    remarks=remarks,
                    recorded_by=request.user,
                )
                created_count += 1
            except Student.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')

        return Response({
            'message': 'Class attendance submitted successfully',
            'created': created_count,
            'errors': errors if errors else None,
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


## --------------- SUBJECT attendance ---------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_attendance_register(request):
    """Return the subject attendance register for a specific class+subject the teacher teaches."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_date = _parse_date(request.query_params.get('date', str(datetime.now().date())))
        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)

        class_id = request.query_params.get('class_id')
        subject_id = request.query_params.get('subject_id')
        period_number = request.query_params.get('period_number')
        period_label = (request.query_params.get('period_label') or '').strip()
        if not class_id or not subject_id:
            return Response({'error': 'class_id and subject_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Verify the teacher teaches this subject in this class via timetable
        teaches = Timetable.objects.filter(
            teacher=teacher, class_assigned_id=class_id, subject_id=subject_id
        ).exists()
        if not teaches:
            return Response({'error': 'You do not teach this subject in this class'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            the_class = Class.objects.get(id=class_id)
            the_subject = Subject.objects.get(id=subject_id)
        except (Class.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Class or subject not found'}, status=status.HTTP_404_NOT_FOUND)

        students = (Student.objects.filter(student_class=the_class)
                    .select_related('user', 'student_class')
                    .order_by('user__last_name', 'user__first_name'))

        parsed_period_number = None
        if period_number not in (None, ''):
            try:
                parsed_period_number = int(period_number)
                if parsed_period_number < 1:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'period_number must be a positive integer'},
                                status=status.HTTP_400_BAD_REQUEST)

        records = SubjectAttendance.objects.filter(
            date=attendance_date, subject=the_subject, student__in=students
        )
        if parsed_period_number is not None:
            records = records.filter(period_number=parsed_period_number)
        elif period_label:
            records = records.filter(period_label=period_label)
        att_map = {
            r.student_id: {
                'status': r.status,
                'remarks': r.remarks,
                'id': r.id,
                'period_number': r.period_number,
                'period_label': r.period_label,
                'marked_with_permission': r.marked_with_permission,
                'bunk_flag': r.bunk_flag,
                'bunk_reason': r.bunk_reason,
            }
            for r in records
        }

        locked = records.exists()

        data = []
        for s in students:
            info = att_map.get(
                s.id,
                {
                    'status': None, 'remarks': '', 'id': None, 'period_number': None,
                    'period_label': '', 'marked_with_permission': False, 'bunk_flag': False, 'bunk_reason': '',
                }
            )
            data.append({
                'student_id': s.id,
                'student_number': s.user.student_number or '',
                'name': s.user.first_name,
                'surname': s.user.last_name,
                'class': s.student_class.name if s.student_class else 'Not Assigned',
                'attendance_id': info['id'],
                'status': info['status'],
                'remarks': info['remarks'],
                'period_number': info['period_number'],
                'period_label': info['period_label'],
                'marked_with_permission': info['marked_with_permission'],
                'bunk_flag': info['bunk_flag'],
                'bunk_reason': info['bunk_reason'],
            })

        return Response({
            'date': str(attendance_date),
            'class_name': the_class.name,
            'class_id': the_class.id,
            'subject_name': the_subject.name,
            'subject_id': the_subject.id,
            'period_number': parsed_period_number,
            'period_label': period_label,
            'locked': locked,
            'students': data,
        })
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_subject_attendance(request):
    """Bulk-create subject attendance for a class+subject+day. Rejects if already marked."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        attendance_data = request.data.get('attendance', [])
        attendance_date = _parse_date(request.data.get('date', str(datetime.now().date())))
        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')
        period_number = request.data.get('period_number')
        period_label = (request.data.get('period_label') or '').strip()

        if not attendance_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not attendance_data:
            return Response({'error': 'Attendance data is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not class_id or not subject_id:
            return Response({'error': 'class_id and subject_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Verify teacher teaches this subject in this class
        teaches = Timetable.objects.filter(
            teacher=teacher, class_assigned_id=class_id, subject_id=subject_id
        ).exists()
        if not teaches:
            return Response({'error': 'You do not teach this subject in this class'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            the_class = Class.objects.get(id=class_id)
            the_subject = Subject.objects.get(id=subject_id)
        except (Class.DoesNotExist, Subject.DoesNotExist):
            return Response({'error': 'Class or subject not found'}, status=status.HTTP_404_NOT_FOUND)

        parsed_period_number = None
        if period_number not in (None, ''):
            try:
                parsed_period_number = int(period_number)
                if parsed_period_number < 1:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'period_number must be a positive integer'},
                                status=status.HTTP_400_BAD_REQUEST)

        # Lock check
        existing_qs = SubjectAttendance.objects.filter(
            class_assigned=the_class, subject=the_subject, date=attendance_date
        )
        if parsed_period_number is not None:
            existing_qs = existing_qs.filter(period_number=parsed_period_number)
        elif period_label:
            existing_qs = existing_qs.filter(period_label=period_label)
        already_exists = existing_qs.exists()
        if already_exists:
            return Response({'error': 'Subject attendance for this class and date has already been submitted and cannot be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []
        for item in attendance_data:
            student_id = item.get('student_id')
            status_value = item.get('status')
            remarks = item.get('remarks', '')

            if not student_id or not status_value:
                errors.append('Missing student_id or status for an entry')
                continue
            if status_value not in VALID_STATUSES:
                errors.append(f"Invalid status '{status_value}' for student {student_id}")
                continue
            try:
                student = Student.objects.get(id=student_id)
                if student.student_class_id != the_class.id:
                    errors.append(f'Student {student_id} is not in this class')
                    continue
                daily = ClassAttendance.objects.filter(student=student, date=attendance_date).first()
                has_permission = _has_approved_permission(student, the_class, attendance_date, parsed_period_number)
                period_rules_active = _period_tracking_active(request.user.school, attendance_date)

                bunk_flag = False
                bunk_reason = ''
                if period_rules_active and status_value == 'absent' and not has_permission:
                    if daily and daily.status in ('present', 'late'):
                        bunk_flag = True
                        bunk_reason = 'Absent during period without approved permission'

                SubjectAttendance.objects.create(
                    student=student,
                    class_assigned=the_class,
                    subject=the_subject,
                    date=attendance_date,
                    period_number=parsed_period_number,
                    period_label=period_label,
                    status=status_value,
                    remarks=remarks,
                    marked_with_permission=has_permission,
                    bunk_flag=bunk_flag,
                    bunk_reason=bunk_reason,
                    recorded_by=request.user,
                )
                created_count += 1
            except Student.DoesNotExist:
                errors.append(f'Student with ID {student_id} not found')

        return Response({
            'message': 'Subject attendance submitted successfully',
            'created': created_count,
            'errors': errors if errors else None,
        }, status=status.HTTP_201_CREATED)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


# ── Assignment Submission Management ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def assignment_submissions(request, assignment_id):
    """List all student submissions for an assignment (teacher only)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import Assignment, AssignmentSubmission

    try:
        assignment = Assignment.objects.select_related('subject', 'assigned_class').get(
            id=assignment_id, teacher=teacher
        )
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found or not yours'}, status=status.HTTP_404_NOT_FOUND)

    submissions = (
        AssignmentSubmission.objects
        .filter(assignment=assignment)
        .select_related('student__user')
        .prefetch_related('attachments')
        .order_by('submitted_at')
    )

    data = []
    for s in submissions:
        data.append({
            'id': s.id,
            'student_id': s.student.id,
            'student_name': f"{s.student.user.first_name} {s.student.user.last_name}",
            'student_number': s.student.user.student_number or '',
            'status': s.status,
            'submitted_at': s.submitted_at.isoformat(),
            'grade': s.grade,
            'feedback': s.feedback,
            'text_submission': s.text_submission,
            'file_url': s.submitted_file.url if s.submitted_file else None,
            'is_late': s.is_late,
            'attachments': [
                {
                    'id': att.id,
                    'file_key': att.file_key,
                    'original_filename': att.original_filename,
                    'mime_type': att.mime_type,
                    'size_bytes': att.size_bytes,
                }
                for att in s.attachments.all()
            ],
        })

    total_students = assignment.assigned_class.students.count()
    return Response({
        'assignment_id': assignment_id,
        'assignment_title': assignment.title,
        'deadline': assignment.deadline.isoformat(),
        'total_students': total_students,
        'submitted_count': len(data),
        'submissions': data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def grade_submission(request, submission_id):
    """Grade a student submission (teacher only)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    from .models import AssignmentSubmission

    try:
        submission = AssignmentSubmission.objects.select_related(
            'assignment__teacher'
        ).get(id=submission_id, assignment__teacher=teacher)
    except AssignmentSubmission.DoesNotExist:
        return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    grade = request.data.get('grade')
    feedback = request.data.get('feedback', '')

    if grade is None:
        return Response({'error': 'grade is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        grade = float(grade)
    except (TypeError, ValueError):
        return Response({'error': 'grade must be a number'}, status=status.HTTP_400_BAD_REQUEST)

    school_settings = SchoolSettings.objects.filter(school=request.user.school).first()
    penalty_mode = (school_settings.late_assignment_penalty_mode if school_settings else 'none')
    penalty_percent = (school_settings.late_assignment_penalty_percent if school_settings else 0.0)
    final_grade, penalty_points = apply_late_penalty(
        raw_grade=grade,
        max_score=submission.assignment.max_score,
        mode=penalty_mode if submission.is_late else 'none',
        percent=penalty_percent if submission.is_late else 0.0,
    )

    submission.grade = final_grade
    submission.feedback = feedback
    submission.status = 'graded'
    submission.returned_at = timezone.now()
    submission.save(update_fields=['grade', 'feedback', 'status', 'returned_at'])
    log_school_audit(
        user=request.user,
        action='UPDATE',
        model_name='AssignmentSubmission',
        object_id=submission.id,
        object_repr=f"{submission.assignment.title} - {submission.student.user.full_name}",
        changes={
            'raw_grade': grade,
            'final_grade': final_grade,
            'penalty_points': penalty_points,
            'penalty_mode': penalty_mode if submission.is_late else 'none',
            'penalty_percent': penalty_percent if submission.is_late else 0.0,
        },
        status_code=200,
        ip_address=request.META.get('REMOTE_ADDR'),
    )

    return Response({
        'message': 'Graded successfully.',
        'submission_id': submission_id,
        'grade': submission.grade,
        'raw_grade': grade,
        'penalty_points': penalty_points,
        'penalty_mode': penalty_mode if submission.is_late else 'none',
        'penalty_percent': penalty_percent if submission.is_late else 0.0,
        'feedback': submission.feedback,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def results_for_report(request):
    """
    List results for a class/subject so the teacher can manage which ones
    appear on the report card and which term they count toward.
    Query params: ?class_id=X&subject_id=Y&year=2025
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    class_id = request.query_params.get('class_id')
    subject_id = request.query_params.get('subject_id')
    year = request.query_params.get('year', str(datetime.now().year))

    if not class_id or not subject_id:
        return Response({'error': 'class_id and subject_id are required'},
                        status=status.HTTP_400_BAD_REQUEST)

    results = (
        Result.objects.filter(
            teacher=teacher,
            subject_id=subject_id,
            student__student_class_id=class_id,
            academic_year=year,
        )
        .select_related('student__user', 'subject')
        .order_by('student__user__last_name', 'student__user__first_name', 'exam_type')
    )

    data = []
    for r in results:
        data.append({
            'id': r.id,
            'student_id': r.student.id,
            'student_name': r.student.user.full_name,
            'student_number': r.student.user.student_number or '',
            'subject_name': r.subject.name,
            'exam_type': r.exam_type,
            'score': r.score,
            'max_score': r.max_score,
            'percentage': round((r.score / r.max_score) * 100, 2) if r.max_score > 0 else 0,
            'academic_term': r.academic_term,
            'include_in_report': r.include_in_report,
            'report_term': r.report_term,
            'effective_term': r.report_term if r.report_term else r.academic_term,
        })

    return Response({'results': data})


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_report_settings(request):
    """
    Bulk update include_in_report and report_term on results.
    Body: { "updates": [ { "id": 123, "include_in_report": true, "report_term": "Term 3" }, ... ] }
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    updates = request.data.get('updates', [])
    if not updates:
        return Response({'error': 'No updates provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate all IDs belong to this teacher
    result_ids = [u['id'] for u in updates if 'id' in u]
    teacher_results = Result.objects.filter(id__in=result_ids, teacher=teacher)
    valid_ids = set(teacher_results.values_list('id', flat=True))

    updated_count = 0
    errors = []
    for u in updates:
        rid = u.get('id')
        if rid not in valid_ids:
            errors.append(f'Result {rid} not found or not yours')
            continue

        update_fields = {}
        if 'include_in_report' in u:
            update_fields['include_in_report'] = bool(u['include_in_report'])
        if 'report_term' in u:
            update_fields['report_term'] = u['report_term']

        if update_fields:
            Result.objects.filter(id=rid).update(**update_fields)
            updated_count += 1

    return Response({
        'message': f'{updated_count} result(s) updated',
        'updated': updated_count,
        'errors': errors if errors else None,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_classes(request):
    """Get all classes this teacher is authorized for (class teacher + assigned forms + timetable)."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                       status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher
        from .models import Timetable

        # Classes where teacher is class_teacher
        class_teacher_classes = set(Class.objects.filter(
            class_teacher=request.user
        ).values_list('id', flat=True))

        # Classes explicitly assigned by admin for teaching
        assigned_teaching_classes = set(
            teacher.teaching_classes.values_list('id', flat=True)
        )

        # Classes where teacher has timetable entries
        timetable_classes = set(Timetable.objects.filter(
            teacher=teacher
        ).values_list('class_assigned_id', flat=True).distinct())

        all_class_ids = class_teacher_classes | assigned_teaching_classes | timetable_classes
        classes = Class.objects.filter(id__in=all_class_ids).order_by('name')

        data = [{
            'id': c.id,
            'name': c.name,
            'grade_level': c.grade_level,
            'academic_year': c.academic_year,
            'is_class_teacher': c.id in class_teacher_classes,
            'is_assigned_teaching_class': c.id in assigned_teaching_classes,
            'student_count': c.students.count(),
        } for c in classes]

        return Response({'classes': data})
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_class_subjects(request, class_id):
    """Get subjects this teacher teaches in a specific class."""
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher

        try:
            class_id_int = int(class_id)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid class id'}, status=status.HTTP_400_BAD_REQUEST)

        authorized_class_ids = _teacher_authorized_class_ids(
            teacher, fallback_to_school=False
        )
        if class_id_int not in authorized_class_ids:
            return Response({'error': 'You are not assigned to this class'}, status=status.HTTP_403_FORBIDDEN)

        subject_ids = list(
            Timetable.objects
            .filter(teacher=teacher, class_assigned_id=class_id_int)
            .values_list('subject_id', flat=True)
            .distinct()
        )
        if not subject_ids:
            subject_ids = list(teacher.subjects_taught.values_list('id', flat=True))

        subjects = Subject.objects.filter(id__in=subject_ids, school=request.user.school).order_by('name')
        data = [{'id': s.id, 'name': s.name, 'code': s.code} for s in subjects]
        return Response(data)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------
# Per-subject report card feedback (comment + effort grade)
# ---------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_feedback_list(request):
    """List per-subject feedback for a class/subject/term.
    Query: ?class_id=&subject_id=&year=&term="""
    user = request.user
    if user.role not in ('teacher', 'admin', 'hr'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    class_id = request.query_params.get('class_id')
    subject_id = request.query_params.get('subject_id')
    year = _normalize_report_year(request.query_params.get('year', ''))
    term = _normalize_report_term(request.query_params.get('term', ''))
    if not (class_id and subject_id and year and term):
        return Response({'error': 'class_id, subject_id, year, term are required'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not _report_batch_generated(user.school, class_id, year, term):
        return Response(
            {'error': 'Admin must generate this class report batch before teachers can work on feedback.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if user.role == 'teacher':
        try:
            teacher = user.teacher
        except Teacher.DoesNotExist:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
        authorised = _teacher_authorized_class_ids(teacher, subject_id=int(subject_id))
        if int(class_id) not in authorised:
            return Response({'error': 'Not authorised for this class/subject'}, status=status.HTTP_403_FORBIDDEN)

    students = Student.objects.filter(
        student_class_id=class_id, user__school=user.school,
    ).select_related('user').order_by('user__last_name', 'user__first_name')
    existing = {
        fb.student_id: fb for fb in SubjectTermFeedback.objects.filter(
            student__in=students, subject_id=subject_id,
            academic_year=year, academic_term=term,
        )
    }
    data = []
    for s in students:
        fb = existing.get(s.id)
        data.append({
            'student_id': s.id,
            'full_name': s.user.full_name,
            'student_number': s.user.student_number or '',
            'comment': fb.comment if fb else '',
            'effort_grade': fb.effort_grade if fb else '',
        })
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def subject_feedback_upsert(request):
    """Body: { student_id, subject_id, year, term, comment, effort_grade }"""
    user = request.user
    if user.role not in ('teacher', 'admin', 'hr'):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student_id = int(request.data.get('student_id'))
        subject_id = int(request.data.get('subject_id'))
    except (TypeError, ValueError):
        return Response({'error': 'student_id and subject_id must be integers'}, status=status.HTTP_400_BAD_REQUEST)
    year = _normalize_report_year(request.data.get('year', ''))
    term = _normalize_report_term(request.data.get('term', ''))
    comment = (request.data.get('comment') or '').strip()
    effort = (request.data.get('effort_grade') or '').strip().upper()
    if effort and effort not in {'A', 'B', 'C', 'D', 'E'}:
        return Response({'error': 'effort_grade must be A-E or blank'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        student = Student.objects.select_related('user').get(id=student_id, user__school=user.school)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    if not _report_batch_generated(user.school, student.student_class_id, year, term):
        return Response(
            {'error': 'Admin must generate this class report batch before teachers can submit feedback.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    teacher = None
    if user.role == 'teacher':
        try:
            teacher = user.teacher
        except Teacher.DoesNotExist:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
        authorised = _teacher_authorized_class_ids(teacher, subject_id=subject_id)
        if student.student_class_id not in authorised:
            return Response({'error': 'Not authorised for this student'}, status=status.HTTP_403_FORBIDDEN)

    from users.models import ReportCardConfig
    try:
        limit = ReportCardConfig.objects.get(school=user.school).comment_char_limit
    except ReportCardConfig.DoesNotExist:
        limit = 250
    if limit and len(comment) > limit:
        comment = comment[:limit]

    fb, _ = SubjectTermFeedback.objects.update_or_create(
        student_id=student_id, subject_id=subject_id,
        academic_year=year, academic_term=term,
        defaults={'comment': comment, 'effort_grade': effort, 'teacher': teacher},
    )
    return Response({
        'id': fb.id, 'student_id': student_id, 'subject_id': subject_id,
        'comment': fb.comment, 'effort_grade': fb.effort_grade,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def report_feedback_config(request):
    """Return report-feedback config visible to teachers."""
    user = request.user
    if user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)

    from users.models import ReportCardConfig
    try:
        limit = ReportCardConfig.objects.get(school=user.school).comment_char_limit
    except ReportCardConfig.DoesNotExist:
        limit = 250

    return Response({
        'comment_char_limit': limit or 250,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def report_feedback_submission_status(request):
    """Return submission status for a class/year/term for the logged-in teacher."""
    user = request.user
    if user.role != 'teacher':
        return Response({'error': 'Only teachers can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)

    class_id = request.query_params.get('class_id')
    year = _normalize_report_year(request.query_params.get('year', ''))
    term = _normalize_report_term(request.query_params.get('term', ''))
    if not (class_id and year and term):
        return Response({'error': 'class_id, year, term are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        class_id_int = int(class_id)
    except (TypeError, ValueError):
        return Response({'error': 'class_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        teacher = user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    authorised = _teacher_authorized_class_ids(teacher)
    if class_id_int not in authorised:
        return Response({'error': 'Not authorised for this class'}, status=status.HTTP_403_FORBIDDEN)

    req = ReportCardApprovalRequest.objects.filter(
        school=user.school,
        class_obj_id=class_id_int,
        academic_year=year,
        academic_term=term,
    ).first()

    return Response({
        'status': req.status if req else 'not_submitted',
        'submitted_at': req.submitted_at.isoformat() if req else None,
        'reviewed_at': req.reviewed_at.isoformat() if req and req.reviewed_at else None,
        'admin_note': req.admin_note if req else '',
        'teacher_comment': req.teacher_comment if req else '',
        'requested_by': req.requested_by.full_name if req and req.requested_by else None,
        'is_generated': _report_batch_generated(user.school, class_id_int, year, term),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_report_feedback_for_signoff(request):
    """Teacher submits a class/year/term report set for admin final sign-off."""
    user = request.user
    if user.role != 'teacher':
        return Response({'error': 'Only teachers can submit reports'}, status=status.HTTP_403_FORBIDDEN)

    class_id = request.data.get('class_id')
    year = _normalize_report_year(request.data.get('year', ''))
    term = _normalize_report_term(request.data.get('term', ''))
    if not (class_id and year and term):
        return Response({'error': 'class_id, year, term are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        class_id_int = int(class_id)
    except (TypeError, ValueError):
        return Response({'error': 'class_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        teacher = user.teacher
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    authorised = _teacher_authorized_class_ids(teacher)
    if class_id_int not in authorised:
        return Response({'error': 'Not authorised for this class'}, status=status.HTTP_403_FORBIDDEN)

    class_obj = Class.objects.filter(id=class_id_int, school=user.school).first()
    if not class_obj:
        return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)

    if not _report_batch_generated(user.school, class_id_int, year, term):
        return Response(
            {'error': 'Admin has not generated this class report batch yet.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    teacher_comment = (request.data.get('teacher_comment') or '').strip()
    req, created = ReportCardApprovalRequest.objects.get_or_create(
        school=user.school,
        class_obj=class_obj,
        academic_year=year,
        academic_term=term,
        defaults={
            'requested_by': user,
            'status': 'pending',
            'admin_note': '',
            'teacher_comment': teacher_comment,
            'reviewed_at': None,
            'reviewed_by': None,
        },
    )

    if not created:
        req.requested_by = user
        req.status = 'pending'
        req.reviewed_at = None
        req.reviewed_by = None
        req.admin_note = ''
        req.teacher_comment = teacher_comment
        req.save(update_fields=['requested_by', 'status', 'reviewed_at', 'reviewed_by', 'admin_note', 'teacher_comment'])

    # Notify admins in this school
    from users.models import CustomUser, Notification
    admin_users = CustomUser.objects.filter(
        school=user.school,
        is_active=True,
        role__in=['admin', 'superadmin'],
    )
    notes = [
        Notification(
            user=admin,
            title='Report Sign-off Requested',
            message=(
                f"{user.full_name} submitted {class_obj.name} report feedback for "
                f"{term} {year}. Please review and sign off."
            ),
            notification_type='general',
            link='/admin/report-config',
        )
        for admin in admin_users
    ]
    if notes:
        Notification.objects.bulk_create(notes)

    return Response({
        'message': 'Report feedback submitted for admin sign-off.',
        'request_id': req.id,
        'status': req.status,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subject_students_risk(request, subject_id):
    """
    Get all students in a subject taught by the teacher with ML risk predictions.
    Supports search, filtering, and sorting.
    
    Query params:
        search: Filter by name, email, or student number
        at_risk: 'all' (default), 'at_risk', or 'safe'
        sort_by: 'name', 'risk_score', 'trend' (default: 'risk_score')
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Only teachers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        teacher = request.user.teacher
        subject = Subject.objects.get(id=subject_id, school=request.user.school)
        
        # Verify teacher teaches this subject
        if not teacher.subjects_taught.filter(id=subject_id).exists():
            return Response({'error': 'You do not teach this subject'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get authorized classes
        authorized_class_ids = _teacher_authorized_class_ids(
            teacher, subject_id=subject_id, fallback_to_school=False
        )
        
        # Get students in authorized classes
        students = Student.objects.filter(
            student_class_id__in=authorized_class_ids,
            user__school=request.user.school,
            user__is_active=True
        ).select_related('user')
        
        # Search filter
        search = request.query_params.get('search', '').strip()
        if search:
            students = students.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__email__icontains=search) |
                Q(user__student_number__icontains=search)
            )
        
        # Get predictions and build results
        from .ml_predictions import predict_student_grades
        
        results = []
        at_risk_filter = request.query_params.get('at_risk', 'all')
        
        for student in students:
            try:
                predictions = predict_student_grades(student)
            except Exception:
                logger.exception(
                    "Failed to generate predictions for student_id=%s subject_id=%s teacher_id=%s",
                    student.id,
                    subject_id,
                    teacher.id,
                )
                continue

            subject_pred = next((p for p in predictions if p['subject_id'] == subject_id), None)
            
            if subject_pred:
                is_at_risk = subject_pred['at_risk']
                
                # Apply at_risk filter
                if at_risk_filter == 'at_risk' and not is_at_risk:
                    continue
                elif at_risk_filter == 'safe' and is_at_risk:
                    continue
                
                results.append({
                    'student_id': student.id,
                    'name': student.user.full_name,
                    'student_number': student.user.student_number or '',
                    'email': student.user.email,
                    'current_grade': subject_pred['current_grade'],
                    'current_percentage': round(subject_pred['current_percentage'], 1),
                    'predicted_grade': subject_pred['predicted_grade'],
                    'predicted_percentage': round(subject_pred['predicted_percentage'], 1),
                    'at_risk': is_at_risk,
                    'predicted_at_risk': subject_pred['predicted_at_risk'],
                    'trend': subject_pred['trend'],
                    'confidence': subject_pred['confidence'],
                    'intervention': subject_pred['intervention'],
                    'will_pass': subject_pred['will_pass'],
                })
        
        # Sort
        sort_by = request.query_params.get('sort_by', 'risk_score')
        if sort_by == 'name':
            results.sort(key=lambda x: x['name'])
        elif sort_by == 'trend':
            trend_order = {'down': 0, 'stable': 1, 'up': 2}
            results.sort(key=lambda x: (not x['at_risk'], trend_order.get(x['trend'], 1)))
        else:  # risk_score (default)
            results.sort(key=lambda x: (not x['at_risk'], x['predicted_percentage']))
        
        return Response({
            'results': results,
            'subject': subject.name,
            'subject_code': subject.code,
            'total_students': len(results),
            'at_risk_count': sum(1 for r in results if r['at_risk']),
        })
    
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
        if isinstance(include_in_report, str):
            include_in_report = include_in_report.strip().lower() not in ('false', '0', 'no', 'off')
        else:
            include_in_report = bool(include_in_report)
