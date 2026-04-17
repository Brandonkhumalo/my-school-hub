"""
At-risk alert detection and notification service.

Usage:
    from .at_risk_alerts import check_and_alert_at_risk
    check_and_alert_at_risk(student, subject=subject_obj)
"""

import logging
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import AtRiskAlert, Result, Student
from .ml_predictions import predict_student_grades

logger = logging.getLogger(__name__)


def check_and_alert_at_risk(student, subject=None):
    """
    Check if student entered at-risk status. Create/update alert and notify stakeholders.
    Called after results are entered or updated.
    
    Args:
        student: Student instance
        subject: Optional Subject instance to check only one subject
    """
    if not isinstance(student, Student):
        logger.error(f"check_and_alert_at_risk: Invalid student type {type(student)}")
        return
    
    try:
        predictions = predict_student_grades(student)
        
        if subject:
            predictions = [p for p in predictions if p['subject_id'] == subject.id]
        
        for pred in predictions:
            current_at_risk = pred['at_risk']
            subject_id = pred['subject_id']
            
            # Check for existing active alert
            existing_alert = AtRiskAlert.objects.filter(
                student=student,
                subject_id=subject_id,
                status__in=['new', 'acknowledged', 'intervention_scheduled']
            ).first()
            
            if current_at_risk:
                # Student is at risk
                if not existing_alert:
                    # Create new alert
                    trigger_type = 'current_failing' if pred['current_percentage'] < 50 else 'prediction_fail'
                    if pred['predicted_at_risk']:
                        trigger_type = 'prediction_fail'
                    
                    alert = AtRiskAlert.objects.create(
                        student=student,
                        subject_id=subject_id,
                        triggered_by=trigger_type,
                        current_grade=pred['current_grade'],
                        predicted_grade=pred['predicted_grade'],
                        predicted_percentage=pred['predicted_percentage'],
                        trend=pred['trend'],
                        confidence=pred['confidence'],
                        intervention_plan=pred['intervention'],
                        school=student.user.school
                    )
                    logger.info(f"Created new at-risk alert for {student.user.full_name} in {pred['subject']}")
                    notify_at_risk(alert, student, pred)
                else:
                    # Update existing alert
                    existing_alert.current_grade = pred['current_grade']
                    existing_alert.predicted_grade = pred['predicted_grade']
                    existing_alert.predicted_percentage = pred['predicted_percentage']
                    existing_alert.trend = pred['trend']
                    existing_alert.confidence = pred['confidence']
                    existing_alert.intervention_plan = pred['intervention']
                    existing_alert.updated_at = timezone.now()
                    existing_alert.save()
                    logger.info(f"Updated at-risk alert for {student.user.full_name} in {pred['subject']}")
            else:
                # Student recovered
                if existing_alert and existing_alert.status != 'resolved':
                    existing_alert.status = 'resolved'
                    existing_alert.resolved_at = timezone.now()
                    existing_alert.save()
                    logger.info(f"Resolved at-risk alert for {student.user.full_name} in {pred['subject']}")
    
    except Exception as e:
        logger.error(f"Error in check_and_alert_at_risk for student {student.id}: {str(e)}")


def notify_at_risk(alert, student, prediction):
    """
    Send notifications to teacher, parents, and admin about at-risk student.
    
    Args:
        alert: AtRiskAlert instance
        student: Student instance
        prediction: Prediction dict from ml_predictions
    """
    try:
        from academics.models import Teacher
        from users.models import CustomUser
        
        school = student.user.school
        subject_obj = alert.subject
        
        # Get subject teacher
        teacher_user = None
        if subject_obj:
            try:
                teacher = subject_obj.teachers.first()
                if teacher:
                    teacher_user = teacher.user
            except:
                pass
        
        # Get parents
        parents = list(student.parents.all()) if hasattr(student, 'parents') else []
        parent_users = [p.user for p in parents if p.user.email]
        
        # Get admin
        admin = CustomUser.objects.filter(school=school, role='admin').first()
        
        message = f"""
Alert: {student.user.full_name} ({student.student_number})
Subject: {subject_obj.name if subject_obj else 'Overall'}

Current Performance:
  Grade: {prediction['current_grade']}
  Percentage: {prediction['current_percentage']:.1f}%
  
Predicted Performance:
  Grade: {prediction['predicted_grade']}
  Percentage: {prediction['predicted_percentage']:.1f}%

Trend: {prediction['trend'].title()}
Confidence: {prediction['confidence'].title()}

Recommendation:
{prediction['intervention']}

Please take action immediately.
        """
        
        # Notify teacher
        if teacher_user and teacher_user.email and not alert.notified_teacher:
            try:
                send_mail(
                    f"At-Risk Alert: {student.user.full_name} - {subject_obj.name if subject_obj else 'Overall'}",
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [teacher_user.email],
                    fail_silently=False,
                )
                alert.notified_teacher = True
                logger.info(f"Notified teacher {teacher_user.email} about {student.user.full_name}")
            except Exception as e:
                logger.error(f"Failed to notify teacher: {str(e)}")
        
        # Notify parents
        if parent_users and not alert.notified_parent:
            try:
                parent_emails = [p.email for p in parent_users if p.email]
                if parent_emails:
                    send_mail(
                        f"Academic Alert: {student.user.full_name}",
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        parent_emails,
                        fail_silently=False,
                    )
                    alert.notified_parent = True
                    logger.info(f"Notified {len(parent_emails)} parent(s) about {student.user.full_name}")
            except Exception as e:
                logger.error(f"Failed to notify parents: {str(e)}")
        
        # Notify admin
        if admin and admin.email and not alert.notified_admin:
            try:
                send_mail(
                    f"At-Risk Alert: {student.user.full_name} - {subject_obj.name if subject_obj else 'Overall'}",
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [admin.email],
                    fail_silently=False,
                )
                alert.notified_admin = True
                logger.info(f"Notified admin {admin.email} about {student.user.full_name}")
            except Exception as e:
                logger.error(f"Failed to notify admin: {str(e)}")
        
        alert.save()
    
    except Exception as e:
        logger.error(f"Error in notify_at_risk: {str(e)}")


def get_student_risk_score(student):
    """
    Calculate overall at-risk score (0-100) for a student across all subjects.
    Higher score = more at risk.
    
    Returns:
        float: Risk score 0-100
    """
    try:
        predictions = predict_student_grades(student)
        
        if not predictions:
            return 0.0
        
        at_risk_count = sum(1 for p in predictions if p['at_risk'])
        total_subjects = len(predictions)
        
        # Base score: % of subjects where student is at risk
        base_score = (at_risk_count / total_subjects * 100) if total_subjects > 0 else 0
        
        # Factor in confidence: lower confidence = lower risk weight
        confidence_weights = {'high': 1.0, 'medium': 0.7, 'low': 0.4}
        weighted_score = 0
        
        for pred in predictions:
            if pred['at_risk']:
                weight = confidence_weights.get(pred['confidence'], 0.5)
                weighted_score += weight * (100 / total_subjects)
        
        # Average base and weighted score
        return (base_score + weighted_score) / 2
    
    except Exception as e:
        logger.error(f"Error calculating risk score for student {student.id}: {str(e)}")
        return 0.0
