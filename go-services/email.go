package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// ──────────────────────────────────────────────────────────────
// Resend Email Service
// Replaces Django email_service.py — sends transactional emails
// via the Resend REST API using goroutines for concurrency.
// ──────────────────────────────────────────────────────────────

// Brand colours (matching Django email templates)
const (
	emailNavy  = "#172554"
	emailGold  = "#FACC15"
	emailLight = "#EFF6FF"
	emailDark  = "#0F172A"
)

// emailRequest is the JSON body accepted by POST /api/v1/services/email/send
type emailRequest struct {
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	// If HTML is empty, use the template fields below:
	Template   string            `json:"template"`
	TemplateData map[string]string `json:"template_data"`
}

// EmailSendHandler handles POST /api/v1/services/email/send
// This is an internal endpoint called by Django to offload email sending to Go.
// Returns 202 Accepted immediately — email is sent asynchronously in a goroutine.
func EmailSendHandler() http.HandlerFunc {
	cfg := LoadConfig()

	return func(w http.ResponseWriter, r *http.Request) {
		var req emailRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body."})
			return
		}

		if len(req.To) == 0 || req.Subject == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and subject are required."})
			return
		}

		// Deduplicate and clean recipients
		seen := make(map[string]bool)
		var recipients []string
		for _, email := range req.To {
			e := strings.TrimSpace(email)
			if e != "" && !seen[e] {
				seen[e] = true
				recipients = append(recipients, e)
			}
		}

		html := req.HTML
		if html == "" && req.Template != "" {
			html = renderEmailTemplate(req.Template, req.TemplateData)
		}

		if html == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "html or template is required."})
			return
		}

		// Fire and forget — send email in a goroutine
		go sendViaResend(cfg, recipients, req.Subject, html)

		writeJSON(w, http.StatusAccepted, map[string]string{
			"message": fmt.Sprintf("Email queued for %d recipient(s).", len(recipients)),
		})
	}
}

// sendViaResend calls the Resend REST API to send an email.
func sendViaResend(cfg Config, to []string, subject, html string) {
	if cfg.ResendAPIKey == "" {
		log.Println("RESEND_API_KEY not configured — email skipped")
		return
	}

	payload := map[string]interface{}{
		"from":    cfg.ResendFromEmail,
		"to":      to,
		"subject": subject,
		"html":    html,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Resend API error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 || resp.StatusCode == 201 {
		log.Printf("Email sent to %v — subject: %s", to, subject)
	} else {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("Resend error %d: %s", resp.StatusCode, string(respBody[:min(300, len(respBody))]))
	}
}

// sendPaymentReceivedEmail builds and sends a payment confirmation email.
// Called from paynow.go callback handler.
func sendPaymentReceivedEmail(cfg Config, parentEmail, parentName, schoolName, studentName, className, amount, reference string) {
	today := time.Now().Format("02 January 2006")
	year := time.Now().Year()

	body := fmt.Sprintf(`
		<div style="background:#dcfce715;border:1px solid #22c55e40;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#22c55e;font-weight:700;font-size:13px;">&#10003; Payment Received Successfully</span>
		</div>

		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">Payment Confirmation</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">
			Dear <strong>%s</strong>, your payment has been received and recorded.
		</p>

		<h3 style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Payment Details</h3>
		<table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;">
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">School</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">%s</td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Student</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">%s</td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Class</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">%s</td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Amount Paid</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;"><strong style="color:#16a34a;font-size:16px;">$%s USD</strong></td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Payment Method</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">PayNow</td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Reference</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">%s</td></tr>
			<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;">Date</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;">%s</td></tr>
		</table>

		<p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
			Please keep this confirmation for your records. If you believe there is an error
			in the amount recorded, contact your school's accounts office directly.
		</p>`,
		emailDark, parentName,
		emailDark, schoolName,
		emailDark, studentName,
		emailDark, className,
		emailDark, amount,
		emailDark,
		emailDark, reference,
		emailDark, today,
	)

	html := wrapEmailHTML(
		"Payment Confirmation",
		fmt.Sprintf("Payment of $%s received for %s", amount, studentName),
		body,
		schoolName,
		year,
	)

	subject := fmt.Sprintf("Payment Confirmation — %s | %s", studentName, schoolName)
	sendViaResend(cfg, []string{parentEmail}, subject, html)
}

// wrapEmailHTML wraps the body in the branded email shell matching Django's _base_html.
func wrapEmailHTML(title, preview, body, schoolName string, year int) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:#f1f5f9;max-height:0;overflow:hidden;">%s</div>
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;">
          <tr>
            <td style="background-color:%s;border-radius:12px 12px 0 0;padding:28px 36px;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">MySchoolHub</span><br/>
                    <span style="font-size:11px;color:#93c5fd;font-weight:500;">%s</span>
                  </td>
                  <td align="right">
                    <span style="background:%s;color:%s;font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:0.5px;">SCHOOL PORTAL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">%s</td>
          </tr>
          <tr>
            <td style="background-color:%s;border:1px solid #bfdbfe;border-top:none;padding:16px 36px;">
              <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.6;">
                <strong>&#9888; This is an automated email — please do not reply.</strong>
                If you have any questions or concerns, contact your school directly.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:%s;border-radius:0 0 12px 12px;padding:20px 36px;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td><p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">&copy; %d MySchoolHub &middot; Powered by <a href="https://tishanyq.co.zw" style="color:#FACC15;text-decoration:none;">Tishanyq Digital</a> &middot; Harare, Zimbabwe</p></td>
                  <td align="right"><p style="margin:0;font-size:11px;color:#64748b;">myschoolhub.co.zw</p></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
		title, preview,
		emailNavy, schoolName,
		emailGold, emailDark,
		body,
		emailLight,
		emailDark,
		year,
	)
}

