# MySchoolHub Hosting Guide

This guide explains how to set up and run the MySchoolHub School Management System when hosting it on your own server.

---

## Prerequisites

Before hosting, ensure you have:
- Python 3.11 or higher
- Node.js 20 or higher
- PostgreSQL database
- A server with at least 1GB RAM

---

## Step 1: Clone the Project

```bash
git clone <your-repository-url>
cd myschoolhub
```

---

## Step 2: Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name

# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com
```

---

## Step 3: Set Up the Backend (Django)

### 3.1 Navigate to the Django project
```bash
cd School_system
```

### 3.2 Create a virtual environment (optional but recommended)
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3.3 Install Python dependencies
```bash
pip install -r requirements.txt
```

### 3.4 Run database migrations
```bash
python manage.py migrate
```

### 3.5 Create a superuser (admin account)
```bash
python manage.py createsuperuser
```

### 3.6 Collect static files (for production)
```bash
python manage.py collectstatic --noinput
```

### 3.7 Start the backend server

**For Development:**
```bash
python manage.py runserver 0.0.0.0:8000
```

**For Production (using Gunicorn):**
```bash
pip install gunicorn
gunicorn --bind 0.0.0.0:8000 --workers 4 School_system.wsgi:application
```

---

## Step 4: Set Up the Frontend (React + Vite)

### 4.1 Navigate to the frontend directory (from project root)
```bash
cd ..  # If you're still in School_system
```

### 4.2 Install Node.js dependencies
```bash
npm install
```

### 4.3 Configure the API URL

Edit `vite.config.js` to point to your backend URL:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',  // Or your backend URL
      changeOrigin: true,
    }
  }
}
```

### 4.4 Build for production
```bash
npm run build
```

### 4.5 Start the frontend server

**For Development:**
```bash
npm run dev -- --host 0.0.0.0 --port 5000
```

**For Production:**
Serve the `dist` folder using a static file server like Nginx, or use:
```bash
npm run preview -- --host 0.0.0.0 --port 5000
```

---

## Step 5: Running Both Servers

You need to run both the backend and frontend simultaneously.

### Option A: Using separate terminals

**Terminal 1 (Backend):**
```bash
cd School_system
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 (Frontend):**
```bash
npm run dev -- --host 0.0.0.0 --port 5000
```

### Option B: Using a process manager (PM2)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './School_system',
      script: 'gunicorn',
      args: '--bind 0.0.0.0:8000 --workers 4 School_system.wsgi:application',
      interpreter: 'python'
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5000'
    }
  ]
};
```

Start both:
```bash
pm2 start ecosystem.config.js
```

---

## Step 6: Configure Nginx (Production)

For production, use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location /static/ {
        alias /path/to/your/project/School_system/staticfiles/;
    }
}
```

---

## Default Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 5000 | React application (user interface) |
| Backend  | 8000 | Django API server |

---

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Verify DATABASE_URL is correct
- Run `python manage.py check` for configuration errors

### Frontend can't connect to backend
- Ensure backend is running on port 8000
- Check CORS settings in Django
- Verify the proxy configuration in vite.config.js

### Database migration errors
- Run `python manage.py makemigrations` first
- Then run `python manage.py migrate`

### Static files not loading
- Run `python manage.py collectstatic`
- Check Nginx static file configuration

---

## Quick Start Commands

```bash
# Backend (in School_system folder)
python manage.py runserver 0.0.0.0:8000

# Frontend (in root folder)
npm run dev
```

---

## Support

For issues or questions, contact:
- Developer: Tishanyq Digital
- Website: tishanyq.co.zw
