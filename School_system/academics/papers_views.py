"""Past exam paper endpoints — metadata only.

The actual files live on disk under the go-services papers store and are
uploaded directly from the browser to /api/v1/services/papers/upload (the
gateway routes that path to go-services). Django stores the returned file_key
plus metadata, and enforces tenant + role checks on listing and deletion.
"""
import os
import urllib.request
import urllib.error
import json as _json

from django.db.models import Q
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import PastExamPaper, Subject, Teacher, Result
from users.models import AuditLog


# ─── Helpers ────────────────────────────────────────────────

def _level_kind_from_school_type(school_type):
    """primary → grade, secondary/high → form, combined → None (caller must specify)."""
    if school_type == 'primary':
        return 'grade'
    if school_type in ('secondary', 'high'):
        return 'form'
    return None


def _validate_file_key(file_key, school_id):
    """File key must be '<school_id>/<filename>'. Returns True if valid."""
    if not isinstance(file_key, str) or '/' not in file_key:
        return False
    prefix, _, filename = file_key.partition('/')
    if not prefix.isdigit() or int(prefix) != int(school_id):
        return False
    if not filename or '..' in filename or '\\' in filename:
        return False
    return True


def _serialize_paper(paper):
    return {
        'id': paper.id,
        'subject_id': paper.subject_id,
        'subject_name': paper.subject.name,
        'subject_code': paper.subject.code,
        'level_kind': paper.level_kind,
        'level_number': paper.level_number,
        'year': paper.year,
        'exam_session': paper.exam_session,
        'paper_number': paper.paper_number,
        'title': paper.title,
        'file_key': paper.file_key,
        'original_filename': paper.original_filename,
        'mime_type': paper.mime_type,
        'size_bytes': paper.size_bytes,
        'page_count': paper.page_count,
        'parse_status': paper.parse_status,
        'uploaded_by_id': paper.uploaded_by_id,
        'uploaded_by_name': paper.uploaded_by.user.get_full_name() if paper.uploaded_by else '',
        'date_uploaded': paper.date_uploaded.isoformat(),
    }


