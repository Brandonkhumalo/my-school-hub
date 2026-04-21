from django.db import models


class AdmissionsFormTemplate(models.Model):
    school_id = models.CharField(max_length=120, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    opens_at = models.DateTimeField()
    closes_at = models.DateTimeField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("school_id", "name")
        ordering = ["school_id", "name"]

    def __str__(self):
        return f"{self.school_id} - {self.name}"


class AdmissionsFormField(models.Model):
    FIELD_TYPES = [
        ("text", "Text"),
        ("email", "Email"),
        ("number", "Number"),
        ("date", "Date"),
        ("select", "Select"),
        ("file", "File"),
        ("boolean", "Boolean"),
    ]

    template = models.ForeignKey(AdmissionsFormTemplate, on_delete=models.CASCADE, related_name="fields")
    key = models.CharField(max_length=80)
    label = models.CharField(max_length=120)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES)
    required = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    options_json = models.JSONField(default=list, blank=True)
    validation_json = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("template", "key")
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.template.school_id} - {self.key}"


class ComplianceProfile(models.Model):
    school_id = models.CharField(max_length=120, unique=True)
    retention_days = models.PositiveIntegerField(default=365)
    requires_parental_consent = models.BooleanField(default=True)
    allows_data_export = models.BooleanField(default=True)
    allows_right_to_delete = models.BooleanField(default=True)
    data_residency_region = models.CharField(max_length=80, default="auto")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_id"]

    def __str__(self):
        return self.school_id
