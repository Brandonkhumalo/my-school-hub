# Backend API Documentation for School Management System

## Overview
This document outlines all the expected API endpoints and response formats for the School Management System. All endpoints should be accessible at `http://localhost:8000/api` and will be proxied through the frontend.

## Authentication
All student and parent endpoints require JWT Bearer token authentication.
- Token should be sent in the `Authorization` header: `Bearer <token>`
- Token is stored in localStorage after login

---

## Student API Endpoints

### 1. Student Profile
**Endpoint:** `GET /api/students/profile/`

**Description:** Returns the logged-in student's profile information

**Response Format:**
```json
{
  "id": 1,
  "name": "John",
  "surname": "Doe",
  "class": "Form 2B",
  "phone_number": "+1234567890",
  "parent_id": "P001",
  "student_number": "STU2024001"
}
```

**Fields:**
- `id` (integer): Student's unique ID
- `name` (string): Student's first name
- `surname` (string): Student's last name
- `class` (string): Student's class (e.g., "Form 2B")
- `phone_number` (string): Student's contact number
- `parent_id` (string): Parent/Guardian ID reference
- `student_number` (string): Unique student identification number

---

### 2. Student Dashboard Statistics
**Endpoint:** `GET /api/students/dashboard/stats/`

**Description:** Returns dashboard statistics for the student

**Response Format:**
```json
{
  "overall_average": 75.5,
  "total_subjects": 8,
  "pending_submissions": 3,
  "attendance_percentage": 92.5
}
```

**Fields:**
- `overall_average` (float): Student's overall grade average percentage
- `total_subjects` (integer): Number of subjects the student is enrolled in
- `pending_submissions` (integer): Count of upcoming/pending assignments
- `attendance_percentage` (float): Student's attendance rate

---

### 3. Student Submissions
**Endpoint:** `GET /api/students/submissions/`

**Description:** Returns all upcoming submission deadlines for the student

**Response Format:**
```json
[
  {
    "id": 1,
    "title": "Math Assignment Chapter 5",
    "description": "Complete exercises 1-20 from Chapter 5",
    "subject_name": "Mathematics",
    "deadline": "2025-10-25T23:59:59Z",
    "status": "pending"
  },
  {
    "id": 2,
    "title": "English Essay - Shakespeare",
    "description": "Write a 500-word essay on Macbeth",
    "subject_name": "English",
    "deadline": "2025-10-28T23:59:59Z",
    "status": "pending"
  }
]
```

**Fields per submission:**
- `id` (integer): Submission unique ID
- `title` (string): Assignment title
- `description` (string): Assignment description/instructions
- `subject_name` (string): Name of the subject
- `deadline` (string): ISO 8601 datetime format for due date
- `status` (string): "pending" | "submitted" | "overdue"

---

### 4. Student Marks/Grades
**Endpoint:** `GET /api/students/marks/`

**Description:** Returns all subject grades and performance data

**Response Format:**
```json
[
  {
    "subject_id": 1,
    "subject_name": "Mathematics",
    "test_score_percentage": 85.5,
    "assignment_score_percentage": 78.0,
    "overall_term_percentage": 82.5,
    "overall_year_percentage": 80.0,
    "recent_scores": [
      {
        "name": "Quiz 1",
        "percentage": 88.0,
        "date": "2025-10-15"
      },
      {
        "name": "Midterm Test",
        "percentage": 85.0,
        "date": "2025-10-10"
      }
    ]
  },
  {
    "subject_id": 2,
    "subject_name": "English",
    "test_score_percentage": 72.0,
    "assignment_score_percentage": 85.0,
    "overall_term_percentage": 78.5,
    "overall_year_percentage": 76.0,
    "recent_scores": []
  }
]
```

