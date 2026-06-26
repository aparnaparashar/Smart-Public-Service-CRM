# PS-CRM Backend (Node.js / Express / MongoDB)

REST API for Smart Public Service CRM.

## Tech stack

- Node.js + Express
- MongoDB + Mongoose
- JWT auth + role-based middleware
- Nodemailer for email notifications
- AI support for complaint classification (Groq primary, Gemini fallback)
- WhatsApp bot bootstrap (Baileys)

## Quickstart

### Setup

```bash
cd ps-crm-backend
npm install
```

### Environment variables

Create `ps-crm-backend/.env`.

Minimum required:
- `MONGO_URI`
- `PORT` (optional, defaults to `5000`)

AI:
- `GEMINI_API_KEY`

Email:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`

Auth / JWT:
- `JWT_SECRET` (or the secret name used inside your auth middleware)

> WhatsApp bot may also require additional env values depending on `src/config/whatsappBot.js`.

### Run

Development (with nodemon):

```bash
npm run dev
```

Production:

```bash
npm start
```

Backend base:
- `http://localhost:5000`

Health:
- `GET /api/health`
- `GET /`

## API reference

All routes are mounted under `/api` in `server.js`.

### Auth

- `POST /api/auth/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp-and-register`
- `POST /api/auth/resend-otp`
- Officer/admin endpoints:
  - `GET /api/auth/officers`
  - `GET /api/auth/officers/pending`
  - `PUT /api/auth/officers/:id/approve`
  - `PUT /api/auth/officers/:id/reject`
  - `PUT /api/auth/assign-role`
  - `PUT /api/auth/profile/:userId`

### Complaints

- `POST /api/complaints` — submit complaint (citizen)
- `POST /api/complaints/classify` — AI classification helper (public)
- `GET /api/complaints/my` — your complaints (auth required)
- `GET /api/complaints/assigned` — assigned to officer (auth required)
- `GET /api/complaints/track/:complaintNumber` — public track by `CMP-...`
- `GET /api/complaints` — all complaints (admin)
- `GET /api/complaints/:id` — by MongoDB `_id`
- `PUT /api/complaints/:id` — update status/resolution (officer/admin)

### Dashboard

- `GET /api/dashboard/*` — aggregate statistics for UI (auth may be required depending on route)

### Heatmap

- `GET /api/heatmap/*` — aggregated locality/ward distribution for heatmap UI

### Chatbot

- `POST /api/chatbot/chat`
- `POST /api/chatbot/reset`

## Notable backend behaviors

- **Complaint deduplication**: combines ward/category fingerprint + semantic similarity embeddings.
- **SLA deadlines**: computed based on urgency.
- **Email notifications**: complaint confirmation + status updates to all filers.
- **AI classification**:
  - Groq primary (`llama-3.3-70b-versatile`)
  - Gemini fallback (`gemini-2.0-flash`)

## Project structure

- `server.js` — express app + route mounts + server bootstrap
- `src/config/` — DB, SLA, email, WhatsApp bot, OTP
- `src/controllers/` — business logic
- `src/routes/` — route definitions
- `src/models/` — Mongoose schemas
- `src/middleware/` — auth + upload
- `src/utils/` — helpers (e.g., sensitive words)

