# MySchoolHub - School Management System

## Overview
MySchoolHub is a comprehensive multi-tenant SaaS School Management System built with React and Django. It facilitates school administration and enhances communication by providing distinct dashboards for administrators, teachers, students, and parents. Schools self-register, receiving auto-generated admin credentials, and each operates as an isolated tenant. The system supports various school types (Primary, Secondary, Combined) and curricula (ZIMSEC, Cambridge International).

The platform aims to streamline operations such as student and teacher management, attendance tracking, grade entry, timetable management, and fee administration. It also includes robust communication features like parent-teacher messaging and student homework access, aiming to centralize all school-related activities for improved efficiency and engagement.

## User Preferences
I want to communicate in simple language. I prefer iterative development. Ask before making major changes.

## System Architecture

### Multi-Tenant Architecture
Each school is a distinct tenant, identified by a unique code, ensuring strict data isolation. All users and data are associated with a specific school, preventing cross-tenant data access. School registration automatically generates an admin user with secure, one-time credentials.

### Technology Stack
-   **Frontend:** React 19.1.1, Vite 7.1.7, React Router DOM 7.9.1, Tailwind CSS (via CDN)
-   **Backend:** Django 5.2.7, Django REST Framework
-   **Authentication:** JWT (djangorestframework-simplejwt)
-   **Database:** PostgreSQL

### UI/UX Decisions
The system provides tailored experiences for four roles: Admin, Teacher, Student, and Parent.
-   **Admin Portal:** Comprehensive system management, including student/teacher management, parent request approval, invoice management, results overview, and timetable viewing. Also includes advanced features like timetable generation and school fees management.
-   **Teacher Portal:** Features for marks entry, attendance tracking, subject performance analytics, homework management, and parent-teacher messaging.
-   **Student Portal:** Access to grades, timetable, fees, assignments, and school announcements.
-   **Parent Portal:** Supports multi-child management, academic performance viewing, homework access, fee tracking, and direct parent-teacher messaging. Secure parent-child linking requires admin approval.
-   **Branding:** Uses product name "MySchoolHub" with tagline "Complete School Management" and a blue/yellow color scheme.

### Frontend Routing Structure
-   **Public Routes:** Landing page, about, contact, general login, dedicated admin login, parent registration, and logout.
-   **Protected Routes:** Role-specific dashboards and management pages for `/admin`, `/teacher`, `/student`, and `/parent`.

### Technical Implementations
-   API communication uses JWT Bearer tokens stored in localStorage.
-   Role-based permissions are enforced across all API endpoints.
-   Database models support core functionalities like `ParentChildLink`, `WeeklyMessage`, `SchoolEvent`, `Assignment`, `Attendance`, `ParentTeacherMessage`, and `Homework`.
-   **Parent-Child Linking:** A secure, two-step process requiring school and student search, followed by admin approval of link requests to protect student data and privacy.
-   **Admin Extras:** Includes timetable generation using a CSP algorithm and comprehensive school fees management supporting multiple currencies and academic structures.
-   **Teacher Features:** Intelligent filtering for marks entry, detailed attendance options, comprehensive subject analytics, and a bidirectional parent-teacher messaging system.
-   **Tishanyq Developer Admin Portal:** A hidden superadmin portal for Tishanyq Digital team members to manage schools, create new schools, and reset admin passwords, accessible via a secret key.

## External Dependencies

-   **Backend API:** A Django-based API expected to run locally on `localhost:8000` for all data operations and authentication.
-   **PostgreSQL:** Utilized as the primary database, typically managed through Replit's database services.
-   **Tailwind CSS CDN:** Currently used for styling, with plans for local integration.