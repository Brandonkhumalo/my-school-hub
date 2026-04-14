fix this on Go+Django branch

Not fixed by merge (still broken after merge):

Assignment.created_by usage in teacher submission endpoints (model still has teacher, not created_by on Assignment).
WhatsApp PIN key mismatch (validated_data['whatsapp_pin'] vs serializer pin).
Payment status inconsistency ('fully paid' vs choices unpaid|partial|paid).
Hardcoded superadmin fallback secret.
Plaintext school.admin_password storage.
Frontend hardcoded production API base URL.
No Go test files (still no _test.go).