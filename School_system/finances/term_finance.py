from decimal import Decimal


TERM_SEQUENCE = ['term_1', 'term_2', 'term_3']
TERM_INDEX = {term: idx for idx, term in enumerate(TERM_SEQUENCE)}


def normalize_term_key(value):
    raw = (value or '').strip().lower().replace(' ', '_')
    if raw in {'term1', 'term_1', '1', 't1'}:
        return 'term_1'
    if raw in {'term2', 'term_2', '2', 't2'}:
        return 'term_2'
    if raw in {'term3', 'term_3', '3', 't3'}:
        return 'term_3'
    return raw


def normalize_terms(values):
    if not values:
        return []
    normalized = []
    for value in values:
        key = normalize_term_key(value)
        if key in TERM_INDEX and key not in normalized:
            normalized.append(key)
    return sorted(normalized, key=lambda term: TERM_INDEX[term])


def term_display(term_key):
    if term_key == 'term_1':
        return 'Term 1'
    if term_key == 'term_2':
        return 'Term 2'
    if term_key == 'term_3':
        return 'Term 3'
    return (term_key or '').replace('_', ' ').title()


def resolve_terms_for_plan(payment_plan, academic_term='', covered_terms=None):
    plan = (payment_plan or '').strip()
    single_term = normalize_term_key(academic_term)
    explicit_terms = normalize_terms(covered_terms or [])

    if plan == 'full_year':
        return list(TERM_SEQUENCE)

    if plan == 'one_term':
        return [single_term] if single_term in TERM_INDEX else []

    if plan == 'two_terms':
        if single_term not in TERM_INDEX:
            return []
        start_idx = TERM_INDEX[single_term]
        return TERM_SEQUENCE[start_idx:start_idx + 2]

    if plan == 'specific_terms':
        return explicit_terms

    if plan == 'batch':
        if explicit_terms:
            return explicit_terms
        if single_term in TERM_INDEX:
            return [single_term]
        return []

    return explicit_terms


def allocate_paid_across_terms(term_due_map, amount_paid):
    remaining = Decimal(str(amount_paid or 0))
    allocation = {}
    for term in sorted(term_due_map.keys(), key=lambda term: TERM_INDEX.get(term, 999)):
        due = Decimal(str(term_due_map.get(term) or 0))
        paid = min(remaining, due)
        allocation[term] = paid
        remaining -= paid
        if remaining <= 0:
            break
    for term in term_due_map:
        allocation.setdefault(term, Decimal('0'))
    return allocation
