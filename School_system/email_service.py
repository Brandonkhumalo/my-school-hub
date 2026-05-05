"""
MySchoolHub — Resend Email Service
All transactional emails sent from the platform.

Uses the Resend REST API directly via `requests`.
Every email includes a no-reply notice directing parents to contact the school.
"""

import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Brand colours ─────────────────────────────────────────────────────────────
NAVY   = "#172554"
GOLD   = "#FACC15"
LIGHT  = "#EFF6FF"
DARK   = "#0F172A"


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _base_html(title: str, preview: str, body: str, school_name: str = "MySchoolHub") -> str:
    """Wrap email body in the branded shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;font-size:1px;color:#f1f5f9;max-height:0;overflow:hidden;">{preview}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:{NAVY};border-radius:12px 12px 0 0;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                      MySchoolHub
                    </span>
                    <br/>
                    <span style="font-size:11px;color:#93c5fd;font-weight:500;">{school_name}</span>
                  </td>
                  <td align="right">
                    <span style="background:{GOLD};color:{DARK};font-size:10px;font-weight:800;
                                 padding:4px 10px;border-radius:20px;letter-spacing:0.5px;">
                      SCHOOL PORTAL
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              {body}
            </td>
          </tr>

          <!-- No-reply notice -->
          <tr>
            <td style="background-color:{LIGHT};border:1px solid #bfdbfe;border-top:none;
                       padding:16px 36px;border-radius:0 0 0 0;">
              <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.6;">
                <strong>&#9888; This is an automated email — please do not reply.</strong>
                If you have any questions or concerns, contact your school directly.
                Do not respond to this email address as it is not monitored.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:{DARK};border-radius:0 0 12px 12px;padding:20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
                      &copy; {__import__('datetime').date.today().year} MySchoolHub &middot;
                      Powered by <a href="https://tishanyq.co.zw" style="color:#FACC15;text-decoration:none;">Tishanyq Digital</a>
                      &middot; Harare, Zimbabwe
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:11px;color:#64748b;">myschoolhub.co.zw</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _section(heading: str, rows: list[tuple]) -> str:
    """Render an info table section inside the email body."""
    rows_html = "".join(
        f"""<tr>
              <td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;
                         background:#f8fafc;border:1px solid #e2e8f0;width:38%;
                         vertical-align:top;">{k}</td>
              <td style="padding:8px 12px;font-size:13px;color:{DARK};
                         border:1px solid #e2e8f0;vertical-align:top;">{v}</td>
            </tr>"""
        for k, v in rows
    )
    return f"""
      <h3 style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#64748b;
                 text-transform:uppercase;letter-spacing:0.8px;">{heading}</h3>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;border-radius:8px;overflow:hidden;">
        {rows_html}
      </table>"""


def _cta_button(label: str, url: str = "https://myschoolhub.co.zw") -> str:
    """Execute cta button."""
    return f"""
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="{url}" style="display:inline-block;background:{GOLD};color:{DARK};
                               font-size:14px;font-weight:800;padding:14px 32px;
                               border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
          {label}
        </a>
      </div>"""


def _alert_badge(text: str, colour: str = "#22c55e") -> str:
    """Execute alert badge."""
    return f"""<div style="background:{colour}15;border:1px solid {colour}40;
                           border-radius:8px;padding:14px 18px;margin:0 0 20px;">
                 <span style="color:{colour};font-weight:700;font-size:13px;">{text}</span>
               </div>"""


def _send(to: list[str], subject: str, html: str) -> bool:
    """
    Send email via Go Services (preferred) or Resend API (fallback).
    When GO_SERVICES_URL is set, delegates to Go for non-blocking goroutine-based sending.
    """
    # Remove blanks / duplicates
    recipients = list({e.strip() for e in to if e and e.strip()})
    if not recipients:
        return False

    # ── Delegate to Go Services if available (non-blocking, goroutine-based) ──
    go_services_url = getattr(settings, 'GO_SERVICES_URL', '') or os.environ.get('GO_SERVICES_URL', '')
    if go_services_url:
        try:
            resp = requests.post(
                f"{go_services_url}/api/v1/services/email/send",
                headers={
                    "Content-Type": "application/json",
                    "X-Gateway-Auth": "true",
                    "X-User-ID": "system",
                },
                json={
                    "to": recipients,
                    "subject": subject,
                    "html": html,
                },
                timeout=5,
            )
            if resp.status_code in (200, 201, 202):
                logger.info("Email delegated to Go service for %s — subject: %s", recipients, subject)
                return True
            else:
                logger.warning("Go email service returned %s, falling back to direct send", resp.status_code)
        except Exception as exc:
            logger.warning("Go email service unavailable (%s), falling back to direct send", exc)

    # ── Fallback: direct Resend API call ──
    api_key   = getattr(settings, 'RESEND_API_KEY', '')
    from_addr = getattr(settings, 'RESEND_FROM_EMAIL', 'noreply@myschoolhub.co.zw')

    if not api_key:
        logger.warning("RESEND_API_KEY not configured — email skipped")
        return False

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json={
                "from":    from_addr,
                "to":      recipients,
                "subject": subject,
                "html":    html,
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info("Email sent to %s — subject: %s", recipients, subject)
            return True
        else:
            logger.error("Resend error %s: %s", resp.status_code, resp.text[:300])
            return False
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def send_contact_form_email(*, name: str, email: str, phone: str, school: str,
                            role: str, message: str) -> bool:
    """Contact form submission → Destination inbox."""
    destination = getattr(settings, 'RESEND_DESTINATION', '')
    if not destination:
        return False

    body = f"""
      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        New Enquiry via MySchoolHub
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Someone has submitted the contact form on <strong>myschoolhub.co.zw</strong>.
      </p>

      {_section("Sender Details", [
          ("Full Name",  name),
          ("Email",      f'<a href="mailto:{email}" style="color:#2563eb;">{email}</a>'),
          ("Phone",      phone or "—"),
          ("School",     school or "—"),
          ("Role",       role.replace("_", " ").title() if role else "—"),
      ])}

      <h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;
                 text-transform:uppercase;letter-spacing:0.8px;">Message</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                  padding:16px 18px;font-size:14px;color:{DARK};line-height:1.7;">
        {message}
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
        Reply directly to <a href="mailto:{email}" style="color:#2563eb;">{email}</a>.
      </p>"""

    html = _base_html(
        title="New MySchoolHub Enquiry",
        preview=f"Enquiry from {name} — {school}",
        body=body,
    )
    return _send(
        to=[destination],
        subject=f"MySchoolHub Enquiry — {name} ({school})",
        html=html,
    )


def send_payment_received_email(*, parent_email: str, parent_name: str,
                                 school_name: str, student_name: str,
                                 class_name: str, amount_usd: str,
                                 payment_method: str, reference: str = "") -> bool:
    """Parent pays → notify parent of receipt."""
    body = f"""
      {_alert_badge("&#10003; Payment Received Successfully", "#22c55e")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Payment Confirmation
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, your payment has been received and recorded.
      </p>

      {_section("Payment Details", [
          ("School",           school_name),
          ("Student",          student_name),
          ("Class",            class_name),
          ("Amount Paid",      f'<strong style="color:#16a34a;font-size:16px;">${amount_usd} USD</strong>'),
          ("Payment Method",   payment_method.replace("_", " ").title()),
          ("Reference",        reference or "—"),
          ("Date",             __import__('datetime').date.today().strftime("%d %B %Y")),
      ])}

      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        Please keep this confirmation for your records. If you believe there is an error
        in the amount recorded, contact your school's accounts office directly.
      </p>
      {_cta_button("View Payment History")}"""

    html = _base_html(
        title="Payment Confirmation",
        preview=f"Payment of ${amount_usd} received for {student_name}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Payment Confirmation — {student_name} | {school_name}",
        html=html,
    )


def send_fee_assigned_to_student_email(*, parent_email: str, parent_name: str,
                                        school_name: str, student_name: str,
                                        class_name: str, amount_usd: str,
                                        academic_year: str, payment_type: str,
                                        due_date: str = "") -> bool:
    """Admin assigns a payment record (StudentPaymentRecord) to a student → notify parent."""
    body = f"""
      {_alert_badge("&#128203; New Fee Notice", "#f59e0b")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        School Fee Notice
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, a fee has been assigned to your child's account.
      </p>

      {_section("Fee Details", [
          ("School",        school_name),
          ("Student",       student_name),
          ("Class",         class_name),
          ("Amount Due",    f'<strong style="color:#b45309;font-size:16px;">${amount_usd} USD</strong>'),
          ("Academic Year", academic_year),
          ("Payment Plan",  payment_type.replace("_", " ").title()),
          ("Due Date",      due_date or "As advised by school"),
      ])}

      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        Please make payment by the due date to avoid disruption to your child's schooling.
        Contact your school's accounts office for payment options.
      </p>
      {_cta_button("View Fee Details")}"""

    html = _base_html(
        title="Fee Notice",
        preview=f"Fee of ${amount_usd} assigned to {student_name}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Fee Notice — {student_name} | {school_name}",
        html=html,
    )


def send_grade_fee_notice_email(*, parent_email: str, parent_name: str,
                                 school_name: str, student_name: str,
                                 class_name: str, grade_level: str,
                                 academic_year: str, academic_term: str,
                                 tuition_fee: str, levy_fee: str = "0",
                                 sports_fee: str = "0", computer_fee: str = "0",
                                 other_fees: str = "0") -> bool:
    """School sets grade-wide fees (SchoolFees) → notify parents of students in that grade."""
    try:
        total = sum(float(x) for x in [tuition_fee, levy_fee, sports_fee, computer_fee, other_fees])
        total_str = f"{total:.2f}"
    except Exception:
        total_str = "—"

    body = f"""
      {_alert_badge("&#128203; School Fees Published for Your Child's Grade", "#f59e0b")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        School Fees Notice
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, {school_name} has published the fees for
        <strong>{academic_term}</strong>, <strong>{academic_year}</strong>.
        Your child <strong>{student_name}</strong> ({class_name}) is in
        <strong>{grade_level}</strong>.
      </p>

      {_section("Fee Breakdown", [
          ("School",         school_name),
          ("Student",        student_name),
          ("Class",          class_name),
          ("Grade Level",    grade_level),
          ("Academic Year",  academic_year),
          ("Term",           academic_term),
          ("Tuition Fee",    f"${tuition_fee} USD"),
          ("Levy Fee",       f"${levy_fee} USD"),
          ("Sports Fee",     f"${sports_fee} USD"),
          ("Computer Fee",   f"${computer_fee} USD"),
          ("Other Fees",     f"${other_fees} USD"),
          ("Total Due",      f'<strong style="color:#b45309;font-size:16px;">${total_str} USD</strong>'),
      ])}

      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        Please arrange payment with the school accounts office before the due date.
      </p>
      {_cta_button("View Full Fee Schedule")}"""

    html = _base_html(
        title="School Fees Notice",
        preview=f"{school_name} fees for {grade_level} — {academic_term} {academic_year}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"School Fees — {grade_level} {academic_term} {academic_year} | {school_name}",
        html=html,
    )


def send_parent_link_approved_email(*, parent_email: str, parent_name: str,
                                     school_name: str, student_name: str,
                                     class_name: str, student_number: str = "",
                                     student_username: str = "",
                                     student_email: str = "") -> bool:
    """Admin approves parent-child link → notify parent."""
    body = f"""
      {_alert_badge("&#10003; Your Link Request Has Been Approved", "#22c55e")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Parent Portal Access Granted
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, your request to link to your child's account has
        been reviewed and approved by {school_name}.
      </p>

      {_section("Your Child's Details", [
          ("School",   school_name),
          ("Student",  student_name),
          ("Class",    class_name),
          ("Status",   '<span style="color:#16a34a;font-weight:700;">Linked &amp; Active</span>'),
      ])}

      {_section("Student Login Credentials", [
          ("Student Number", student_number or "Not available"),
          ("Username", student_username or "Not available"),
          ("Email", student_email or "Not available"),
          ("Password", "Not included for security. Use <strong>Forgot Password</strong> to set/reset."),
      ])}

      <p style="margin:20px 0 0;font-size:14px;color:{DARK};line-height:1.7;">
        You can now log in to the Parent Portal to view:
      </p>
      <ul style="margin:10px 0 20px;padding-left:20px;font-size:14px;color:#64748b;line-height:2;">
        <li>Academic results and report cards</li>
        <li>Attendance records</li>
        <li>Fee statements and payment history</li>
        <li>Homework and assignments</li>
        <li>School announcements</li>
        <li>Messages from teachers</li>
      </ul>
      <p style="margin:0 0 10px;font-size:13px;color:#64748b;line-height:1.7;">
        Student sign-in can use any of the identifiers above. If they do not know their password,
        use the <strong>Forgot Password</strong> option on the login page.
      </p>
      {_cta_button("Log In to Parent Portal")}"""

    html = _base_html(
        title="Parent Portal Access Granted",
        preview=f"Your link to {student_name} has been approved by {school_name}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Portal Access Approved — {student_name} | {school_name}",
        html=html,
    )


def send_teacher_message_email(*, parent_email: str, parent_name: str,
                                school_name: str, student_name: str,
                                class_name: str, teacher_name: str,
                                subject_line: str, message_body: str) -> bool:
    """Teacher sends a message on the portal → notify parent via email."""
    body = f"""
      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Message from {teacher_name}
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, you have received a message from your child's
        teacher on the {school_name} portal.
      </p>

      {_section("Message Details", [
          ("School",   school_name),
          ("Student",  student_name),
          ("Class",    class_name),
          ("From",     teacher_name),
          ("Subject",  subject_line or "(No subject)"),
          ("Sent",     __import__('datetime').date.today().strftime("%d %B %Y")),
      ])}

      <h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;
                 text-transform:uppercase;letter-spacing:0.8px;">Message</h3>
      <div style="background:#f8fafc;border-left:4px solid {NAVY};border-radius:0 8px 8px 0;
                  padding:16px 20px;font-size:14px;color:{DARK};line-height:1.8;">
        {message_body}
      </div>

      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        To reply, log in to your Parent Portal and use the messaging feature.
        <strong>Do not reply to this email.</strong>
      </p>
      {_cta_button("Open Messaging")}"""

    html = _base_html(
        title=f"Message from {teacher_name}",
        preview=f"{teacher_name}: {subject_line or message_body[:60]}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Message from {teacher_name} — {student_name} | {school_name}",
        html=html,
    )


def send_homework_uploaded_email(*, parent_email: str, parent_name: str,
                                  school_name: str, student_name: str,
                                  class_name: str, teacher_name: str,
                                  subject_name: str, homework_title: str,
                                  description: str, due_date: str) -> bool:
    """Teacher uploads homework → notify parent."""
    body = f"""
      {_alert_badge("&#128218; New Homework / Assignment Posted", "#6366f1")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Homework Assigned
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, a new piece of homework has been posted for
        <strong>{student_name}</strong>'s class.
      </p>

      {_section("Assignment Details", [
          ("School",    school_name),
          ("Student",   student_name),
          ("Class",     class_name),
          ("Subject",   subject_name),
          ("Title",     f'<strong>{homework_title}</strong>'),
          ("Set By",    teacher_name),
          ("Due Date",  f'<strong style="color:#b45309;">{due_date}</strong>'),
      ])}

      {"" if not description else f'''<h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Instructions</h3><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;font-size:14px;color:{DARK};line-height:1.7;">{description}</div>'''}

      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        Please remind your child to complete and submit this work before the due date.
        Any attached files can be downloaded from the Student Portal.
      </p>
      {_cta_button("View Homework")}"""

    html = _base_html(
        title="New Homework Assigned",
        preview=f"Homework: {homework_title} — due {due_date}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Homework: {homework_title} — {subject_name} | {school_name}",
        html=html,
    )


def send_result_entered_email(*, parent_email: str, parent_name: str,
                               school_name: str, student_name: str,
                               class_name: str, subject_name: str,
                               exam_type: str, score: str, max_score: str,
                               academic_term: str, academic_year: str,
                               teacher_name: str) -> bool:
    """Teacher enters a result → notify parent."""
    try:
        pct = round(float(score) / float(max_score) * 100, 1)
        pct_str = f"{pct}%"
        # Zimbabwe grading: A=70+, B=60-69, C=50-59 (pass), D=40-49, E=0-39
        if pct >= 70:
            grade_colour, grade_label = "#16a34a", "A — Distinction"
        elif pct >= 60:
            grade_colour, grade_label = "#2563eb", "B — Merit"
        elif pct >= 50:
            grade_colour, grade_label = "#d97706", "C — Credit (Pass)"
        elif pct >= 40:
            grade_colour, grade_label = "#ea580c", "D — Satisfactory (Below Pass)"
        else:
            grade_colour, grade_label = "#dc2626", "E — Fail"
    except Exception:
        pct_str = "—"
        grade_colour, grade_label = "#64748b", "U — Unsatisfactory"

    body = f"""
      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        New Result Posted
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, a new result has been entered for
        <strong>{student_name}</strong>.
      </p>

      {_section("Result Details", [
          ("School",        school_name),
          ("Student",       student_name),
          ("Class",         class_name),
          ("Subject",       subject_name),
          ("Exam Type",     exam_type.replace("_", " ").title()),
          ("Score",         f'<strong style="font-size:16px;">{score} / {max_score}</strong>'),
          ("Percentage",    f'<strong style="color:{grade_colour};font-size:16px;">{pct_str}</strong>'),
          ("Performance",   f'<span style="color:{grade_colour};font-weight:700;">{grade_label}</span>'),
          ("Term",          academic_term),
          ("Year",          academic_year),
          ("Recorded By",   teacher_name),
      ])}

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:20px 0 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Zimbabwe Grading Scale</p>
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.8;">
          <strong style="color:#16a34a;">A</strong> Distinction (70–100%) &nbsp;|&nbsp;
          <strong style="color:#2563eb;">B</strong> Merit (60–69%) &nbsp;|&nbsp;
          <strong style="color:#d97706;">C</strong> Credit &mdash; <em>minimum pass</em> (50–59%) &nbsp;|&nbsp;
          <strong style="color:#ea580c;">D</strong> Satisfactory (40–49%) &nbsp;|&nbsp;
          <strong style="color:#dc2626;">E</strong> Fail (0–39%)
        </p>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
        View the full report card and all subject results in the Parent Portal.
        If you have questions about this result, please contact the school directly.
      </p>
      {_cta_button("View Full Report Card")}"""

    html = _base_html(
        title="Result Posted",
        preview=f"{student_name} scored {score}/{max_score} in {subject_name} ({exam_type})",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Result: {subject_name} {exam_type} — {student_name} | {school_name}",
        html=html,
    )


def send_announcement_email(*, parent_email: str, parent_name: str,
                             school_name: str, student_name: str,
                             class_name: str, announcement_title: str,
                             announcement_body: str, posted_by: str) -> bool:
    """School posts an announcement → notify parent."""
    body = f"""
      {_alert_badge("&#128226; New Announcement from " + school_name, "#172554")}

      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        {announcement_title}
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
        Dear <strong>{parent_name}</strong>, {school_name} has posted an announcement
        relevant to <strong>{student_name}</strong> ({class_name}).
      </p>

      <div style="background:#f8fafc;border-left:4px solid {NAVY};border-radius:0 8px 8px 0;
                  padding:20px 24px;font-size:14px;color:{DARK};line-height:1.8;margin-bottom:20px;">
        {announcement_body}
      </div>

      {_section("Details", [
          ("School",   school_name),
          ("Student",  student_name),
          ("Class",    class_name),
          ("Posted By", posted_by),
          ("Date",     __import__('datetime').date.today().strftime("%d %B %Y")),
      ])}

      {_cta_button("View Announcements")}"""

    html = _base_html(
        title=announcement_title,
        preview=f"{school_name}: {announcement_title}",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[parent_email],
        subject=f"Announcement: {announcement_title} | {school_name}",
        html=html,
    )


def send_bulk_welcome_teacher(
    *,
    email: str,
    first_name: str,
    last_name: str,
    school_name: str,
    password: str | None,
) -> bool:
    """Bulk-import welcome email for a newly created teacher account."""
    if password:
        creds_html = f"""
          {_alert_badge("&#128274; Reset your password immediately after first login", "#dc2626")}
          {_section("Your Login Credentials", [
              ("Login Email", email),
              ("Temporary Password", f"<code style='font-size:15px;font-weight:700;letter-spacing:1px;'>{password}</code>"),
          ])}"""
        action = "Log in and change your password immediately."
    else:
        creds_html = f"""
          {_alert_badge("&#128274; You must set a password before you can log in", "#dc2626")}
          {_section("Your Login Details", [
              ("Login Email", email),
              ("Password", "Not set — use <strong>Forgot Password</strong> to create one"),
          ])}"""
        action = 'Use the <strong>Forgot Password</strong> link on the login page to set your password.'

    body = f"""
      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Welcome to {school_name}
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
        Dear <strong>{first_name} {last_name}</strong>, your staff account on
        <strong>MySchoolHub</strong> has been created by your school administrator.
        {action}
      </p>
      {creds_html}
      {_cta_button("Log In to MySchoolHub")}
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
        Keep your credentials private. If you did not expect this email, contact your school administrator.
      </p>"""

    html = _base_html(
        title=f"Welcome to {school_name} — MySchoolHub",
        preview=f"Your MySchoolHub teacher account at {school_name} is ready.",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[email],
        subject=f"Welcome to MySchoolHub — {school_name}",
        html=html,
    )


def send_bulk_welcome_parent(
    *,
    email: str,
    first_name: str,
    last_name: str,
    school_name: str,
    password: str | None,
    children: list[dict],
) -> bool:
    """
    Bulk-import welcome email for a newly created parent account.
    children: list of {name, student_number, email} dicts for linked students.
    """
    if password:
        creds_html = f"""
          {_alert_badge("&#128274; Reset your password immediately after first login", "#dc2626")}
          {_section("Your Login Credentials", [
              ("Login Email", email),
              ("Temporary Password", f"<code style='font-size:15px;font-weight:700;letter-spacing:1px;'>{password}</code>"),
          ])}"""
        action = "Log in and change your password immediately."
    else:
        creds_html = f"""
          {_alert_badge("&#128274; You must set a password before you can log in", "#dc2626")}
          {_section("Your Login Details", [
              ("Login Email", email),
              ("Password", "Not set — use <strong>Forgot Password</strong> to create one"),
          ])}"""
        action = 'Use the <strong>Forgot Password</strong> link on the login page to set your password.'

    children_html = ""
    if children:
        child_rows = "".join(
            f"""<tr>
                  <td style="padding:10px 14px;font-size:13px;border:1px solid #e2e8f0;
                             background:#f8fafc;font-weight:600;color:#64748b;width:38%;vertical-align:top;">
                    {c['name']}
                  </td>
                  <td style="padding:10px 14px;font-size:13px;border:1px solid #e2e8f0;vertical-align:top;color:{DARK};">
                    <strong>Student #:</strong> {c['student_number']}<br/>
                    <strong>Login Email:</strong> {c['email']}<br/>
                    <span style="font-size:11px;color:#94a3b8;">
                      Student must use <strong>Forgot Password</strong> to set their password on first login.
                    </span>
                  </td>
                </tr>"""
            for c in children
        )
        children_html = f"""
          <h3 style="margin:28px 0 10px;font-size:13px;font-weight:700;color:#64748b;
                     text-transform:uppercase;letter-spacing:0.8px;">Your Children's Student Accounts</h3>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:collapse;border-radius:8px;overflow:hidden;">
            {child_rows}
          </table>
          <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">
            Students do not receive a login email. Please share their login details with them directly.
          </p>"""

    body = f"""
      <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:{DARK};">
        Welcome to {school_name}
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
        Dear <strong>{first_name} {last_name}</strong>, your parent account on
        <strong>MySchoolHub</strong> has been created by your school. Use it to
        track fees, results, attendance, and communicate with teachers.
        {action}
      </p>
      {creds_html}
      {children_html}
      {_cta_button("Log In to MySchoolHub")}
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
        Keep your credentials private. If you did not expect this email, contact your school administrator.
      </p>"""

    html = _base_html(
        title=f"Welcome to {school_name} — MySchoolHub",
        preview=f"Your MySchoolHub parent account at {school_name} is ready.",
        body=body,
        school_name=school_name,
    )
    return _send(
        to=[email],
        subject=f"Welcome to MySchoolHub — {school_name}",
        html=html,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Utility: get all confirmed parents of a student
# ─────────────────────────────────────────────────────────────────────────────

def get_parents_of_student(student):
    """
    Returns a list of dicts: [{email, name, parent_obj}]
    Uses ParentChildLink to find confirmed parents only.
    """
    try:
        from academics.models import ParentChildLink
        links = ParentChildLink.objects.filter(
            student=student, is_confirmed=True
        ).select_related('parent__user')
        result = []
        for link in links:
            u = link.parent.user
            if u.email:
                result.append({
                    'email': u.email,
                    'name':  f"{u.first_name} {u.last_name}".strip() or u.email,
                    'parent': link.parent,
                })
        return result
    except Exception as exc:
        logger.error("get_parents_of_student failed: %s", exc)
        return []
