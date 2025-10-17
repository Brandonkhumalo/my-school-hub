# School Management System - Frontend

## Overview
This is a React-based School Management System frontend built with Vite. The application provides different dashboards and functionality for administrators, teachers, students, and parents.

**Current Status:** Frontend configured and running successfully on Replit ✓
**Last Updated:** October 17, 2025

### Import Setup Completed
- ✓ Dependencies installed via npm
- ✓ Vite server configured for Replit (port 5000, host 0.0.0.0)
- ✓ Allowed hosts configured for Replit proxy
- ✓ HMR WebSocket configured for Replit environment
- ✓ Workflow configured and running
- ✓ Deployment configuration set up (autoscale)
- ✓ Frontend accessible and functional

## Project Architecture

### Technology Stack
- **Framework:** React 19.1.1
- **Build Tool:** Vite 7.1.7
- **Routing:** React Router DOM 7.9.1
- **Styling:** Tailwind CSS (loaded via CDN)
- **Package Manager:** npm

### Project Structure
```
/src
  /assets          - Static assets (images, icons)
  /components      - Reusable UI components
  /context         - React context providers (AuthContext)
  /pages           - Page components organized by user role
    /admin         - Admin dashboard and management pages
    /auth          - Login/Logout pages
    /parent        - Parent dashboard and views
    /student       - Student dashboard and views
    /teacher       - Teacher dashboard and views
    /profile       - User profile pages
    /notfound      - 404 and error pages
  /services        - API service layer (apiService.jsx)
  App.jsx          - Main app component with routing
  main.jsx         - Application entry point
  index.css        - Global styles
```

### Backend Integration
- The frontend expects a backend API running on `localhost:8000`
- API calls are proxied through `/api` endpoint
- Authentication uses JWT Bearer tokens stored in localStorage
- API service handles all HTTP requests with automatic token injection

### User Roles
The system supports four user roles:
1. **Admin** - Full system management access
2. **Teacher** - Class and student management
3. **Student** - View grades, timetable, fees
4. **Parent** - View children's academic records

## Configuration

### Vite Configuration (vite.config.js)
- **Host:** 0.0.0.0 (allows Replit proxy access)
- **Port:** 5000 (frontend server)
- **HMR:** Configured for Replit WebSocket proxy
- **API Proxy:** `/api` → `http://localhost:8000`

### Workflow
- **Name:** Server
- **Command:** `npm run dev`
- **Port:** 5000
- **Output:** Webview (frontend preview)

## Development