**Fields per subject:**
- `subject_id` (integer): Subject unique ID
- `subject_name` (string): Name of the subject
- `test_score_percentage` (float): Average test score percentage
- `assignment_score_percentage` (float): Average assignment score percentage
- `overall_term_percentage` (float): Overall term average percentage
- `overall_year_percentage` (float): Overall year average percentage
- `recent_scores` (array): List of recent assessments (optional)
  - `name` (string): Assessment name
  - `percentage` (float): Score percentage
  - `date` (string): Date of assessment (YYYY-MM-DD)

---

### 5. School Calendar
**Endpoint:** `GET /api/students/calendar/`

**Description:** Returns school events, activities, and holidays

**Response Format:**
```json
[
  {
    "id": 1,
    "title": "Mid-Term Break",
    "description": "School closed for mid-term break",
    "type": "holiday",
    "start_date": "2025-11-01",
    "end_date": "2025-11-05",
    "location": null
  },
  {
    "id": 2,
    "title": "Sports Day",
    "description": "Annual inter-house sports competition",
    "type": "activity",
    "start_date": "2025-11-15",
    "end_date": "2025-11-15",
    "location": "Main Field"
  },
  {
    "id": 3,
    "title": "Final Examinations",
    "description": "End of term examinations for all classes",
    "type": "exam",
    "start_date": "2025-12-01",
    "end_date": "2025-12-10",
    "location": "Examination Halls"
  }
]
```

**Fields per event:**
- `id` (integer): Event unique ID
- `title` (string): Event title
- `description` (string): Event description
- `type` (string): Event type - "holiday" | "activity" | "exam" | "event"
- `start_date` (string): Start date (YYYY-MM-DD)
- `end_date` (string): End date (YYYY-MM-DD) - can be same as start_date
- `location` (string|null): Event location (optional)

---

### 6. Student Timetable
**Endpoint:** `GET /api/students/timetable/`

**Description:** Returns the student's weekly timetable with the week start date

**Response Format:**
```json
{
  "week_start_date": "2025-10-20",
  "notes": "Updated timetable for Term 2",
  "schedule": {
    "7:00 AM - 8:00 AM": {
      "Monday": {
        "subject": "Mathematics",
        "teacher": "Mr. Smith",
        "room": "Room 101"
      },
      "Tuesday": {
        "subject": "English",
        "teacher": "Ms. Johnson",
        "room": "Room 205"
      },
      "Wednesday": {
        "subject": "Mathematics",
        "teacher": "Mr. Smith",
        "room": "Room 101"
      },
      "Thursday": {
        "subject": "Science",
        "teacher": "Dr. Brown",
        "room": "Lab 1"
      },
      "Friday": {
        "subject": "History",
        "teacher": "Mrs. Davis",
        "room": "Room 303"
      }
    },
    "8:00 AM - 9:00 AM": {
      "Monday": {
        "subject": "Science",
        "teacher": "Dr. Brown",
        "room": "Lab 1"
      },
      "Tuesday": {
        "subject": "Mathematics",
        "teacher": "Mr. Smith",
        "room": "Room 101"
      },
      "Wednesday": null,
      "Thursday": {
        "subject": "English",
        "teacher": "Ms. Johnson",
        "room": "Room 205"
      },
      "Friday": {
        "subject": "Physical Education",
        "teacher": "Coach Williams",
        "room": "Gymnasium"
      }
    }
  }
}
```

**Structure:**
- `week_start_date` (string): Monday's date for the timetable week (YYYY-MM-DD)
- `notes` (string|null): Optional notes about the timetable
- `schedule` (object): Time slots as keys, containing day objects
  - Time slot format: "HH:MM AM/PM - HH:MM AM/PM"
  - Day keys: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
  - Class object (or null if no class):
    - `subject` (string): Subject name
    - `teacher` (string): Teacher name
    - `room` (string): Room/location

---

### 7. Student Teachers
**Endpoint:** `GET /api/students/teachers/`

**Description:** Returns all teachers who teach the logged-in student

