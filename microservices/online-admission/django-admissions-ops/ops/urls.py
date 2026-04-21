from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("api/v1/admissions/admin/templates/", views.templates),
    path("api/v1/admissions/admin/compliance/", views.compliance),
]
