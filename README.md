# Smart Public Service CRM (PS-CRM)

**PS-CRM is a Delhi grievance & service management system** built to help citizens raise public issues, track resolution, and get timely updates.

This project was built in honor of **Delhi CM Smt. Rekha Gupta Ji** and aims to streamline complaint handling for public service delivery.

It includes AI-assisted complaint classification, a WhatsApp chatbot experience, and role-based officer/admin workflows.

This repository contains two applications:


- **ps-crm-backend** — Node.js/Express REST API (MongoDB)
- **ps-crm-frontend** — React SPA (citizen/officer/admin UIs)

---

## Features

### Citizen services
- Submit complaints with title/description, ward/location details, optional images.
- Track complaints by **Complaint Number** (e.g., `CMP-XXXXXXXX`).
- View *your* complaints (email-based).
- Provide feedback **only after resolution**.
- AI-assisted complaint classification into the correct department/category + urgency.

### Officer/admin workflows
- Officer views assigned complaints and updates status/resolution.
- Admin views all complaints, manages officers/roles.

### Analytics & visualization
- Dashboard statistics (overview, category/urgency/ward trends, satisfaction from feedback).
- Heatmap data generation for Delhi locality/ward distribution.

### WhatsApp chatbot
- Multilingual (English/Hindi) conversational flow for:
  - Filing complaints
  - Tracking complaints
  - Listing own complaints
  - Submitting feedback
  - Checking eligibility for selected Delhi government schemes
- Provides structured responses (JSON → frontend/WhatsApp layer).

### Tech highlights
- Duplicate complaint detection using **semantic similarity embeddings** (non-trivial dedup flow).
- SLA deadline calculation + escalation support.
- Sensitive word validation to prevent inappropriate complaint text.
- AI fallback strategy (Groq primary → Gemini fallback).

---

## Architecture

- **Backend**: Express routes/controllers/models
  - `src/config/*` includes DB, email, OTP, SLA, WhatsApp bot bootstrap
  - `src/controllers/*` includes complaint/chatbot/dashboard/heatmap logic
  - `src/models/*` includes `User`, `Complaint`, `Feedback`
- **Frontend**: React components/pages
  - `src/pages/*` for role-based dashboards and complaint flows
  - `src/context/*` for auth + language
  - `src/api.js` for API integration

---

## Prerequisites

- Node.js (LTS recommended)
- MongoDB (local or hosted)
- AI provider keys (see environment section)
- SMTP credentials for email notifications (complaint confirmation + status updates)
- (Optional) WhatsApp bot credentials for QR-based WhatsApp flow

---

## Environment variables

Each app has its own `.env` file.

### Backend (`ps-crm-backend/.env`)
Create `ps-crm-backend/.env` with at least:

- `MONGO_URI` — MongoDB connection string
- `PORT` — optional (default: `5000`)

AI:
- `GROQ_API_KEY` — Groq LLM key (primary classifier)
- `GEMINI_API_KEY` — Gemini key (embedding + fallback)

Email (for notifications):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL` (sender)

JWT/Auth:
- `JWT_SECRET` (or the secret name used by your auth middleware)

WhatsApp bot (if used):
- Whatever credentials are required by `src/config/whatsappBot.js` (commonly includes session/keys)

> Note: Exact variable names can vary based on existing code. If you run into missing env errors, follow the stack trace to add the required variable.

### Frontend (`ps-crm-frontend/.env`)
Create `ps-crm-frontend/.env` if the app expects it (commonly includes API base URL):
- `REACT_APP_API_BASE_URL` (or similar used in `src/api.js`)

---

## Getting started

### 1) Backend

```bash
cd ps-crm-backend
npm install
npm run dev
```

Backend starts on `http://localhost:5000` by default.

### 2) Frontend

Open a new terminal:

```bash
cd ps-crm-frontend
npm install
npm start
```

Frontend starts on `http://localhost:3000`.

---

## API overview

Backend exposes routes under `/api/*`:

- `GET /api/health` — health check

Auth:
- `POST /api/auth/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp-and-register`
- `POST /api/auth/resend-otp`
- Officer/admin endpoints for managing officers/roles

Complaints:
- `POST /api/complaints` — submit complaint
- `POST /api/complaints/classify` — AI classification helper
- `GET /api/complaints/my` — citizen’s complaints (auth required)
- `GET /api/complaints/assigned` — officer’s assigned (auth required)
- `GET /api/complaints/track/:complaintNumber` — public track
- `GET /api/complaints` — admin: all complaints (auth required)
- `GET /api/complaints/:id` — get by MongoDB id
- `PUT /api/complaints/:id` — officer/admin status update

Dashboard:
- `GET /api/dashboard/*` — stats endpoints

Heatmap:
- `GET /api/heatmap/*` — heatmap aggregation

Chatbot:
- `POST /api/chatbot/chat` (payload handled by `chatbotController`)
- `POST /api/chatbot/reset`

---

## WhatsApp chatbot integration

The backend boots WhatsApp bot on server start and uses QR-based initialization.

Typical flow:
1. Start backend
2. Scan QR code from logs/terminal image (implementation dependent)
3. Interact via WhatsApp:
   - Follow prompts for filing complaints, tracking, feedback, and scheme eligibility

---

## Database

MongoDB collections are backed by Mongoose models:
- `User`
- `Complaint`
- `Feedback`

If you need initial data seeding (e.g., default admin/officer), see the root helper scripts (e.g., `add-admin.js`) and migration tooling.

---

## Testing

- Frontend: `npm test` inside `ps-crm-frontend`
- Backend: the project currently doesn’t define explicit backend test scripts; rely on API validation and runtime checks.

---

## Deployment notes

- Use production-grade MongoDB connection string.
- Configure CORS origins as needed.
- Ensure AI provider rate limits and environment secrets are secured.
- Consider running WhatsApp bot + server in a persistent environment.

---

## Project structure

```text
Smart-Public-Service-CRM/
  ps-crm-backend/
    server.js
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      utils/
  ps-crm-frontend/
    src/
      api.js
      pages/
      components/
      context/
      styles/
```

---

## Acknowledgements

- AI providers: Groq and Google Gemini
- WhatsApp bot stack: Baileys
- Frontend: React
- Backend: Express + MongoDB (Mongoose)

