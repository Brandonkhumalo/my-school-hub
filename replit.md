# MySchoolHub - School Management System

## Overview
MySchoolHub is a comprehensive multi-tenant SaaS School Management System built with React and Django, where each school operates as a separate tenant. Schools self-register and receive auto-generated admin credentials. The platform offers distinct dashboards for administrators, teachers, students, and parents, streamlining school administration and enhancing communication.

## Multi-Tenant Architecture

### School as Tenant Entity
- **School Model:** Each school is a tenant with unique code (SCH + 5 random alphanumeric), name, email, phone, address, city, curriculum (ZIMSEC/Cambridge), and school type (Primary/Secondary/Combined)
- **Tenant Isolation:** All users (students, teachers, parents) are associated with a school. All data queries are filtered by school to prevent cross-tenant data access.
- **User Creation Flow:** When admins create students/teachers, the new users automatically inherit the admin's school and are tracked via `created_by`.

### School Registration & Admin Credentials
- **Self-Registration:** Schools register via `/api/auth/schools/register/` endpoint
- **Auto-Generated Admin:** System creates admin user with generated username (schoolname_admin) and secure random password
- **One-Time Password Delivery:** Admin password is returned only once in registration response - it cannot be recovered
- **API Endpoints:**
  - `POST /api/auth/schools/register/` - Register new school (public)
  - `GET /api/auth/schools/search/?q=<query>` - Search schools by name/code (public)
  - `GET /api/auth/schools/` - List all schools (superadmin only)

### Tenant-Isolated API Endpoints
All list/create/update/delete endpoints filter data by `request.user.school`:
- Subjects, Classes, Students, Teachers, Parents
- Results, Timetables, Announcements, Complaints, Suspensions
- Parent student search requires `school_id` parameter

