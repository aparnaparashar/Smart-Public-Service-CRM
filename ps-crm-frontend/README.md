# PS-CRM Frontend (React)

React single-page application for Smart Public Service CRM.

## Tech stack

- React 19
- react-router-dom
- axios
- recharts
- react-hot-toast

## Prerequisites

- Node.js (LTS recommended)
- Backend API running (for most screens)

## Setup

```bash
cd ps-crm-frontend
npm install
```

## Environment variables

Create a `.env` file in `ps-crm-frontend/` if your code expects one.

Look at `src/api.js` for the exact variable name(s) used for the API base URL.

## Run (development)

```bash
npm start
```

- App URL: http://localhost:3000

## Build (production)

```bash
npm run build
```

## Tests

```bash
npm test
```

## Notes

- Login/Register pages are role-based (citizen/officer/admin).
- Complaint flows include: submit, track by Complaint Number, and provide feedback after resolution.
- Dashboard/analytics pages consume backend endpoints under `/api/*`.