**Response Format:**
```json
[
  {
    "id": 1,
    "title": "Mr.",
    "surname": "Smith",
    "subject": "Mathematics",
    "email": "smith@school.edu",
    "phone": "+1234567890",
    "office": "Room 101"
  },
  {
    "id": 2,
    "title": "Ms.",
    "surname": "Johnson",
    "subject": "English",
    "email": "johnson@school.edu",
    "phone": "+1234567891",
    "office": "Room 205"
  },
  {
    "id": 3,
    "title": "Dr.",
    "surname": "Brown",
    "subject": "Science",
    "email": "brown@school.edu",
    "phone": "+1234567892",
    "office": "Lab 1"
  }
]
```

**Fields per teacher:**
- `id` (integer): Teacher unique ID
- `title` (string): Teacher's title (Mr., Ms., Dr., etc.)
- `surname` (string): Teacher's last name
- `subject` (string): Subject the teacher teaches to this student
- `email` (string|null): Teacher's email (optional)
- `phone` (string|null): Teacher's phone number (optional)
- `office` (string|null): Teacher's office location (optional)

---

### 8. Student Announcements
**Endpoint:** `GET /api/students/announcements/`

**Description:** Returns school announcements for students

**Response Format:**
```json
[
  {
    "id": 1,
    "title": "School Reopening Date",
    "message": "School will reopen on Monday, October 20th. All students are expected to be in proper uniform.",
    "author": "Principal Johnson",
    "date": "2025-10-15T10:30:00Z",
    "priority": "urgent",
    "attachments": []
  },
  {
    "id": 2,
    "title": "Library Hours Extended",
    "message": "The school library will now be open until 6 PM on weekdays to help students prepare for exams.",
    "author": "Librarian Ms. White",
    "date": "2025-10-14T09:00:00Z",
    "priority": "normal",
    "attachments": [
      {
        "name": "library_schedule.pdf",
        "url": "/media/announcements/library_schedule.pdf"
      }
    ]
  }
]
```

**Fields per announcement:**
- `id` (integer): Announcement unique ID
- `title` (string): Announcement title
- `message` (string): Announcement content/message
- `author` (string): Who made the announcement
- `date` (string): ISO 8601 datetime when announced
- `priority` (string): "urgent" | "high" | "normal" | "low"
- `attachments` (array): Optional file attachments
  - `name` (string): File name
  - `url` (string): File URL/path

---

## Parent API Endpoints

### 1. Parent's Children List
**Endpoint:** `GET /api/parents/children/`

**Description:** Returns all children linked to the parent (both confirmed and unconfirmed)

**Response Format:**
```json
[
  {
    "id": 1,
    "name": "John",
    "surname": "Doe",
    "class": "Form 2B",
    "student_number": "STU2024001",
    "is_confirmed": true
  },
  {
    "id": 2,
    "name": "Jane",
    "surname": "Doe",
    "class": "Form 1A",
    "student_number": "STU2024002",
    "is_confirmed": false
  }
]
```

**Fields per child:**
- `id` (integer): Child's unique ID
- `name` (string): Child's first name
- `surname` (string): Child's last name
- `class` (string): Child's class
- `student_number` (string): Student identification number
- `is_confirmed` (boolean): Whether parent has confirmed this is their child

---

### 2. Available Children to Confirm
**Endpoint:** `GET /api/parents/children/available/`

**Description:** Returns children that are linked to this parent but not yet confirmed

**Response Format:**
```json
[
  {
    "id": 2,
    "name": "Jane",
    "surname": "Doe",
    "class": "Form 1A",
    "student_number": "STU2024002"
  }
]
```

**Fields:** Same as children list, but only unconfirmed children

---

### 3. Confirm Child
**Endpoint:** `POST /api/parents/children/{child_id}/confirm/`

**Description:** Confirms that a child belongs to the parent

**Request:** No body required

**Response Format:**
```json
{
  "id": 2,
  "name": "Jane",
  "surname": "Doe",
  "class": "Form 1A",
  "student_number": "STU2024002",
  "is_confirmed": true
}
```

---

