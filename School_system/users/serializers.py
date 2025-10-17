from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import CustomUser
import random


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'role', 'student_number', 'is_active',
            'date_joined', 'password'
        ]
        read_only_fields = ['id', 'date_joined', 'username', 'email', 'role', 'student_number']
        extra_kwargs = {
            'password': {'write_only': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'username', 'email', 'password', 'confirm_password', 
            'first_name', 'last_name', 'phone_number', 'role', 'student_number', 'whatsapp_pin'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match.")
        return attrs

    def generate_student_number(self):
        while True:
            number = str(random.randint(100000, 999999))  # 6-digit number
            if not CustomUser.objects.filter(student_number=number).exists():
                return number

    def generate_whatsapp_pin(self):
        return str(random.randint(1000, 9999))  # 4-digit PIN

    def create(self, validated_data):
        validated_data.pop('confirm_password')

        role = validated_data.get('role')

        # Generate student_number if role is student
        if role == 'student':
            validated_data['student_number'] = self.generate_student_number()

        # Generate WhatsApp PIN for students and parents
        if role in ['student', 'parent']:
            validated_data['whatsapp_pin'] = self.generate_whatsapp_pin()

        user = CustomUser.objects.create_user(**validated_data)
        return user
    
class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()  # email or student_number
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier')
        password = attrs.get('password')

        user = None

        # Try to find user by email first
        try:
            user_obj = CustomUser.objects.get(email=identifier)
            user = authenticate(username=user_obj.username, password=password)
        except CustomUser.DoesNotExist:
            # If no email found, try student_number
            try:
                user_obj = CustomUser.objects.get(student_number=identifier)
                user = authenticate(username=user_obj.username, password=password)
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError("User not found with this email or student number.")

        if user is None:
            raise serializers.ValidationError("Invalid credentials.")

        attrs['user'] = user
        return attrs

class WhatsAppPinVerificationSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    pin = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone_number = attrs.get('phone_number')
        pin = attrs.get('pin')

        try:
            user = CustomUser.objects.get(phone_number=phone_number, role__in=['student', 'parent'])
            if user.whatsapp_pin == pin:
                attrs['user'] = user
                return attrs
            else:
                raise serializers.ValidationError('Invalid PIN.')
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Invalid phone number.')


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords don't match.")
        return attrs


class SetWhatsAppPinSerializer(serializers.Serializer):
    pin = serializers.CharField(max_length=6, min_length=4)
    confirm_pin = serializers.CharField(max_length=6, min_length=4)

    def validate(self, attrs):
        if attrs['pin'] != attrs['confirm_pin']:
            raise serializers.ValidationError("PINs don't match.")
        if not attrs['pin'].isdigit():
            raise serializers.ValidationError("PIN must contain only numbers.")
        return attrs