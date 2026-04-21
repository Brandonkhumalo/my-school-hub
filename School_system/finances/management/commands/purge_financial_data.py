"""
Management command to purge all fee/invoice/payment data while preserving payroll.

Usage:
    python manage.py purge_financial_data            # dry run (shows counts)
    python manage.py purge_financial_data --confirm  # actually deletes
    python manage.py purge_financial_data --school-id 3 --confirm  # single school only
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Delete all invoices, school fees, and payment records. Payroll is NOT touched."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Actually perform the deletion. Without this flag the command is a dry run.",
        )
        parser.add_argument(
            "--school-id",
            type=int,
            default=None,
            help="Restrict deletion to a single school by ID (optional).",
        )

    def handle(self, *args, **options):
        from finances.models import (
            PaymentIntent,
            PaymentTransaction,
            Invoice,
            StudentPaymentRecord,
            Payment,
            StudentFee,
            FeeType,
            SchoolFees,
            AdditionalFee,
            TransportFeePreference,
        )

        school_id = options["school_id"]
        confirm = options["confirm"]

        def qs(model, school_field="school_id"):
            q = model.objects.all()
            if school_id:
                try:
                    q = q.filter(**{school_field: school_id})
                except Exception:
                    pass
            return q

        # StudentFee has no direct school FK — filter via fee_type__school or student__school
        def student_fee_qs():
            q = StudentFee.objects.all()
            if school_id:
                q = q.filter(fee_type__school_id=school_id)
            return q

        # Payment has no direct school FK — filter via student_fee__fee_type__school
        def payment_qs():
            q = Payment.objects.all()
            if school_id:
                q = q.filter(student_fee__fee_type__school_id=school_id)
            return q

        steps = [
            # Delete children before parents to avoid FK constraint errors
            ("PaymentIntent",           qs(PaymentIntent)),
            ("PaymentTransaction",      qs(PaymentTransaction, "payment_record__school_id")),
            ("Invoice",                 qs(Invoice)),
            ("StudentPaymentRecord",    qs(StudentPaymentRecord)),
            ("Payment",                 payment_qs()),
            ("StudentFee",              student_fee_qs()),
            ("FeeType",                 qs(FeeType)),
            ("SchoolFees",              qs(SchoolFees)),
            ("AdditionalFee",           qs(AdditionalFee)),
            ("TransportFeePreference",  TransportFeePreference.objects.all() if not school_id
                                        else TransportFeePreference.objects.filter(student__school_id=school_id)),
        ]

        scope = f"school ID {school_id}" if school_id else "ALL schools"
        self.stdout.write(f"\n{'DRY RUN — ' if not confirm else ''}Purge scope: {scope}\n")
        self.stdout.write("-" * 50)

        totals = {}
        for label, queryset in steps:
            count = queryset.count()
            totals[label] = count
            self.stdout.write(f"  {label:<28} {count:>6} record(s)")

        total = sum(totals.values())
        self.stdout.write("-" * 50)
        self.stdout.write(f"  {'TOTAL':<28} {total:>6} record(s)\n")

        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    "Dry run complete. Re-run with --confirm to permanently delete.\n"
                )
            )
            return

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to delete.\n"))
            return

        self.stdout.write(self.style.ERROR("\nDeleting records — this cannot be undone...\n"))

        with transaction.atomic():
            for label, queryset in steps:
                deleted, _ = queryset.delete()
                self.stdout.write(f"  Deleted {deleted:>6}  {label}")

        self.stdout.write(self.style.SUCCESS("\nDone. Payroll data was not touched.\n"))
