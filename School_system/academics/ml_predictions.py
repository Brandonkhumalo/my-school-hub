"""
ML Grade Predictions — linear regression over past results.

Uses scikit-learn when available; falls back to a simple slope calculation
so the app keeps working in environments without scikit-learn installed.

Grading follows the Zimbabwe academic system (see academics/grading.py):
  A = Distinction  (70–100%)  — pass
  B = Merit        (60–69%)   — pass
  C = Credit       (50–59%)   — minimum pass mark
  D = Satisfactory (40–49%)   — below pass mark, at risk
  E = Fail         (0–39%)    — fail
  U = Unsatisfactory          — incomplete / ungraded
"""
import logging

logger = logging.getLogger(__name__)

from .grading import (
    percentage_to_grade,
    score_to_percentage,
    is_at_risk,
    is_passing,
    PASS_MARK,
)


# ── Prediction maths ──────────────────────────────────────────────────────────

def _linear_predict(scores):
    """Simple slope-based prediction without scikit-learn."""
    n = len(scores)
    if n == 1:
        return scores[0]
    x_mean = (n - 1) / 2
    y_mean = sum(scores) / n
    numerator = sum((i - x_mean) * (scores[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return y_mean
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    return slope * n + intercept


def _sklearn_predict(scores):
    """Linear regression using scikit-learn."""
    import numpy as np
    from sklearn.linear_model import LinearRegression

    X = np.arange(len(scores)).reshape(-1, 1)
    y = np.array(scores, dtype=float)
    model = LinearRegression().fit(X, y)
    next_x = np.array([[len(scores)]])
    return float(model.predict(next_x)[0])


def _compute_prediction(scores):
    """Returns (predicted_score, used_sklearn)."""
    try:
        return _sklearn_predict(scores), True
    except Exception:
        # Keep API resilient if sklearn/numpy is missing or misconfigured at runtime.
        logger.exception("Falling back to linear prediction for scores=%s", scores)
        return _linear_predict(scores), False


def _confidence(n, std_dev, max_score):
    """Derive a confidence label based on sample size and score variance."""
    if n >= 4 and std_dev <= max_score * 0.1:
        return 'high'
    if n >= 2 and std_dev <= max_score * 0.25:
        return 'medium'
    return 'low'


def _trend(scores):
    """Execute trend."""
    if len(scores) < 2:
        return 'stable'
    delta = scores[-1] - scores[0]
    if delta > 2:
        return 'up'
    if delta < -2:
        return 'down'
    return 'stable'


# ── Intervention message builder ──────────────────────────────────────────────

def _intervention_message(grade: str, trend: str, subject: str) -> str:
    """Human-readable recommendation for teachers / parents."""
    if grade == 'A':
        if trend == 'up':
            return f"Excellent performance in {subject}. Keep up the great work."
        return f"Distinction level in {subject}. Maintain current study habits."
    if grade == 'B':
        if trend == 'up':
            return f"Good progress in {subject}. Push for Distinction — needs 70%."
        return f"Merit level in {subject}. Small improvements could earn a Distinction."
    if grade == 'C':
        if trend == 'down':
            return f"Credit in {subject} but performance is declining. Immediate revision recommended to stay above the 50% pass mark."
        return f"Just passing {subject}. Consistent revision needed to secure a pass."
    if grade == 'D':
        return (
            f"At risk of failing {subject} — currently below the 50% pass mark. "
            f"Urgent teacher intervention and extra support are recommended."
        )
    if grade in ('E', 'U'):
        return (
            f"Failing {subject}. Student requires immediate academic support, "
            f"extra lessons, and close monitoring. Pass mark is 50%."
        )
    return f"Insufficient data to give a recommendation for {subject}."


# ── Public API ────────────────────────────────────────────────────────────────

def predict_student_grades(student):
    """
    Predict next-term scores for each subject the student has results in.

    Returns a list of dicts:
    [
        {
            'subject_id':           int,
            'subject':              str,
            'current_avg':          float,           # raw score average
            'current_percentage':   float,           # as %
            'current_grade':        'A'|'B'|'C'|'D'|'E'|'U',
            'current_description':  'Distinction'|...,
            'predicted_score':      float,           # clamped raw score
            'predicted_percentage': float,           # as %
            'predicted_grade':      'A'|'B'|'C'|'D'|'E'|'U',
            'predicted_description':'Distinction'|...,
            'max_score':            float,
            'trend':                'up'|'down'|'stable',
            'confidence':           'high'|'medium'|'low',
            'passed':               bool,            # current: >= 50%?
            'at_risk':              bool,            # current grade D or E?
            'will_pass':            bool,            # predicted >= 50%?
            'predicted_at_risk':    bool,            # predicted D or E?
            'intervention':         str,             # recommendation message
        },
        ...
    ]
    """
    from .models import Result

    results_qs = (
        Result.objects
        .filter(student=student)
        .select_related('subject')
        .order_by('subject', 'academic_year', 'academic_term')
    )

    # Group by subject
    subject_results: dict = {}
    for r in results_qs:
        sid = r.subject_id
        if sid not in subject_results:
            subject_results[sid] = {'name': r.subject.name, 'entries': []}
        subject_results[sid]['entries'].append(r)

    predictions = []

    for sid, data in subject_results.items():
        entries = data['entries']
        if not entries:
            continue

        scores = [e.score for e in entries]
        max_scores = [e.max_score for e in entries]
        max_score = max(max_scores) if max_scores else 100

        current_avg = sum(scores) / len(scores)
        current_pct = score_to_percentage(current_avg, max_score)
        current_grade_info = percentage_to_grade(current_pct)

        if len(scores) >= 2:
            predicted_raw, _ = _compute_prediction(scores)
        else:
            predicted_raw = scores[0]

        # Clamp to valid range
        predicted_score = max(0.0, min(float(max_score), predicted_raw))
        predicted_pct = score_to_percentage(predicted_score, max_score)
        predicted_grade_info = percentage_to_grade(predicted_pct)

        # Standard deviation for confidence
        variance = sum((s - current_avg) ** 2 for s in scores) / len(scores)
        std_dev = variance ** 0.5

        predictions.append({
            # Subject info
            'subject_id':            sid,
            'subject':               data['name'],
            'max_score':             float(max_score),

            # Current performance
            'current_avg':           round(current_avg, 2),
            'current_percentage':    current_pct,
            'current_grade':         current_grade_info['grade'],
            'current_description':   current_grade_info['description'],
            'passed':                current_grade_info['passed'],
            'at_risk':               current_grade_info['at_risk'],

            # Prediction
            'predicted_score':       round(predicted_score, 2),
            'predicted_percentage':  predicted_pct,
            'predicted_grade':       predicted_grade_info['grade'],
            'predicted_description': predicted_grade_info['description'],
            'will_pass':             predicted_grade_info['passed'],
            'predicted_at_risk':     predicted_grade_info['at_risk'],

            # Meta
            'trend':                 _trend(scores),
            'confidence':            _confidence(len(scores), std_dev, max_score),
            'intervention':          _intervention_message(
                                         predicted_grade_info['grade'],
                                         _trend(scores),
                                         data['name'],
                                     ),
        })

    # Sort: at-risk first, then by predicted percentage ascending (worst first)
    predictions.sort(key=lambda x: (not x['predicted_at_risk'], x['predicted_percentage']))
    return predictions
