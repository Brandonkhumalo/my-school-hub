import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_datetime
from .models import AdmissionsFormTemplate, ComplianceProfile


def health(request):
    return JsonResponse({"status": "ok", "service": "django-admissions-ops"})


def _json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


@csrf_exempt
def templates(request):
    if request.method == "GET":
        school_id = request.GET.get("school_id")
        qs = AdmissionsFormTemplate.objects.all().prefetch_related("fields")
        if school_id:
            qs = qs.filter(school_id=school_id)
        data = []
        for item in qs:
            data.append(
                {
                    "id": item.id,
                    "school_id": item.school_id,
                    "name": item.name,
                    "description": item.description,
                    "is_active": item.is_active,
                    "opens_at": item.opens_at.isoformat(),
                    "closes_at": item.closes_at.isoformat(),
                    "fields": [
                        {
                            "key": field.key,
                            "label": field.label,
                            "field_type": field.field_type,
                            "required": field.required,
                            "position": field.position,
                            "options": field.options_json,
                            "validation": field.validation_json,
                        }
                        for field in item.fields.all()
                    ],
                }
            )
        return JsonResponse({"count": len(data), "results": data})

    if request.method == "POST":
        payload = _json_body(request)
        if payload is None:
            return JsonResponse({"detail": "invalid JSON payload"}, status=400)

        required = ["school_id", "name", "opens_at", "closes_at"]
        for key in required:
            if not payload.get(key):
                return JsonResponse({"detail": f"{key} is required"}, status=400)

        opens_at = parse_datetime(payload["opens_at"])
        closes_at = parse_datetime(payload["closes_at"])
        if not opens_at or not closes_at:
            return JsonResponse({"detail": "opens_at and closes_at must be ISO-8601 datetime strings"}, status=400)
        if closes_at <= opens_at:
            return JsonResponse({"detail": "closes_at must be after opens_at"}, status=400)

        template, created = AdmissionsFormTemplate.objects.update_or_create(
            school_id=payload["school_id"],
            name=payload["name"],
            defaults={
                "description": payload.get("description", ""),
                "is_active": bool(payload.get("is_active", True)),
                "opens_at": opens_at,
                "closes_at": closes_at,
            },
        )

        return JsonResponse(
            {
                "id": template.id,
                "school_id": template.school_id,
                "name": template.name,
                "created": created,
            },
            status=201 if created else 200,
        )

    return JsonResponse({"detail": "method not allowed"}, status=405)


@csrf_exempt
def compliance(request):
    if request.method == "GET":
        school_id = request.GET.get("school_id")
        if not school_id:
            return JsonResponse({"detail": "school_id is required"}, status=400)
        profile, _ = ComplianceProfile.objects.get_or_create(school_id=school_id)
        return JsonResponse(
            {
                "school_id": profile.school_id,
                "retention_days": profile.retention_days,
                "requires_parental_consent": profile.requires_parental_consent,
                "allows_data_export": profile.allows_data_export,
                "allows_right_to_delete": profile.allows_right_to_delete,
                "data_residency_region": profile.data_residency_region,
            }
        )

    if request.method == "POST":
        payload = _json_body(request)
        if payload is None:
            return JsonResponse({"detail": "invalid JSON payload"}, status=400)
        school_id = payload.get("school_id")
        if not school_id:
            return JsonResponse({"detail": "school_id is required"}, status=400)

        profile, _ = ComplianceProfile.objects.get_or_create(school_id=school_id)
        profile.retention_days = int(payload.get("retention_days", profile.retention_days))
        profile.requires_parental_consent = bool(payload.get("requires_parental_consent", profile.requires_parental_consent))
        profile.allows_data_export = bool(payload.get("allows_data_export", profile.allows_data_export))
        profile.allows_right_to_delete = bool(payload.get("allows_right_to_delete", profile.allows_right_to_delete))
        profile.data_residency_region = payload.get("data_residency_region", profile.data_residency_region)
        profile.save()

        return JsonResponse({"detail": "compliance profile saved", "school_id": profile.school_id})

    return JsonResponse({"detail": "method not allowed"}, status=405)