# ─── Endpoints ────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def past_papers_list_create(request):
    """GET: list past papers for current school (filterable).
    POST: create a paper record after the file has been uploaded to go-services.
    """
    user = request.user
    school = user.school
    if not school:
        return Response({'error': 'No school associated.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        qs = PastExamPaper.objects.filter(school=school).select_related('subject', 'uploaded_by__user')

        # Optional filters
        subject_id = request.query_params.get('subject')
        level_kind = request.query_params.get('level_kind')
        level_number = request.query_params.get('level_number')
        year = request.query_params.get('year')
        exam_session = request.query_params.get('exam_session')

        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if level_kind:
            qs = qs.filter(level_kind=level_kind)
        if level_number:
            qs = qs.filter(level_number=level_number)
        if year:
            qs = qs.filter(year=year)
        if exam_session:
            qs = qs.filter(exam_session__iexact=exam_session)

        # Students: restrict to their level + subjects they have results for
        if user.role == 'student':
            try:
                student = user.student
            except Exception:
                return Response({'results': []})
            student_level = student.student_class.grade_level
            kind = _level_kind_from_school_type(school.school_type) or level_kind
            qs = qs.filter(level_number=student_level)
            if kind:
                qs = qs.filter(level_kind=kind)
            subject_ids = list(Result.objects.filter(student=student).values_list('subject_id', flat=True).distinct())
            if subject_ids:
                qs = qs.filter(subject_id__in=subject_ids)
            else:
                # No results yet — show none (avoid leaking unrelated subjects)
                qs = qs.none()

        return Response({'results': [_serialize_paper(p) for p in qs[:500]]})

    # POST — create
    if user.role not in ('teacher', 'admin'):
        return Response({'error': 'Only teachers and admins can upload past papers.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    required = ['subject_id', 'level_number', 'year', 'file_key', 'original_filename', 'mime_type']
    missing = [f for f in required if data.get(f) in (None, '')]
    if missing:
        return Response({'error': f'Missing required fields: {missing}'}, status=status.HTTP_400_BAD_REQUEST)

    if not _validate_file_key(data.get('file_key'), school.id):
        return Response({'error': 'Invalid file_key for this school.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        subject = Subject.objects.get(id=data['subject_id'], school=school)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found in this school.'}, status=status.HTTP_404_NOT_FOUND)

    # Resolve level_kind. For combined schools the client must provide it.
    level_kind = data.get('level_kind') or _level_kind_from_school_type(school.school_type)
    if not level_kind:
        return Response(
            {'error': "level_kind is required for combined schools (must be 'grade' or 'form')."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if level_kind not in ('grade', 'form'):
        return Response({'error': "level_kind must be 'grade' or 'form'."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        level_number = int(data['level_number'])
        year = int(data['year'])
    except (TypeError, ValueError):
        return Response({'error': 'level_number and year must be integers.'}, status=status.HTTP_400_BAD_REQUEST)

    if level_number < 1 or level_number > 13:
        return Response({'error': 'level_number out of range.'}, status=status.HTTP_400_BAD_REQUEST)
    if year < 1990 or year > 2100:
        return Response({'error': 'year out of range.'}, status=status.HTTP_400_BAD_REQUEST)

    teacher = None
    if user.role == 'teacher':
        teacher = Teacher.objects.filter(user=user).first()

    paper = PastExamPaper.objects.create(
        school=school,
        subject=subject,
        level_kind=level_kind,
        level_number=level_number,
        year=year,
        exam_session=(data.get('exam_session') or '').strip(),
        paper_number=int(data.get('paper_number') or 1),
        title=(data.get('title') or '').strip(),
        uploaded_by=teacher,
        file_key=data['file_key'],
        original_filename=data['original_filename'][:255],
        mime_type=data['mime_type'][:100],
        size_bytes=int(data.get('size_bytes') or 0),
        page_count=int(data.get('page_count') or 0),
    )

    try:
        AuditLog.objects.create(
            user=user, school=school, action='CREATE',
            model_name='PastExamPaper', object_id=str(paper.id),
            object_repr=str(paper),
            ip_address=request.META.get('REMOTE_ADDR'), response_status=201,
        )
    except Exception:
        pass

    return Response(_serialize_paper(paper), status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def past_paper_detail(request, pk):
    user = request.user
    school = user.school
    try:
        paper = PastExamPaper.objects.select_related('subject', 'uploaded_by__user').get(pk=pk, school=school)
    except PastExamPaper.DoesNotExist:
        return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(_serialize_paper(paper))

    # DELETE — teacher who uploaded it, or admin
    if user.role not in ('teacher', 'admin'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    if user.role == 'teacher':
        if not paper.uploaded_by or paper.uploaded_by.user_id != user.id:
            return Response({'error': 'You can only delete papers you uploaded.'}, status=status.HTTP_403_FORBIDDEN)

    file_key = paper.file_key
    paper.delete()

    # Best-effort: tell go-services to remove the file from disk.
    _delete_file_from_go_services(file_key, school.id, user)

    try:
        AuditLog.objects.create(
            user=user, school=school, action='DELETE',
            model_name='PastExamPaper', object_id=str(pk),
            object_repr=f'PastExamPaper {pk} ({file_key})',
            ip_address=request.META.get('REMOTE_ADDR'), response_status=200,
        )
    except Exception:
        pass

    return Response({'status': 'deleted'})


def _delete_file_from_go_services(file_key, school_id, user):
    """Internal helper — call go-services to remove the file from disk.
    Failure is non-fatal: the metadata row is already gone.
    """
    base = os.environ.get('GO_SERVICES_INTERNAL_URL') or os.environ.get('GO_SERVICES_UPSTREAM') or 'http://localhost:8082'
    url = f'{base}/api/v1/services/papers/file?key={urllib.request.quote(file_key, safe="")}'
    req = urllib.request.Request(url, method='DELETE')
    req.add_header('X-Gateway-Auth', 'true')
    req.add_header('X-User-ID', str(user.id))
    req.add_header('X-User-Role', user.role)
    req.add_header('X-User-School-ID', str(school_id))
    try:
        urllib.request.urlopen(req, timeout=5)
    except (urllib.error.URLError, TimeoutError):
        pass


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def past_paper_extract(request, pk):
    """Trigger go-services to extract question candidates from a stored paper.

    Returns the candidates back to the caller for review. Marks the paper as
    'parsed' or 'failed' depending on the outcome.
    """
    user = request.user
    if user.role not in ('teacher', 'admin'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    school = user.school
    try:
        paper = PastExamPaper.objects.get(pk=pk, school=school)
    except PastExamPaper.DoesNotExist:
        return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    base = os.environ.get('GO_SERVICES_INTERNAL_URL') or os.environ.get('GO_SERVICES_UPSTREAM') or 'http://localhost:8082'
    url = f'{base}/api/v1/services/papers/extract'
    body = _json.dumps({'file_key': paper.file_key}).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-Gateway-Auth', 'true')
    req.add_header('X-User-ID', str(user.id))
    req.add_header('X-User-Role', user.role)
    req.add_header('X-User-School-ID', str(school.id))

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = _json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            err_body = _json.loads(e.read().decode('utf-8'))
            err_msg = err_body.get('error') or str(e)
        except Exception:
            err_msg = str(e)
        paper.parse_status = 'failed'
        paper.parse_error = err_msg[:1000]
        paper.save(update_fields=['parse_status', 'parse_error'])
        return Response({'error': err_msg}, status=status.HTTP_502_BAD_GATEWAY)
    except (urllib.error.URLError, TimeoutError) as e:
        return Response({'error': f'go-services unreachable: {e}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    paper.parse_status = 'parsed'
    paper.parse_error = ''
    if payload.get('page_count') and not paper.page_count:
        paper.page_count = int(payload['page_count'])
    paper.save(update_fields=['parse_status', 'parse_error', 'page_count'])

    return Response({
        'paper': _serialize_paper(paper),
        'questions': payload.get('questions', []),
    })
