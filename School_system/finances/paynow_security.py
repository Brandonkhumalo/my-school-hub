import hashlib
import hmac


SIGNATURE_FIELDS = ('hash', 'signature', 'hmac')


def _normalize_payload(payload):
    normalized = {}
    for key, value in dict(payload).items():
        if key.lower() in SIGNATURE_FIELDS:
            continue
        normalized[str(key)] = '' if value is None else str(value)
    return normalized


def _canonical_payload_string(payload):
    normalized = _normalize_payload(payload)
    parts = [f"{key}={normalized[key]}" for key in sorted(normalized.keys())]
    return "&".join(parts)


def compute_callback_hmac_sha256(payload, secret):
    raw = _canonical_payload_string(payload).encode("utf-8")
    return hmac.new(str(secret).encode("utf-8"), raw, hashlib.sha256).hexdigest()


def compute_callback_hmac_sha512(payload, secret):
    raw = _canonical_payload_string(payload).encode("utf-8")
    return hmac.new(str(secret).encode("utf-8"), raw, hashlib.sha512).hexdigest()


def extract_signature(payload):
    for field in SIGNATURE_FIELDS:
        if field in payload and payload.get(field):
            return str(payload.get(field)).strip()
    return ''


def verify_paynow_callback_signature(payload, secret):
    """
    Validate callback authenticity.
    Accepts SHA-256 or SHA-512 HMAC over normalized payload.
    """
    if not secret:
        return False

    incoming = extract_signature(payload)
    if not incoming:
        return False
    expected_256 = compute_callback_hmac_sha256(payload, secret)
    expected_512 = compute_callback_hmac_sha512(payload, secret)
    return hmac.compare_digest(incoming.lower(), expected_256.lower()) or hmac.compare_digest(incoming.lower(), expected_512.lower())
