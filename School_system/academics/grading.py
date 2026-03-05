"""
Zimbabwe Academic Grading System
Used by MySchoolHub across all grade calculations, ML predictions, and email notifications.

Grade | Description  | % Range   | Notes
------+--------------+-----------+-------------------------------
A     | Distinction  | 70 – 100  |
B     | Merit        | 60 – 69   |
C     | Credit       | 50 – 59   | Minimum pass mark (50%)
D     | Satisfactory | 40 – 49   | Below pass mark but not fail
E     | Fail         | 0 – 39    |
U     | Unsatisfactory| N/A      | Incomplete / ungraded work
"""

PASS_MARK = 50  # percentage


# ── Grade table (ordered highest → lowest for lookup) ─────────────────────────
GRADE_TABLE = [
    ("A", "Distinction",   70, 100),
    ("B", "Merit",         60,  69),
    ("C", "Credit",        50,  59),   # minimum pass
    ("D", "Satisfactory",  40,  49),
    ("E", "Fail",           0,  39),
]


def percentage_to_grade(percentage: float) -> dict:
    """
    Convert a raw percentage into the full Zimbabwe grade descriptor.

    Returns:
        {
            'grade':        'A' | 'B' | 'C' | 'D' | 'E' | 'U',
            'description':  'Distinction' | 'Merit' | ... | 'Unsatisfactory',
            'passed':       True | False,
            'at_risk':      True if grade is D or E (at risk of or failing),
            'colour':       hex colour for UI display,
        }
    """
    if percentage is None:
        return {
            'grade': 'U', 'description': 'Unsatisfactory',
            'passed': False, 'at_risk': True, 'colour': '#6b7280',
        }

    pct = float(percentage)

    for grade, description, low, high in GRADE_TABLE:
        if low <= pct <= high:
            passed = pct >= PASS_MARK
            at_risk = grade in ('D', 'E')
            colour = {
                'A': '#16a34a',   # green
                'B': '#2563eb',   # blue
                'C': '#d97706',   # amber  (border-line pass)
                'D': '#ea580c',   # orange (below pass)
                'E': '#dc2626',   # red    (fail)
            }[grade]
            return {
                'grade': grade,
                'description': description,
                'passed': passed,
                'at_risk': at_risk,
                'colour': colour,
            }

    # Fallback — should not reach here for valid 0-100 input
    return {
        'grade': 'U', 'description': 'Unsatisfactory',
        'passed': False, 'at_risk': True, 'colour': '#6b7280',
    }


def score_to_percentage(score, max_score) -> float:
    """Safe conversion of raw score to percentage."""
    try:
        if float(max_score) <= 0:
            return 0.0
        return round((float(score) / float(max_score)) * 100, 1)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def grade_label(percentage: float) -> str:
    """Quick helper — returns just the grade letter."""
    return percentage_to_grade(percentage)['grade']


def is_at_risk(percentage: float) -> bool:
    """Returns True if the student is at risk (D or E grade)."""
    return percentage_to_grade(percentage)['at_risk']


def is_passing(percentage: float) -> bool:
    """Returns True if the student is passing (C or above, i.e. >= 50%)."""
    return float(percentage) >= PASS_MARK