### Running the Application
The frontend is configured to run automatically via Replit workflow:
```bash
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Dependencies Installation
```bash
npm install
```

## Backend Requirements

**Important:** This frontend requires a backend API to function properly. The backend should:
- Run on `localhost:8000`
- Provide authentication endpoints at `/api/auth/`
- Provide academic management endpoints at `/api/academics/`
- Provide financial management endpoints at `/api/finances/`
- Support JWT authentication

Without the backend running, the login and data fetching will fail.

## Known Issues & Notes

1. **Tailwind CSS:** Currently loaded via CDN (not recommended for production)
   - Should be installed as PostCSS plugin for production deployment
   
2. **Backend Dependency:** Frontend is fully dependent on backend API
   - All pages except login will show loading/error states without backend

3. **HMR Configuration:** WebSocket connection configured for Replit proxy environment

## Recent Updates (October 17, 2025)

### Student Portal Implementation ✓
A comprehensive student portal has been implemented with the following features:

**Student Dashboard:**
- Overview statistics (overall average, total subjects, pending submissions, attendance)
- Quick links to all student pages
- Upcoming submissions preview
- Recent announcements
- Academic performance summary

**Student Pages:**
1. **Profile** (`/student/profile`) - Student information display
   - Name, surname, class, phone number, parent ID, student number
   
2. **Submissions** (`/student/submissions`) - Assignment deadlines
   - View all upcoming submission deadlines
   - Subject name and due dates
   - Visual indicators for urgency (overdue, due soon)
   
3. **Marks** (`/student/marks`) - Academic performance
   - Test scores, assignment scores
   - Overall term percentage per subject
   - Overall year percentage per subject
   - Recent assessment history
   
4. **School Calendar** (`/student/calendar`) - Events and holidays
   - School activities, holidays, exams
   - Event types and descriptions
   
5. **Timetable** (`/student/timetable`) - Weekly schedule
   - Time slots (7am-8am format)
   - Shows week start date from backend
   - Subject, teacher, and room information
   
6. **Teachers** (`/student/teachers`) - Student's teachers
   - All teachers who teach the student
   - Subject, contact information, office location
   
7. **Announcements** (`/student/announcements`) - School notices
   - School-wide announcements
   - Priority levels (urgent, high, normal)
   - Author and date information

**New API Endpoints:**
All student endpoints are documented in `BACKEND_API_DOCUMENTATION.md`
- `/api/students/profile/` - Student profile
- `/api/students/dashboard/stats/` - Dashboard statistics
- `/api/students/submissions/` - Upcoming submissions
- `/api/students/marks/` - Grades and performance
- `/api/students/calendar/` - School events
- `/api/students/timetable/` - Weekly timetable
- `/api/students/teachers/` - Student's teachers
- `/api/students/announcements/` - School announcements

### Parent Portal Implementation ✓
A comprehensive parent portal has been implemented with child linking and monitoring features:

**Parent Dashboard:**
- Child selector dropdown for parents with multiple children
- Overview statistics (overall average, total subjects, attendance, outstanding fees)
- Quick action cards for common tasks
- Recent weekly messages preview
- Parent-specific navigation links

**Parent Pages:**
1. **Dashboard** (`/parent`) - Overview with child selector
   - Statistics for selected child
   - Quick actions and recent messages
   - Child confirmation status indicators
   
2. **My Children** (`/parent/children`) - Child management
   - View confirmed children
   - Link and confirm new children (admin-initiated)
   - Two-step verification: Admin links, Parent confirms
   
3. **Performance** (`/parent/performance`) - Academic results
   - View child's marks and grades
   - Test scores, assignment scores
   - Term and year percentages per subject
   - Recent assessment history
   
4. **Weekly Messages** (`/parent/messages`) - Teacher feedback
   - Weekly progress reports from teachers (sent every Friday)
   - Performance ratings (1-5 stars)
   - Areas of improvement highlighted
   - Student strengths recognition
   - Subject-specific feedback
   
5. **School Fees** (`/parent/fees`) - Fee management
   - Total fees, paid amount, outstanding balance
   - Fee breakdown by type and status
   - Payment history
   - Demo payment interface (proof of concept)

**New API Endpoints:**
All parent endpoints are documented in `BACKEND_API_DOCUMENTATION.md`
- `/api/parents/children/` - Parent's children list
- `/api/parents/children/available/` - Unconfirmed children
- `/api/parents/children/{id}/confirm/` - Confirm child
- `/api/parents/children/{id}/stats/` - Child dashboard stats
- `/api/parents/children/{id}/performance/` - Child performance
- `/api/parents/children/{id}/messages/` - Weekly teacher messages
- `/api/parents/messages/` - All messages (all children)
- `/api/parents/children/{id}/fees/` - Child fee information

**Key Features:**
- **Parent-Child Linking:** Two-step process (admin links, parent confirms)
- **Weekly Messages:** Teachers send Friday updates with ratings and feedback
- **Multi-Child Support:** Parents can manage multiple children from one account
- **Fee Tracking:** Complete fee breakdown with payment history
- **Demo Payment:** Placeholder for payment gateway integration

## Future Improvements

- Install Tailwind CSS properly (PostCSS plugin)
- Add loading states and error boundaries
- Implement offline support
- Add unit and integration tests
- Set up proper environment variable management
- Implement teacher portal
- Integrate payment gateway for school fees (Stripe, PayPal, etc.)
- Add push notifications for weekly messages
