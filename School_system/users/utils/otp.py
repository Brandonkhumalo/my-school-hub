"""
Two-Factor Authentication utilities for TOTP and backup codes.
"""
import pyotp
import qrcode
import io
import base64
import secrets
import string
from django.contrib.auth.hashers import make_password, check_password


def generate_secret():
    """Generate a new base32-encoded TOTP secret."""
    return pyotp.random_base32()


def get_qr_code(secret, user_email, organization_name='My School Hub'):
    """
    Generate a QR code PNG for TOTP setup.
    
    Args:
        secret: Base32-encoded TOTP secret
        user_email: User's email (displayed in authenticator app)
        organization_name: Organization name (displayed in authenticator app)
    
    Returns:
        Base64-encoded PNG image data (data:image/png;base64,...) for img src
    """
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user_email,
        issuer_name=organization_name
    )
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    return f"data:image/png;base64,{img_base64}"


def verify_totp(secret, code, window=1):
    """
    Verify a TOTP code against a secret.
    
    Args:
        secret: Base32-encoded TOTP secret
        code: 6-digit code entered by user
        window: Number of time steps to check (default 1 = ±30-90 sec tolerance)
    
    Returns:
        True if code is valid, False otherwise
    """
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=window)
    except Exception:
        return False


def generate_backup_codes(count=10):
    """
    Generate a list of backup codes.
    
    Args:
        count: Number of codes to generate (default 10)
    
    Returns:
        List of 8-character alphanumeric codes
    """
    chars = string.ascii_uppercase + string.digits
    codes = [''.join(secrets.choice(chars) for _ in range(8)) for _ in range(count)]
    return codes


def hash_backup_code(code):
    """
    Hash a backup code using Django's password hasher.
    
    Args:
        code: Plaintext backup code
    
    Returns:
        Hashed code
    """
    return make_password(code)


def verify_backup_code(hashed_code, code):
    """
    Verify a plaintext backup code against a hashed code.
    
    Args:
        hashed_code: Previously hashed backup code
        code: Plaintext code to verify
    
    Returns:
        True if code matches, False otherwise
    """
    try:
        return check_password(code, hashed_code)
    except Exception:
        return False


def create_backup_codes_list(count=10):
    """
    Create a list of backup code objects ready to store in database.
    
    Args:
        count: Number of codes to generate
    
    Returns:
        List of dicts: [{"code_hash": "...", "used": False}, ...]
    """
    codes = generate_backup_codes(count)
    return [
        {"code_hash": hash_backup_code(code), "used": False}
        for code in codes
    ]


def parse_user_agent(user_agent_string):
    """
    Parse User-Agent string to extract device name.
    
    Args:
        user_agent_string: Raw User-Agent header
    
    Returns:
        Human-readable device name (e.g., "Chrome on Windows")
    """
    if not user_agent_string:
        return "Unknown Device"
    
    ua_lower = user_agent_string.lower()
    browser = "Unknown Browser"
    os = "Unknown OS"
    
    # Detect browser
    if "firefox" in ua_lower:
        browser = "Firefox"
    elif "chrome" in ua_lower and "chromium" not in ua_lower:
        browser = "Chrome"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    elif "edge" in ua_lower:
        browser = "Edge"
    elif "opera" in ua_lower:
        browser = "Opera"
    elif "brave" in ua_lower:
        browser = "Brave"
    
    # Detect OS
    if "windows" in ua_lower:
        os = "Windows"
    elif "mac" in ua_lower:
        os = "macOS"
    elif "linux" in ua_lower and "android" not in ua_lower:
        os = "Linux"
    elif "android" in ua_lower:
        os = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os = "iOS"
    
    return f"{browser} on {os}"
