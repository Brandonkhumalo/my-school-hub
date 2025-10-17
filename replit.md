# School Management System - Frontend

## Overview
This project is a React-based School Management System frontend, built with Vite, offering distinct dashboards and functionalities for administrators, teachers, students, and parents. Its primary purpose is to provide a comprehensive and intuitive platform for managing various aspects of school operations and communication. The system aims to streamline administrative tasks, enhance teacher-parent-student interaction, and provide students with access to their academic information.

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
  - `/` - Landing page with hero section and features
  - `/login` - Login page for students, parents, and teachers
  - `/admin/login` - Dedicated admin login page
  - `/register/parent` - Parent self-registration
  - `/logout` - Logout handler

- **Protected Routes (requires authentication):**
  - `/admin` - Admin dashboard
  - `/admin/*` - Admin management pages
  - `/teacher` - Teacher dashboard
  - `/student` - Student dashboard
  - `/student/*` - Student pages
  - `/parent` - Parent dashboard
  - `/parent/*` - Parent pages

### Project Structure
The frontend follows a component-based architecture with pages organized by user role (`/admin`, `/auth`, `/parent`, `/student`, `/teacher`). Reusable UI components are stored in `/components`, and API interactions are centralized in `/services/apiService.jsx`.

### UI/UX Decisions
The system provides tailored user experiences for four distinct roles:
1.  **Admin:** Full system management access.
2.  **Teacher:** Class and student management.
3.  **Student:** Access to grades, timetable, fees, and assignments.
4.  **Parent:** View children's academic records, weekly messages, and fee information with multi-child support and a two-step parent-child linking process.

Key features include:
-   **Student Portal:** Dashboard with overview statistics, submission deadlines, marks, school calendar, timetable, teacher directory, and announcements.
-   **Parent Portal:** Dashboard with child selector, child management (linking/confirmation), academic performance, weekly teacher messages, and fee tracking with a demo payment interface.
-   **Parent Self-Registration:** Secure self-service registration for parents with automatic role assignment and cryptographically secure password generation.

### Technical Implementations
-   API communication uses JWT Bearer tokens for authentication, stored in localStorage, with an API service layer handling automatic token injection.
-   Frontend expects a backend API running on `localhost:8000`, with API calls proxied through the `/api` endpoint.
-   HMR WebSocket is configured for the Replit environment.
-   Database models include `ParentChildLink`, `WeeklyMessage`, `SchoolEvent`, `Assignment`, and `Attendance` to support core functionalities.
-   Role-based permissions are enforced across all API endpoints.

## External Dependencies

-   **Backend API:** A Django-based API running on `localhost:8000` is required for all data operations and authentication.
-   **PostgreSQL:** Used as the database for the Django backend (via Replit database).
-   **Tailwind CSS CDN:** Currently used for styling (future plan to integrate as a PostCSS plugin).