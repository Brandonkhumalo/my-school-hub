"""
Celery tasks for WhatsApp integration.

These tasks move blocking operations (Meta API HTTP calls, message processing)
off the webhook request/response cycle so the webhook returns immediately.

When GO_SERVICES_URL is set, outgoing messages are delegated to the Go service
which uses goroutines for non-blocking concurrent sending with retries.
"""
from celery import shared_task
import logging
import os

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_whatsapp_message_task(self, to_phone: str, message_text: str):
    """
    Send a WhatsApp message asynchronously.
    Delegates to Go service (goroutine-based) if available, falls back to direct API call.
    """
    try:
        import requests
        from .models import WhatsAppUser, WhatsAppMessage

        # ── Delegate to Go Services if available ──
        go_services_url = os.environ.get('GO_SERVICES_URL', '')
        if go_services_url:
            try:
                resp = requests.post(
                    f"{go_services_url}/api/v1/services/whatsapp/send",
                    headers={
                        "Content-Type": "application/json",
                        "X-Gateway-Auth": "true",
                        "X-User-ID": "system",
                    },
                    json={
                        "to_phone": to_phone,
                        "message_text": message_text,
                    },
                    timeout=5,
                )
                if resp.status_code in (200, 202):
                    logger.info("WhatsApp message delegated to Go service for %s", to_phone)
                    # Log outgoing message in Django DB
                    try:
                        whatsapp_user = WhatsAppUser.objects.get(phone_number=to_phone)
                        WhatsAppMessage.objects.create(
                            whatsapp_user=whatsapp_user,
                            message_id=f"out_{whatsapp_user.id}_go",
                            direction='outgoing',
                            message_type='text',
                            content=message_text,
                        )
                    except WhatsAppUser.DoesNotExist:
                        pass
                    return True
                else:
                    logger.warning("Go WhatsApp service returned %s, falling back", resp.status_code)
            except Exception as exc:
                logger.warning("Go WhatsApp service unavailable (%s), falling back", exc)

        # ── Fallback: direct Meta API call ──
        from django.conf import settings

        url = f"{settings.WHATSAPP_API_URL}/messages"
        headers = {
            'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}',
            'Content-Type': 'application/json',
        }
        data = {
            'messaging_product': 'whatsapp',
            'to': to_phone,
            'type': 'text',
            'text': {'body': message_text},
        }

        response = requests.post(url, headers=headers, json=data, timeout=15)
        response.raise_for_status()

        # Log the outgoing message
        try:
            whatsapp_user = WhatsAppUser.objects.get(phone_number=to_phone)
            msg_id = response.json().get('messages', [{}])[0].get('id', '')
            WhatsAppMessage.objects.create(
                whatsapp_user=whatsapp_user,
                message_id=f"out_{whatsapp_user.id}_{msg_id}",
                direction='outgoing',
                message_type='text',
                content=message_text,
            )
        except WhatsAppUser.DoesNotExist:
            pass

        logger.info("WhatsApp message sent to %s", to_phone)
        return True

    except Exception as exc:
        logger.warning("Failed to send WhatsApp message to %s: %s", to_phone, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_whatsapp_message_task(self, message_data: dict, contacts_data: list):
    """
    Process an incoming WhatsApp webhook message asynchronously.
    The webhook handler enqueues this task and returns 200 immediately,
    keeping the webhook response within Meta's 20-second timeout.
    """
    try:
        from .models import WhatsAppUser, WhatsAppMessage
        from .views import handle_user_message

        from_phone = message_data.get('from')
        message_id = message_data.get('id')
        message_type = message_data.get('type', 'text')

        # Extract content
        content = ''
        if message_type == 'text':
            content = message_data.get('text', {}).get('body', '')
        elif message_type == 'button':
            content = message_data.get('button', {}).get('text', '')
        elif message_type == 'interactive':
            interactive = message_data.get('interactive', {})
            if interactive.get('type') == 'button_reply':
                content = interactive.get('button_reply', {}).get('title', '')
            elif interactive.get('type') == 'list_reply':
                content = interactive.get('list_reply', {}).get('title', '')

        whatsapp_user, _ = WhatsAppUser.objects.get_or_create(
            phone_number=from_phone,
            defaults={'whatsapp_id': from_phone},
        )

        WhatsAppMessage.objects.create(
            whatsapp_user=whatsapp_user,
            message_id=message_id,
            direction='incoming',
            message_type=message_type,
            content=content,
        )

        response_message = handle_user_message(whatsapp_user, content)
        if response_message:
            # Enqueue outgoing message as a separate task for its own retry logic
            send_whatsapp_message_task.delay(from_phone, response_message)

    except Exception as exc:
        logger.error("Error processing WhatsApp message: %s", exc)
        raise self.retry(exc=exc)