// renderEmailTemplate renders a known email template with data.
// Supports the same templates as Django email_service.py.
func renderEmailTemplate(template string, data map[string]string) string {
	year := time.Now().Year()
	schoolName := data["school_name"]
	if schoolName == "" {
		schoolName = "MySchoolHub"
	}

	var body, title, preview string

	switch template {
	case "payment_received":
		title = "Payment Confirmation"
		preview = fmt.Sprintf("Payment of $%s received for %s", data["amount_usd"], data["student_name"])
		body = buildPaymentReceivedBody(data)
	case "fee_assigned":
		title = "Fee Notice"
		preview = fmt.Sprintf("Fee of $%s assigned to %s", data["amount_usd"], data["student_name"])
		body = buildFeeAssignedBody(data)
	case "parent_link_approved":
		title = "Parent Portal Access Granted"
		preview = fmt.Sprintf("Your link to %s has been approved", data["student_name"])
		body = buildParentLinkApprovedBody(data)
	case "result_entered":
		title = "Result Posted"
		preview = fmt.Sprintf("%s scored %s/%s in %s", data["student_name"], data["score"], data["max_score"], data["subject_name"])
		body = buildResultEnteredBody(data)
	case "homework_uploaded":
		title = "New Homework Assigned"
		preview = fmt.Sprintf("Homework: %s — due %s", data["homework_title"], data["due_date"])
		body = buildHomeworkBody(data)
	case "announcement":
		title = data["announcement_title"]
		preview = fmt.Sprintf("%s: %s", schoolName, data["announcement_title"])
		body = buildAnnouncementBody(data)
	case "teacher_message":
		title = fmt.Sprintf("Message from %s", data["teacher_name"])
		preview = fmt.Sprintf("%s: %s", data["teacher_name"], data["subject_line"])
		body = buildTeacherMessageBody(data)
	default:
		// Raw HTML passthrough
		return data["html"]
	}

	return wrapEmailHTML(title, preview, body, schoolName, year)
}

// buildPaymentReceivedBody renders the payment confirmation email body section.
func buildPaymentReceivedBody(d map[string]string) string {
	today := time.Now().Format("02 January 2006")
	return fmt.Sprintf(`
		<div style="background:#dcfce715;border:1px solid #22c55e40;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#22c55e;font-weight:700;font-size:13px;">&#10003; Payment Received Successfully</span>
		</div>
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">Payment Confirmation</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, your payment has been received and recorded.</p>
		%s
		<p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.7;">Please keep this confirmation for your records.</p>`,
		emailDark, d["parent_name"],
		emailInfoTable("Payment Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"Amount Paid", fmt.Sprintf(`<strong style="color:#16a34a;font-size:16px;">$%s USD</strong>`, d["amount_usd"])},
			{"Payment Method", d["payment_method"]},
			{"Reference", d["reference"]},
			{"Date", today},
		}),
	)
}

// buildFeeAssignedBody renders a fee-assigned notification body.
func buildFeeAssignedBody(d map[string]string) string {
	return fmt.Sprintf(`
		<div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#f59e0b;font-weight:700;font-size:13px;">&#128203; New Fee Notice</span>
		</div>
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">School Fee Notice</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, a fee has been assigned to your child's account.</p>
		%s`,
		emailDark, d["parent_name"],
		emailInfoTable("Fee Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"Amount Due", fmt.Sprintf(`<strong style="color:#b45309;font-size:16px;">$%s USD</strong>`, d["amount_usd"])},
			{"Academic Year", d["academic_year"]},
			{"Payment Plan", d["payment_type"]},
			{"Due Date", d["due_date"]},
		}),
	)
}