## Product Branding
- **Product Name:** MySchoolHub
- **Tagline:** "Complete School Management"
- **Developer:** Tishanyq Digital (tishanyq.co.zw)
- **Colors:** Blue (#1e3a8a) and Yellow (#eab308)
- **Logo:** Book icon on yellow/gold gradient background
- **Target Users:** Primary schools, Secondary schools, High schools (both public and private)
- **Supported Curricula:** ZIMSEC and Cambridge International

## User Preferences
I want to communicate in simple language. I prefer iterative development. Ask before making major changes.

## System Architecture

### Technology Stack
- **Frontend Framework:** React 19.1.1
- **Build Tool:** Vite 7.1.7
- **Routing:** React Router DOM 7.9.1
- **Styling:** Tailwind CSS (via CDN)
- **Backend Framework:** Django 5.2.7
- **API:** Django REST Framework
- **Authentication:** JWT (djangorestframework-simplejwt)
- **CORS:** django-cors-headers
- **Database:** PostgreSQL (via Replit database)

### Frontend Routing Structure
- **Public Routes:**
  - `/` - Landing page for MySchoolHub with hero section, use cases, target audience, features, and security info
  - `/about` - Features page with detailed capabilities for admins, teachers, students, and parents
  - `/contact` - Contact page with inquiry form, FAQ, and developer info (Tishanyq Digital)
  - `/login` - Login page for students, parents, and teachers
  - `/admin/login` - Dedicated admin login page
  - `/register/parent` - Parent self-registration
  - `/logout` - Logout handler

- **Protected Routes (requires authentication):**
  - `/admin` - Admin dashboard
  - `/admin/students` - Student management with search and detailed views
  - `/admin/teachers` - Teacher management with search and subject/class assignments
  - `/admin/parent-requests` - Parent-child link request approval/rejection
  - `/admin/invoices` - Invoice management with filtering, sorting, and pagination
  - `/admin/results` - Class performance overview with per-subject breakdown
  - `/admin/timetable` - All classes timetable viewer (Primary/Secondary)
  - `/admin/*` - Other admin management pages
  - `/teacher` - Teacher dashboard
  - `/teacher/marks` - Add/update student marks
  - `/teacher/attendance` - Daily attendance register
  - `/teacher/performance` - Subject performance analytics
  - `/teacher/homework` - Homework creation and management
  - `/teacher/messages` - Parent-teacher messaging interface
  - `/student` - Student dashboard
  - `/student/*` - Student pages
  - `/parent` - Parent dashboard
  - `/parent/homework` - View and download children's homework
  - `/parent/chat` - Parent-teacher messaging interface
  - `/parent/*` - Parent pages

### Project Structure
The frontend follows a component-based architecture with pages organized by user role (`/admin`, `/auth`, `/parent`, `/student`, `/teacher`). Reusable UI components are stored in `/components`, and API interactions are centralized in `/services/apiService.jsx`.

### UI/UX Decisions
The system provides tailored user experiences for four distinct roles:
1.  **Admin:** Full system management access.
2.  **Teacher:** Marks entry, attendance tracking, subject performance analytics, and class management.
3.  **Student:** Access to grades, timetable, fees, and assignments.
4.  **Parent:** View children's academic records, weekly messages, and fee information with multi-child support and a secure admin-approved parent-child linking process.

Key features include:
-   **Student Portal:** Dashboard with overview statistics, submission deadlines, marks, school calendar, timetable, teacher directory, and announcements.
-   **Parent Portal:** Dashboard with child selector, child management (browse/request/view), academic performance, homework viewer, weekly teacher messages, fee tracking with a demo payment interface, and direct parent-teacher messaging system with teacher search functionality. Complete sidebar with links to Dashboard, My Children, Performance, Homework, Weekly Messages, School Fees, and Chat with Teachers.
-   **Parent Homework View:** Parents can view all homework assigned to their confirmed children's classes, with:
    - Subject-based titles (e.g., "Maths Homework")
    - Due date status indicators (Past Due, Due Today, Due in X days)
    - Expandable homework descriptions
    - File download capability for attached PDF/Word documents
    - Display of which children the homework applies to
-   **Teacher Portal:** Dashboard with navigation to marks entry, attendance register, subject performance analytics, and parent messaging. Teachers can add/update student marks, mark daily attendance (Present/Absent/Late/Excused), view subject statistics including averages, pass rates, top performers, and exam type breakdowns, and communicate with parents through a two-way messaging system.
-   **Parent-Teacher Messaging:** Bidirectional communication platform where both parents and teachers can initiate conversations. Parents can search for and message teachers, teachers can search for and message parents. Both roles can view conversation history, manage existing conversations, and see read/unread status with subject lines for organized communication.
-   **Parent Self-Registration:** Secure self-service registration for parents with automatic role assignment and cryptographically secure password generation.
-   **Authentication Pages:** All auth pages (Login, AdminLogin, ParentRegister) include back buttons to home page. Login uses "Student Number/Email" label for clarity.

### Technical Implementations
-   API communication uses JWT Bearer tokens for authentication, stored in localStorage, with an API service layer handling automatic token injection.
-   Frontend expects a backend API running on `localhost:8000`, with API calls proxied through the `/api` endpoint.
-   HMR WebSocket is configured for the Replit environment.
-   Database models include `ParentChildLink`, `WeeklyMessage`, `SchoolEvent`, `Assignment`, `Attendance`, `ParentTeacherMessage`, and `Homework` to support core functionalities.
-   Role-based permissions are enforced across all API endpoints.
-   Parent-Teacher messaging system uses a dedicated `ParentTeacherMessage` model tracking sender, recipient, message content, subject, timestamps, and read status.

### Parent-Child Linking Security Model
-   **Two-Step Flow:** Parents must first select a school, then search for their child within that school:
    1. Step 1: Search for school by name or code
    2. Step 2: Search for child by student number OR full name within selected school
-   **Privacy-Focused Search:** Parents cannot browse all students. Instead, they must search by:
    - Student number (minimum 3 characters), OR
    - Both first name AND last name (minimum 2 characters each)
    - Search requires `school_id` parameter for tenant isolation
    - Search returns maximum 10 results to prevent enumeration
-   **Parent Request Flow:** After searching, parents can request to link with their child. This creates an unconfirmed `ParentChildLink` record.
-   **Admin Approval Required:** Only administrators can approve parent-child link requests via the `/admin/parent-requests` page. Parents cannot self-approve for security.
-   **Confirmed Access Only:** Parents can only access student data (grades, fees, messages) for confirmed children.
-   **API Endpoints:**
    - `GET /api/auth/schools/search/?q=<query>` - Search schools by name/code (public)
    - `GET /api/parents/students/search/?student_number=X&school_id=Y` - Search by student number (parent-only)
    - `GET /api/parents/students/search/?first_name=X&last_name=Y&school_id=Z` - Search by name (parent-only)
    - `POST /api/parents/children/request/` - Request child link (parent-only)
    - `POST /api/parents/children/<id>/confirm/` - Approve link request (admin-only)
-   **Security Note:** This privacy-focused design (school selection + search-only + admin approval) protects student data and prevents unauthorized cross-tenant access.

### Admin Extras Page
The `/admin/extras` page provides additional administrative tools:
-   **Timetable Generation:** Uses CSP (Constraint Satisfaction Problem) algorithm with backtracking and MRV (Minimum Remaining Values) heuristic to auto-generate conflict-free timetables. Prevents teacher, class, and room double-booking.
-   **School Fees Management:** Admins can set tuition and fees (tuition, levy, sports, computer, other) for each grade/form per academic year and term. Supports USD, ZWL, and ZAR currencies.
-   **API Endpoints:**
    - `GET /api/academics/timetables/stats/` - Get timetable coverage statistics
    - `POST /api/academics/timetables/generate/` - Generate timetables for all classes
    - `GET /api/finances/school-fees/` - List all school fees (admin)
    - `POST /api/finances/school-fees/` - Create school fees (admin-only)
    - `PUT /api/finances/school-fees/<id>/` - Update school fees (admin-only)
    - `DELETE /api/finances/school-fees/<id>/` - Delete school fees (admin-only)
    - `GET /api/finances/school-fees/my-fees/` - Get fees for student or parent's children
    - `GET /api/finances/grades/` - Get all grades for dropdown (admin-only)

### Teacher Platform Features
-   **Marks Entry:** Teachers can add and update student marks for subjects they teach, with support for different exam types (test, quiz, assignment, midterm, final exam). Student list is intelligently filtered to show only: (1) students who have existing marks for that subject with the teacher, or (2) students in classes taught by that teacher.
-   **Attendance Register:** Daily attendance tracking with four status options (Present, Absent, Late, Excused).
-   **Subject Performance Analytics:** View comprehensive statistics including class average, pass rate (≥50%), top 5 performers, and exam type breakdowns.
-   **Parent-Teacher Messaging:** Two-way communication system allowing teachers to both view/reply to messages from parents AND initiate new conversations with parents. Teachers can toggle between viewing existing conversations and searching for parents to start new conversations. Messages are organized by conversation with message history.
-   **Homework Management:** Teachers can create homework assignments by:
    - Selecting subject and class for the homework
    - Adding a title (displayed as "{Subject} Homework - {title}")
    - Setting a due date
    - Either typing homework description OR uploading PDF/Word documents (max 10MB)
    - View, download, and delete their created homework
-   **Navigation:** Complete sidebar with links to Dashboard, Add Marks, Attendance, Performance, Homework, and Messages.
-   **API Endpoints:**
    - `GET /api/teachers/subjects/` - List subjects taught by teacher
    - `GET /api/teachers/subjects/<id>/students/` - List students for a subject (filtered by class or existing results)
    - `POST /api/teachers/subjects/<id>/marks/` - Add student marks
    - `GET /api/teachers/subjects/<id>/performance/` - View subject analytics
    - `GET /api/teachers/attendance/` - Get attendance register for a date
    - `POST /api/teachers/attendance/` - Mark student attendance
    - `GET /api/messages/` - Get all messages for teacher
    - `GET /api/messages/conversation/<user_id>/` - Get conversation with specific parent
    - `POST /api/messages/send/` - Send message to parent
    - `GET /api/parents/search/` - Search for parents to initiate conversation (teacher-only)
    - `GET /api/students/<id>/parents/` - Get parents for a specific student

## External Dependencies

-   **Backend API:** A Django-based API running on `localhost:8000` is required for all data operations and authentication.
-   **PostgreSQL:** Used as the database for the Django backend (via Replit database).
-   **Tailwind CSS CDN:** Currently used for styling (future plan to integrate as a PostCSS plugin).