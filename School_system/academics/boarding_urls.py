from django.urls import path

from . import boarding_views

urlpatterns = [
    path('summary/', boarding_views.boarding_summary, name='boarding-summary'),

    path('meals/menus/', boarding_views.meal_menus_view, name='boarding-meal-menus'),
    path('meals/attendance/', boarding_views.meal_attendance_view, name='boarding-meal-attendance'),
    path('students/<int:student_id>/dietary/', boarding_views.dietary_flag_view, name='boarding-dietary-flag'),

    path('dormitories/', boarding_views.dormitories_view, name='boarding-dormitories'),
    path('dorm-assignments/', boarding_views.dorm_assignments_view, name='boarding-dorm-assignments'),
    path('dorm-attendance/', boarding_views.dorm_roll_call_view, name='boarding-dorm-roll-call'),
    path('lights-out/', boarding_views.lights_out_view, name='boarding-lights-out'),

    path('exeat/requests/', boarding_views.exeat_requests_view, name='boarding-exeat-requests'),
    path('exeat/requests/<int:exeat_id>/decision/', boarding_views.exeat_decision_view, name='boarding-exeat-decision'),
    path('exeat/logs/', boarding_views.exeat_logs_view, name='boarding-exeat-logs'),

    path('sickbay/visits/', boarding_views.sickbay_visits_view, name='boarding-sickbay-visits'),
    path('medications/', boarding_views.medication_schedules_view, name='boarding-medication-schedules'),

    path('tuck/wallets/', boarding_views.tuck_wallets_view, name='boarding-tuck-wallets'),
    path('tuck/transactions/', boarding_views.tuck_transactions_view, name='boarding-tuck-transactions'),
    path('tuck/low-balance/', boarding_views.tuck_low_balance_view, name='boarding-tuck-low-balance'),

    path('laundry/schedules/', boarding_views.laundry_schedules_view, name='boarding-laundry-schedules'),
    path('laundry/lost-items/', boarding_views.lost_items_view, name='boarding-lost-items'),

    path('prep-attendance/', boarding_views.prep_attendance_view, name='boarding-prep-attendance'),
    path('dorm-inspections/', boarding_views.dorm_inspections_view, name='boarding-dorm-inspections'),
    path('wellness-checkins/', boarding_views.wellness_checkins_view, name='boarding-wellness-checkins'),
]
