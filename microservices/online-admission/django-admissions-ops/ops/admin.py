from django.contrib import admin
from .models import AdmissionsFormTemplate, AdmissionsFormField, ComplianceProfile


class AdmissionsFormFieldInline(admin.TabularInline):
    model = AdmissionsFormField
    extra = 1


@admin.register(AdmissionsFormTemplate)
class AdmissionsFormTemplateAdmin(admin.ModelAdmin):
    list_display = ("school_id", "name", "is_active", "opens_at", "closes_at", "updated_at")
    list_filter = ("school_id", "is_active")
    search_fields = ("school_id", "name")
    inlines = [AdmissionsFormFieldInline]


@admin.register(ComplianceProfile)
class ComplianceProfileAdmin(admin.ModelAdmin):
    list_display = ("school_id", "retention_days", "requires_parental_consent", "data_residency_region", "updated_at")
    list_filter = ("requires_parental_consent", "data_residency_region")
    search_fields = ("school_id",)