// buildParentLinkApprovedBody renders parent-link approval content.
func buildParentLinkApprovedBody(d map[string]string) string {
	return fmt.Sprintf(`
		<div style="background:#dcfce715;border:1px solid #22c55e40;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#22c55e;font-weight:700;font-size:13px;">&#10003; Your Link Request Has Been Approved</span>
		</div>
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">Parent Portal Access Granted</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, your request to link to your child's account has been approved by %s.</p>
		%s`,
		emailDark, d["parent_name"], d["school_name"],
		emailInfoTable("Your Child's Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"Status", `<span style="color:#16a34a;font-weight:700;">Linked &amp; Active</span>`},
		}),
	)
}

// buildResultEnteredBody renders an assessment result notification.
func buildResultEnteredBody(d map[string]string) string {
	return fmt.Sprintf(`
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">New Result Posted</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, a new result has been entered for <strong>%s</strong>.</p>
		%s`,
		emailDark, d["parent_name"], d["student_name"],
		emailInfoTable("Result Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"Subject", d["subject_name"]},
			{"Exam Type", d["exam_type"]},
			{"Score", fmt.Sprintf(`<strong style="font-size:16px;">%s / %s</strong>`, d["score"], d["max_score"])},
			{"Term", d["academic_term"]},
			{"Year", d["academic_year"]},
			{"Recorded By", d["teacher_name"]},
		}),
	)
}

// buildHomeworkBody renders a new-homework notification body.
func buildHomeworkBody(d map[string]string) string {
	return fmt.Sprintf(`
		<div style="background:#6366f115;border:1px solid #6366f140;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#6366f1;font-weight:700;font-size:13px;">&#128218; New Homework / Assignment Posted</span>
		</div>
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">Homework Assigned</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, a new piece of homework has been posted for <strong>%s</strong>'s class.</p>
		%s`,
		emailDark, d["parent_name"], d["student_name"],
		emailInfoTable("Assignment Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"Subject", d["subject_name"]},
			{"Title", fmt.Sprintf("<strong>%s</strong>", d["homework_title"])},
			{"Set By", d["teacher_name"]},
			{"Due Date", fmt.Sprintf(`<strong style="color:#b45309;">%s</strong>`, d["due_date"])},
		}),
	)
}

// buildAnnouncementBody renders school announcement content.
func buildAnnouncementBody(d map[string]string) string {
	return fmt.Sprintf(`
		<div style="background:#17255415;border:1px solid #17255440;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
			<span style="color:#172554;font-weight:700;font-size:13px;">&#128226; New Announcement from %s</span>
		</div>
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">%s</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, %s has posted an announcement.</p>
		<div style="background:#f8fafc;border-left:4px solid %s;border-radius:0 8px 8px 0;padding:20px 24px;font-size:14px;color:%s;line-height:1.8;margin-bottom:20px;">%s</div>`,
		d["school_name"],
		emailDark, d["announcement_title"],
		d["parent_name"], d["school_name"],
		emailNavy, emailDark, d["announcement_body"],
	)
}

// buildTeacherMessageBody renders direct teacher-to-parent message content.
func buildTeacherMessageBody(d map[string]string) string {
	return fmt.Sprintf(`
		<h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:%s;">Message from %s</h2>
		<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Dear <strong>%s</strong>, you have received a message from your child's teacher on the %s portal.</p>
		%s
		<h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Message</h3>
		<div style="background:#f8fafc;border-left:4px solid %s;border-radius:0 8px 8px 0;padding:16px 20px;font-size:14px;color:%s;line-height:1.8;">%s</div>`,
		emailDark, d["teacher_name"],
		d["parent_name"], d["school_name"],
		emailInfoTable("Message Details", [][2]string{
			{"School", d["school_name"]},
			{"Student", d["student_name"]},
			{"Class", d["class_name"]},
			{"From", d["teacher_name"]},
			{"Subject", d["subject_line"]},
		}),
		emailNavy, emailDark, d["message_body"],
	)
}

// emailInfoTable renders a section heading + key-value table in the email.
func emailInfoTable(heading string, rows [][2]string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`<h3 style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">%s</h3>`, heading))
	sb.WriteString(`<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;">`)
	for _, row := range rows {
		sb.WriteString(fmt.Sprintf(`<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;width:38%%;vertical-align:top;">%s</td><td style="padding:8px 12px;font-size:13px;color:%s;border:1px solid #e2e8f0;vertical-align:top;">%s</td></tr>`, row[0], emailDark, row[1]))
	}
	sb.WriteString(`</table>`)
	return sb.String()
}

// min returns the smaller of two integers (used for safe response-body truncation).
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