### 4. Child Dashboard Statistics
**Endpoint:** `GET /api/parents/children/{child_id}/stats/`

**Description:** Returns dashboard statistics for a specific child

**Response Format:**
```json
{
  "overall_average": 78.5,
  "total_subjects": 7,
  "attendance_percentage": 94.0,
  "outstanding_fees": 150.00
}
```

**Fields:**
- `overall_average` (float): Child's overall grade average
- `total_subjects` (integer): Number of subjects child is enrolled in
- `attendance_percentage` (float): Child's attendance rate
- `outstanding_fees` (float): Amount of unpaid school fees

---

### 5. Child Performance/Marks
**Endpoint:** `GET /api/parents/children/{child_id}/performance/`

**Description:** Returns academic performance data for a specific child

**Response Format:**
```json
[
  {
    "subject_id": 1,
    "subject_name": "Mathematics",
    "test_score_percentage": 85.5,
    "assignment_score_percentage": 78.0,
    "overall_term_percentage": 82.5,
    "overall_year_percentage": 80.0,
    "recent_scores": [
      {
        "name": "Quiz 1",
        "percentage": 88.0,
        "date": "2025-10-15"
      }
    ]
  }
]
```

**Note:** Same format as student marks endpoint

---

### 6. Weekly Messages from Teachers
**Endpoint:** `GET /api/parents/children/{child_id}/messages/`

**Alternative:** `GET /api/parents/messages/` (for all children)

**Description:** Returns weekly progress messages from teachers about the child

**Response Format:**
```json
[
  {
    "id": 1,
    "subject": "Mathematics",
    "teacher": "Mr. Smith",
    "message": "John has shown excellent improvement in algebra this week. He actively participates in class and completes all homework on time. Keep up the good work!",
    "date": "2025-10-17",
    "week_number": 7,
    "performance_rating": 4,
    "areas_of_improvement": [
      "Needs more practice with geometry problems"
    ],
    "strengths": [
      "Excellent algebra skills",
      "Active class participation"
    ]
  },
  {
    "id": 2,
    "subject": "English",
    "teacher": "Ms. Johnson",
    "message": "John's reading comprehension has improved significantly. He contributed well to our Shakespeare discussion this week.",
    "date": "2025-10-17",
    "week_number": 7,
    "performance_rating": 5,
    "areas_of_improvement": [],
    "strengths": [
      "Excellent reading skills",
      "Good analytical thinking"
    ]
  }
]
```

**Fields per message:**
- `id` (integer): Message unique ID
- `subject` (string): Subject/course name
- `teacher` (string): Teacher's name
- `message` (string): Teacher's feedback message
- `date` (string): Date message was sent (YYYY-MM-DD format, typically Friday)
- `week_number` (integer): School week number
- `performance_rating` (integer|null): Rating from 1-5 (optional)
- `areas_of_improvement` (array): List of areas needing improvement (optional)
- `strengths` (array): List of child's strengths (optional)

---

### 7. Child School Fees
**Endpoint:** `GET /api/parents/children/{child_id}/fees/`

**Description:** Returns fee information and payment status for a specific child

**Response Format:**
```json
{
  "total_fees": 5000.00,
  "total_paid": 3500.00,
  "outstanding": 1500.00,
  "fees": [
    {
      "id": 1,
      "type": "Tuition Fee - Term 1",
      "amount": 3000.00,
      "due_date": "2025-01-15",
      "status": "paid"
    },
    {
      "id": 2,
      "type": "Activity Fee",
      "amount": 500.00,
      "due_date": "2025-02-01",
      "status": "paid"
    },
    {
      "id": 3,
      "type": "Tuition Fee - Term 2",
      "amount": 3000.00,
      "due_date": "2025-04-15",
      "status": "pending"
    },
    {
      "id": 4,
      "type": "Library Fee",
      "amount": 200.00,
      "due_date": "2025-03-01",
      "status": "overdue"
    }
  ],
  "payment_history": [
    {
      "id": 1,
      "description": "Tuition Fee - Term 1",
      "amount": 3000.00,
      "date": "2025-01-10"
    },
    {
      "id": 2,
      "description": "Activity Fee",
      "amount": 500.00,
      "date": "2025-01-20"
    }
  ]
}
```

