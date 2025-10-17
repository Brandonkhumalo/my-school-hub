from rest_framework import serializers
from .models import WhatsAppUser, WhatsAppSession, WhatsAppMessage, WhatsAppPayment, WhatsAppMenu


class WhatsAppUserSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = WhatsAppUser
        fields = [
            'id', 'user', 'user_name', 'user_role', 'phone_number', 'whatsapp_id',
            'is_verified', 'pin_verified', 'registration_date', 'last_interaction'
        ]


class WhatsAppSessionSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source='whatsapp_user.phone_number', read_only=True)

    class Meta:
        model = WhatsAppSession
        fields = [
            'id', 'whatsapp_user', 'user_phone', 'session_id', 'current_menu',
            'session_data', 'is_active', 'started_at', 'last_activity'
        ]


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source='whatsapp_user.phone_number', read_only=True)

    class Meta:
        model = WhatsAppMessage
        fields = [
            'id', 'whatsapp_user', 'user_phone', 'message_id', 'direction',
            'message_type', 'content', 'timestamp', 'is_read'
        ]


class WhatsAppPaymentSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source='whatsapp_user.phone_number', read_only=True)

    class Meta:
        model = WhatsAppPayment
        fields = [
            'id', 'whatsapp_user', 'user_phone', 'student_fee_id', 'amount',
            'payment_reference', 'status', 'payment_method', 'initiated_at', 'completed_at'
        ]


class WhatsAppMenuSerializer(serializers.ModelSerializer):
    parent_menu_title = serializers.CharField(source='parent_menu.menu_title', read_only=True)
    submenu_count = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppMenu
        fields = [
            'id', 'menu_key', 'menu_title', 'menu_text', 'parent_menu',
            'parent_menu_title', 'is_active', 'required_role', 'submenu_count'
        ]

    def get_submenu_count(self, obj):
        return obj.whatsappmenu_set.count()


class WebhookMessageSerializer(serializers.Serializer):
    """Serializer for incoming WhatsApp webhook messages"""
    from_phone = serializers.CharField()
    message_id = serializers.CharField()
    message_type = serializers.CharField()
    content = serializers.CharField()
    timestamp = serializers.CharField()


class SendMessageSerializer(serializers.Serializer):
    """Serializer for sending WhatsApp messages"""
    to_phone = serializers.CharField()
    message_type = serializers.CharField(default='text')
    content = serializers.CharField()
    template_name = serializers.CharField(required=False)
    template_params = serializers.ListField(required=False)