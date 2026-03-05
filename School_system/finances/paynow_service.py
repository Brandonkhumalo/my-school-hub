"""
PayNow Zimbabwe payment service.
Docs: https://developers.paynow.co.zw/docs/

Per-school credentials are passed explicitly from views (fetched from SchoolSettings).
Global PAYNOW_RESULT_URL and PAYNOW_RETURN_URL are still read from settings/.env.
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def get_paynow_client(integration_id: str, integration_key: str):
    """Return a configured Paynow client using per-school credentials."""
    from paynow import Paynow
    return Paynow(
        integration_id,
        integration_key,
        settings.PAYNOW_RESULT_URL,
        settings.PAYNOW_RETURN_URL,
    )


def initiate_web_payment(reference: str, email: str, items: list, integration_id: str, integration_key: str) -> dict:
    """
    Initiate a standard web payment (redirect to PayNow checkout).

    Args:
        reference: Unique payment reference (e.g. "Invoice-STU001")
        email: Payer's email address
        items: List of {"description": str, "amount": float}
        integration_id: School's PayNow integration ID
        integration_key: School's PayNow integration key

    Returns:
        {
            "success": bool,
            "redirect_url": str,
            "poll_url": str,
            "error": str or None
        }
    """
    try:
        paynow = get_paynow_client(integration_id, integration_key)
        payment = paynow.create_payment(reference, email)
        for item in items:
            payment.add(item['description'], item['amount'])

        response = paynow.send(payment)

        if response.success:
            return {
                'success': True,
                'redirect_url': response.redirect_url,
                'poll_url': response.poll_url,
                'error': None,
            }
        else:
            logger.error('PayNow web payment failed: %s', response.error)
            return {'success': False, 'redirect_url': None, 'poll_url': None, 'error': response.error}
    except Exception as exc:
        logger.exception('PayNow web payment exception: %s', exc)
        return {'success': False, 'redirect_url': None, 'poll_url': None, 'error': str(exc)}


def initiate_mobile_payment(reference: str, email: str, items: list, phone: str, integration_id: str, integration_key: str, method: str = 'ecocash') -> dict:
    """
    Initiate a mobile money payment (EcoCash, OneMoney, InnBucks).

    Args:
        method: 'ecocash' | 'onemoney' | 'innbucks'
        integration_id: School's PayNow integration ID
        integration_key: School's PayNow integration key
    """
    try:
        paynow = get_paynow_client(integration_id, integration_key)
        payment = paynow.create_payment(reference, email)
        for item in items:
            payment.add(item['description'], item['amount'])

        response = paynow.send_mobile(payment, phone, method)

        if response.success:
            return {
                'success': True,
                'redirect_url': getattr(response, 'redirect_url', None),
                'poll_url': response.poll_url,
                'instructions': getattr(response, 'instructions', None),
                'error': None,
            }
        else:
            logger.error('PayNow mobile payment failed: %s', response.error)
            return {'success': False, 'poll_url': None, 'error': response.error}
    except Exception as exc:
        logger.exception('PayNow mobile payment exception: %s', exc)
        return {'success': False, 'poll_url': None, 'error': str(exc)}


def check_payment_status(poll_url: str, integration_id: str, integration_key: str) -> dict:
    """Poll PayNow for the current status of a payment."""
    try:
        paynow = get_paynow_client(integration_id, integration_key)
        status = paynow.check_transaction_status(poll_url)
        return {
            'paid': status.paid,
            'status': status.status,
            'amount': getattr(status, 'amount', None),
        }
    except Exception as exc:
        logger.exception('PayNow status check failed: %s', exc)
        return {'paid': False, 'status': 'error', 'amount': None}