**Fields:**
- `total_fees` (float): Total fees for the year
- `total_paid` (float): Amount already paid
- `outstanding` (float): Amount still owed
- `fees` (array): List of fee items
  - `id` (integer): Fee item ID
  - `type` (string): Fee description/type
  - `amount` (float): Fee amount
  - `due_date` (string): Payment due date (YYYY-MM-DD)
  - `status` (string): "paid" | "pending" | "overdue"
- `payment_history` (array): List of completed payments
  - `id` (integer): Payment ID
  - `description` (string): Payment description
  - `amount` (float): Amount paid
  - `date` (string): Payment date (YYYY-MM-DD)

---

## API Base Configuration

### Base URL
```
http://localhost:8000/api
```

### Frontend Proxy Configuration
The Vite frontend is configured to proxy `/api` requests to `http://localhost:8000`:

```javascript
// vite.config.js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    secure: false
  }
}
```

### Authentication Flow
1. User logs in at `/api/auth/login/` with credentials
2. Backend returns JWT token
3. Frontend stores token in localStorage
4. All subsequent requests include: `Authorization: Bearer <token>`
5. Backend validates token and returns user-specific data

---

## Error Responses

All endpoints should return appropriate HTTP status codes and error messages:

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
```json
{
  "detail": "An error occurred while processing your request."
}
```

---

## Notes for Backend Implementation

1. **Authentication**: All `/api/students/*` and `/api/parents/*` endpoints require authenticated users
2. **Permissions**: 
   - Students can only access their own data
   - Parents can only access data for their confirmed children
   - Parent-child linking must be initiated by admin, then confirmed by parent
3. **Date Formats**: Use ISO 8601 format for all datetime fields
4. **CORS**: Configure CORS to allow requests from the frontend
5. **Pagination**: If implementing pagination, wrap results in:
   ```json
   {
     "results": [...],
     "count": 100,
     "next": "url",
     "previous": "url"
   }
   ```
   The frontend will automatically extract the `results` array.
6. **Weekly Messages**: 
   - Teachers send weekly messages every Friday
   - Messages include feedback, performance rating, and areas for improvement
   - Parents can view messages for their confirmed children only

---

## Quick Reference - All Endpoints

### Student Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/students/profile/` | GET | Student profile information |
| `/api/students/dashboard/stats/` | GET | Dashboard statistics |
| `/api/students/submissions/` | GET | Upcoming submissions/assignments |
| `/api/students/marks/` | GET | Grades and performance data |
| `/api/students/calendar/` | GET | School events and holidays |
| `/api/students/timetable/` | GET | Weekly class timetable |
| `/api/students/teachers/` | GET | Student's teachers list |
| `/api/students/announcements/` | GET | School announcements |

### Parent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parents/children/` | GET | List of parent's children |
| `/api/parents/children/available/` | GET | Unconfirmed children to link |
| `/api/parents/children/{child_id}/confirm/` | POST | Confirm a child |
| `/api/parents/children/{child_id}/stats/` | GET | Child's dashboard statistics |
| `/api/parents/children/{child_id}/performance/` | GET | Child's academic performance |
| `/api/parents/children/{child_id}/messages/` | GET | Weekly teacher messages |
| `/api/parents/messages/` | GET | All weekly messages (all children) |
| `/api/parents/children/{child_id}/fees/` | GET | Child's fee information |

---

## Testing the API

You can test these endpoints using tools like:
- **Postman** or **Insomnia** for API testing
- **curl** for command-line testing
- **Django REST Framework's browsable API** (if using DRF)

Example curl request:
```bash
curl -H "Authorization: Bearer <your-token>" \
     http://localhost:8000/api/students/profile/
```
