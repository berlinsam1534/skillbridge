# SkillBridge

A full-stack platform combining **job listings**, **internships**, and **course learning** — built as a companion to the Inkwell comic reader, reusing its visual language (Anton/Work Sans fonts, dark ink theme, red/yellow accents, bottom nav, card grids, chips, and social/review blocks).

## Stack
- **Backend:** Node.js + Express + SQLite (`better-sqlite3`), JWT auth, bcrypt password hashing
- **Frontend:** Single-page vanilla JS app (no build step), served as static files by Express

## Features
- **Auth** — register/login with three roles: `seeker`, `employer`, `instructor`
- **Jobs & Internships** — post, browse, search, filter by category/type, apply, track application status (submitted → reviewed → shortlisted → hired/rejected)
- **Courses** — create with multiple lessons, browse/search/filter, enroll, mark lessons complete with a progress bar, rate & review (with average rating)
- **Dashboard** — role-specific "You" tab: seekers see their applications and enrollments, employers see their listings and applicants, instructors see their courses
- **Favorites** — save jobs/courses for later
- **Dark/light theme toggle**

## Setup
```bash
npm install
npm start
```
Then open **http://localhost:3000**.

The SQLite database file (`skillbridge.db`) is created automatically on first run in the project root — no separate database server needed.

## Project structure
```
server.js            Express app entry point
db.js                 SQLite schema + connection
middleware/auth.js    JWT sign/verify middleware
routes/auth.js        register / login / me
routes/jobs.js         jobs + internships + applications
routes/courses.js     courses + lessons + enrollment + reviews
routes/dashboard.js   per-role dashboard aggregation + favorites
public/index.html     app shell + styles
public/app.js         all frontend logic (SPA, no framework)
```

## Notes / next steps
- Passwords are hashed with bcrypt; JWTs are signed with a dev secret in `middleware/auth.js` — set a real `JWT_SECRET` environment variable in production.
- File uploads (resumes, course cover images) currently take **URLs** rather than binary uploads — wire up a storage provider (S3, Cloudinary, etc.) if you want real file uploads.
- The three roles are fixed per account. A more advanced version could let one user hold multiple roles.
