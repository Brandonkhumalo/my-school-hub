from rest_framework import serializers
from .models import HealthRecord, ClinicVisit


class HealthRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_number = serializers.CharField(source='student.user.student_number', read_only=True)

    class Meta:
        model = HealthRecord
        fields = [
            'id', 'student', 'student_name', 'student_number',
            'blood_type', 'allergies', 'chronic_conditions', 'medications',
            'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relationship',
            'medical_aid_name', 'medical_aid_number',
            'notes', 'last_updated',
        ]
        read_only_fields = ['id', 'student', 'last_updated']


class ClinicVisitSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ClinicVisit
        fields = [
            'id', 'student', 'student_name',
            'visit_date', 'complaint', 'diagnosis', 'treatment',
            'nurse_notes', 'parent_notified', 'follow_up_required',
            'recorded_by', 'recorded_by_name', 'school',
        ]
        read_only_fields = ['id', 'visit_date', 'recorded_by', 'school']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.full_name
        return ''
