# Welpack Engineering — Field Dispatch, Work Log & Billing Hub

A full-stack demo application for managing on-site field engineering work: customers raise
service dispatch tickets, staff engineers log their on-site work and parts, and admins
assign engineers, review reports and generate invoices.

- **Frontend:** React 18 + Vite (plain CSS, [lucide-react](https://lucide.dev) icons)
- **Backend:** Node.js + Express + Mongoose REST API
- **Database:** MongoDB — connects to a local `mongodb://localhost:27017` instance, and
  automatically falls back to an in-memory MongoDB (`mongodb-memory-server`) when none is
  running, so it works with zero setup.
- **Optional integrations:** Twilio (SMS OTP) and Nodemailer (email OTP) for the
  password-reset flow. Without credentials the OTP code is returned in the API response
  for local testing.

---

## Project layout

```
.
├── index.html               # Vite entry
├── vite.config.js            # Dev server on port 3000
├── src/
│   ├── main.jsx / App.jsx    # App shell + role router + error boundary
│   ├── context/AppContext.jsx  # Global state + all calls to the API (http://localhost:5000/api)
│   ├── components/
│   │   ├── LoginPage.jsx        # Login + 1-click role shortcuts + password reset modal
│   │   ├── RoleHeader.jsx       # Portal switcher / logout
│   │   ├── CustomerPortal.jsx   # Raise tickets, track progress, view invoices, rate service
│   │   ├── EngineerPortal.jsx   # Active dispatches + completed history, field work-log form
│   │   └── AdminPortal.jsx      # Assign engineers, review reports, billing, accounts
│   └── data/initialData.js   # Seed data (accounts, engineers, requests)
└── server/
    ├── server.js             # Express app, Mongo connection + fallback, route mounts
    ├── seed.js               # Seeds the DB from src/data/initialData.js when empty
    ├── models/               # Mongoose schemas: Account, Engineer, Request
    └── routes/               # auth, accounts, requests, engineers
```

---

## Prerequisites

- **Node.js 18+** (developed on Node 22)
- npm
- MongoDB is **optional** — a local server is used if present, otherwise an embedded
  in-memory database starts automatically (first run downloads a MongoDB binary).

---

## Getting started

### 1. Install dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2. (Optional) Configure the backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env` only if you want real SMS/email OTP delivery. All values are optional;
leave them blank to have OTP codes returned directly by the API for local testing.
`server/.env` is git-ignored.

### 3. Run the backend API

```bash
npm run server
```

Starts on **http://localhost:5000**. On first run it connects to MongoDB (or starts the
embedded instance) and seeds accounts, engineers and sample dispatches.

### 4. Run the frontend

In a second terminal:

```bash
npm run dev
```

Opens **http://localhost:3000**.

---

## Demo accounts

The login page has **1-click role shortcuts**, or sign in manually:

| Role     | Email                    | Password   |
| -------- | ------------------------ | ---------- |
| Admin    | `admin@apex.com`         | `admin123` |
| Engineer | `alex@apex.com`          | `staff123` |
| Customer | `dmiller@acmesemi.com`   | `cust123`  |

Other seeded engineers (`carlos@`, `priya@`, `marcus@apex.com`) and customers
(`elena@biopharm.io`, `markus@logixhub.com`) share the same passwords.

> These are demo credentials with plain-text passwords for local development only.

---

## npm scripts

Run from the repo root:

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Start the Vite dev server (port 3000)        |
| `npm run build`  | Production build to `dist/`                  |
| `npm run preview`| Preview the production build                 |
| `npm run server` | Start the Express API (port 5000)            |
| `npm run seed`   | Re-run the database seeder                   |

---

## API overview

Base URL: `http://localhost:5000/api`

| Method & path                       | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `GET  /health`                      | Health / DB status                         |
| `POST /auth/login`                  | Email or phone + password login            |
| `POST /auth/send-otp`               | Send password-reset OTP (SMS/email/echo)   |
| `POST /auth/verify-otp`             | Verify an OTP code                         |
| `POST /auth/change-password`        | Set a new password after OTP verification  |
| `GET  /accounts`                    | List all accounts                          |
| `POST /accounts/customer`           | Create a customer account                  |
| `POST /accounts/engineer`           | Create an engineer account                 |
| `GET  /engineers`                   | List engineers                             |
| `PATCH /engineers/:id/toggle-active`| Enable / disable an engineer               |
| `GET  /requests`                    | List service dispatches                    |
| `POST /requests`                    | Create a dispatch ticket                   |
| `PATCH /requests/:id/assign`        | Assign an engineer                         |
| `PATCH /requests/:id/status`        | Update job status                          |
| `PATCH /requests/:id/report`        | Save engineer field report (hours, parts)  |
| `POST /requests/:id/remark`         | Add a work-log remark                      |
| `PATCH /requests/:id/billing`       | Update billing / invoice status            |

---

## Notes

- The frontend expects the API at `http://localhost:5000` (`API_BASE` in
  `src/context/AppContext.jsx`). Change it there if you host the backend elsewhere.
- All data shown in the app is loaded from MongoDB. The names in `src/data/initialData.js`
  are seed data only — anything created through the UI is persisted to the database.
