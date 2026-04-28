from django.core.management.base import BaseCommand

from academics.models import Parent, ParentChildLink, Student, Teacher


class Command(BaseCommand):
    help = "Audit school membership integrity across teachers, students, and parent-school links."

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true", help="Apply safe automatic fixes.")

    def handle(self, *args, **options):
        fix = options["fix"]
        issues = {
            "teachers_missing_school": 0,
            "students_missing_school": 0,
            "parent_links_missing_parent_school_membership": 0,
            "parents_missing_primary_school": 0,
            "fixed_parent_school_memberships": 0,
            "fixed_parent_primary_school": 0,
        }

        for teacher in Teacher.objects.select_related("user"):
            if not teacher.user.school_id:
                issues["teachers_missing_school"] += 1

        for student in Student.objects.select_related("user"):
            if not student.user.school_id:
                issues["students_missing_school"] += 1

        links = ParentChildLink.objects.filter(is_confirmed=True).select_related(
            "parent__user", "student__user"
        )
        for link in links:
            parent = link.parent
            school = link.student.user.school
            if not school:
                continue
            if not parent.schools.filter(id=school.id).exists():
                issues["parent_links_missing_parent_school_membership"] += 1
                if fix:
                    parent.schools.add(school)
                    issues["fixed_parent_school_memberships"] += 1
            if not parent.user.school_id:
                issues["parents_missing_primary_school"] += 1
                if fix:
                    parent.user.school = school
                    parent.user.save(update_fields=["school"])
                    issues["fixed_parent_primary_school"] += 1

        self.stdout.write(self.style.SUCCESS("School membership integrity report"))
        for key, value in issues.items():
            self.stdout.write(f"- {key}: {value}")
