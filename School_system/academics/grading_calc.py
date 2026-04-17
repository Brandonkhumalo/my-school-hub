"""Composite subject-percentage calculator.

Computes a single subject percentage from a collection of Result rows, honouring
the admin-configured AssessmentPlan weights (papers vs tests vs assignments,
plus optional per-paper weights). Falls back to a plain average-of-percentages
when no plan or weights are available — that matches naive teacher expectations
for legacy data and for terms where an admin hasn't set a plan yet.
"""
from collections import defaultdict


def _pct(score, max_score):
    if not max_score or max_score <= 0:
        return 0.0
    return (score / max_score) * 100.0


def _avg(values):
    return sum(values) / len(values) if values else None


def _weighted_paper_pct(paper_results, paper_weights):
    """Weighted average across papers, using paper_weights when provided.

    paper_results: list of (paper_index, percentage)
    paper_weights: dict like {"1": 0.25, "2": 0.25, "4": 0.5}  (or ints as keys)
    """
    if not paper_results:
        return None

    if not paper_weights:
        return sum(p for _, p in paper_results) / len(paper_results)

    # Normalise weight keys to strings for lookup, drop papers without weight,
    # then renormalise over the papers actually present.
    norm_weights = {str(k): float(v) for k, v in paper_weights.items()}
    weighted = []
    for idx, pct in paper_results:
        w = norm_weights.get(str(idx))
        if w is not None:
            weighted.append((pct, w))

    if not weighted:
        # No matching weights — fall back to equal
        return sum(p for _, p in paper_results) / len(paper_results)

    total_weight = sum(w for _, w in weighted)
    if total_weight <= 0:
        return sum(p for _, p in paper_results) / len(paper_results)
    return sum(p * w for p, w in weighted) / total_weight


def compute_subject_percentage(results, plan=None):
    """Compute a single subject percentage from a list of Result rows.

    results: iterable of Result instances for ONE subject (caller filters)
    plan: optional AssessmentPlan with composite weights + paper_weights

    Returns float in [0, 100], rounded to 2dp. Returns 0.0 for empty input.
    """
    results = list(results)
    if not results:
        return 0.0

    if plan is None:
        # Plain average of per-result percentages. Every assessment equally weighted.
        pcts = [_pct(r.score, r.max_score) for r in results]
        return round(_avg(pcts) or 0.0, 2)

    # Bucket by component_kind. Unknown/empty kinds default to "paper" so legacy
    # data (no kind set) is treated as exam-style marks.
    buckets = defaultdict(list)
    for r in results:
        kind = (getattr(r, 'component_kind', '') or '').lower()
        if kind not in ('paper', 'test', 'assignment'):
            kind = 'paper'
        pct = _pct(r.score, r.max_score)
        buckets[kind].append((getattr(r, 'component_index', None), pct))

    paper_avg = _weighted_paper_pct(buckets['paper'], getattr(plan, 'paper_weights', {}))
    test_avg = _avg([p for _, p in buckets['test']])
    assignment_avg = _avg([p for _, p in buckets['assignment']])

    components = []
    if paper_avg is not None:
        components.append((paper_avg, float(plan.papers_weight or 0.0)))
    if test_avg is not None:
        components.append((test_avg, float(plan.tests_weight or 0.0)))
    if assignment_avg is not None:
        components.append((assignment_avg, float(plan.assignments_weight or 0.0)))

    if not components:
        return 0.0

    # Renormalise: if a category had no results, its weight drops out and the
    # remaining categories share the full 1.0 proportionally. This prevents a
    # missing component from silently dragging the mark down to zero.
    total_weight = sum(w for _, w in components)
    if total_weight <= 0:
        # All configured weights are zero — fall back to equal averaging.
        return round(sum(p for p, _ in components) / len(components), 2)

    final = sum(p * w for p, w in components) / total_weight
    return round(final, 2)


def resolve_plan_for(result):
    """Return the AssessmentPlan attached to this result, or None."""
    return getattr(result, 'assessment_plan', None)


def compute_from_queryset(results_qs):
    """Group a queryset of Result rows by subject and compute a percentage per subject.

    Picks the plan from the first result that has one (same subject+term → same plan
    in practice). Returns {subject_id: percentage}.
    """
    per_subject = defaultdict(list)
    plan_for = {}
    for r in results_qs:
        per_subject[r.subject_id].append(r)
        if r.subject_id not in plan_for and getattr(r, 'assessment_plan_id', None):
            plan_for[r.subject_id] = r.assessment_plan

    return {
        subj_id: compute_subject_percentage(rows, plan_for.get(subj_id))
        for subj_id, rows in per_subject.items()
    }
