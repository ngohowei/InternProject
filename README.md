# Welpack Engineering — Field Dispatch, Work Log & Billing Hub

A full-stack demo application for managing on-site field engineering work: customers raise
service dispatch tickets, staff engineers log their on-site work and parts, and admins
assign engineers, review reports and generate invoices.

- **Frontend:** React 18 + Vite (plain CSS, [lucide-react](https://lucide.dev) icons)
- **Backend:** Node.js + Express + Mongoose REST API with JWT auth
- **Database:** MongoDB (required — set `MONGODB_URI`). An in-memory database is available
  as an explicit opt-in for quick throwaway runs.
- **Auth:** JWT bearer tokens. Passwords are bcrypt-hashed. Every API route is
  authenticated and role-checked server-side.
- **Optional integrations:** Twilio (SMS OTP) and Nodemailer (email OTP) for password
  reset. With no credentials configured, the reset code is shown on screen in development.

---

## Project layout

```
.
├── vite.config.js               # Dev server (port 3000) + /api proxy to the backend
├── src/
│   ├── main.jsx / App.jsx        # App shell + role router + error boundary
│   ├── context/AppContext.jsx    # Global state, token handling, all API calls (apiFetch)
│   ├── components/
│   │   ├── LoginPage.jsx         # Login + 1-click role shortcuts + password reset modal
│   │   ├── RoleHeader.jsx        # Current role banner, logout, admin "reset demo"
│   │   ├── CustomerPortal.jsx    # Raise tickets, track progress, view invoices, rate service
│   │   ├── EngineerPortal.jsx    # Active dispatches + completed history, field work-log form
│   │   └── AdminPortal.jsx       # Assign engineers, review reports, billing, accounts
│   └── data/initialData.js       # Seed data (accounts, engineers, requests)
└── server/
    ├── server.js                 # Express app: helmet, CORS, rate limiting, route mounts
    ├── config/db.js              # MongoDB connection (env URI, explicit in-memory opt-in)
    ├── middleware/auth.js        # signToken, requireAuth, requireRole
    ├── models/                   # Mongoose schemas: Account, Engineer, Request, Counter
    ├── routes/                   # auth, accounts, requests, engineers, admin
    └── seed.js                   # Seeds / resets the DB from src/data/initialData.js
```

---

## Prerequisites

- **Node.js 18+** (developed on Node 22)
- npm
- **MongoDB** — a local `mongod`, a Docker container, or MongoDB Atlas.
  (For a quick look without a database, set `USE_MEMORY_DB=true`; data will not persist.)

---

## Getting started

### 1. Install dependencies

```bash
npm run setup
```

(installs both the root and `server/` dependencies)

### 2. Configure the backend

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`:

| Variable         | Required | Notes                                                                 |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `MONGODB_URI`    | yes\*    | e.g. `mongodb://localhost:27017/welpack_fieldeng`                       |
| `JWT_SECRET`     | yes      | any long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `USE_MEMORY_DB`  | no       | `true` to run without MongoDB (throwaway data)                       |
| `DEMO_MODE`      | no       | `true` = show the 1-click sign-in buttons and the admin **Reset Demo** button. **Set `false` before sharing the site or going live.** Unset: on in development, off in production |
| `TRUST_PROXY`    | no       | behind a reverse proxy, how many proxies to trust (e.g. `1`) so sign-in limits use the visitor's real address |
| `CLIENT_ORIGIN`  | no       | comma-separated allowed origins; blank = allow all (dev)            |
| `TWILIO_*`       | no       | real SMS OTP delivery                                               |
| `SMTP_*`         | no       | real email OTP delivery                                             |

\* not required if `USE_MEMORY_DB=true`.

> If you use the Docker `mongo` image and it runs as a replica set, append
> `?directConnection=true` to `MONGODB_URI` when connecting from the host.

### 3. Run everything

```bash
npm run dev
```

Starts the API (port 5000) and the Vite dev server (port 3000) together, and opens
**http://localhost:3000**. The frontend proxies `/api` to the backend, so no CORS setup
is needed in development.

Run them separately if you prefer: `npm run dev:server` and `npm run dev:web`.

---

## Demo accounts

In demo mode (`DEMO_MODE=true`) the login page has **1-click role shortcuts**; otherwise sign in manually:

| Role     | Email                    | Password   |
| -------- | ------------------------ | ---------- |
| Admin    | `admin@welpack.com`         | `admin123` |
| Engineer | `alex@welpack.com`          | `staff123` |
| Customer | `dmiller@acmesemi.com`   | `cust123`  |

Other seeded engineers (`carlos@`, `priya@`, `marcus@welpack.com`) and customers
(`elena@biopharm.io`, `markus@logixhub.com`) share the same passwords. These are demo
credentials for local development. Passwords are bcrypt-hashed in the database; an admin
can reset all data from the header (**Reset Demo**, demo mode only; you must type `RESET` to confirm).
With `DEMO_MODE=false` the shortcuts and Reset Demo are gone, the server refuses resets, and the demo
passwords are not sent to the browser at all.

---

## npm scripts

Run from the repo root:

| Command             | Description                                     |
| ------------------- | ---------------------------------------------- |
| `npm run setup`     | Install root + server dependencies             |
| `npm run dev`       | Start API + frontend together                  |
| `npm run dev:web`   | Vite dev server only (port 3000)               |
| `npm run dev:server`| Express API only (port 5000)                   |
| `npm run build`     | Production build to `dist/`                    |
| `npm run seed`      | Seed the database (no-op if already populated) |

---

## API overview

Base URL: `/api` (proxied to `http://localhost:5000` in dev). All routes except
`/auth/login`, `/auth/send-otp`, `/auth/verify-otp`, `/auth/change-password` and
`/health` require an `Authorization: Bearer <token>` header.

| Method & path                        | Auth       | Purpose                                   |
| ------------------------------------ | ---------- | ----------------------------------------- |
| `GET  /health`                       | none       | Health / DB status                        |
| `POST /auth/login`                   | none       | Password login → `{ token, account }`     |
| `GET  /auth/me`                       | any        | Restore session from a token              |
| `POST /auth/send-otp`                | none       | Send password-reset code                  |
| `POST /auth/verify-otp`              | none       | Verify a code or current password         |
| `POST /auth/change-password`         | none\*     | Set a new password (\*needs code/current) |
| `GET  /accounts`                     | admin      | List accounts (no password fields)        |
| `POST /accounts/customer`            | admin      | Create a customer account                 |
| `POST /accounts/engineer`            | admin      | Create an engineer + login account        |
| `GET  /engineers`                    | any        | List engineers                            |
| `PATCH /engineers/:id/toggle-active` | admin      | Enable / disable an engineer              |
| `GET  /requests`                     | any        | List dispatches (scoped to your role)     |
| `POST /requests`                     | customer   | Create a dispatch ticket                  |
| `PATCH /requests/:id/assign`         | admin      | Assign an engineer                        |
| `PATCH /requests/:id/status`         | engineer   | Update job status (own jobs only)         |
| `PATCH /requests/:id/report`         | engineer   | Save field report (own jobs only)         |
| `POST /requests/:id/remark`          | any        | Add a work-log note (participants only)   |
| `POST /requests/:id/rating`          | customer   | Rate a completed job (1–5)                |
| `PATCH /requests/:id/billing`        | admin      | Send invoice / mark paid                  |
| `GET  /parts`                        | admin, engineer | Search / filter / sort / page the catalog (see below) |
| `POST /parts`                        | admin      | Add a catalog item (code, name, price)    |
| `POST /parts/import`                 | admin      | Add / update many items from a CSV (dry-run preview supported) |
| `PATCH /parts/:id`                   | admin      | Edit code / name / price, hide or show    |
| `DELETE /parts/:id`                  | admin      | Delete a catalog item                     |
| `POST /admin/reset-demo`             | admin      | Wipe and re-seed all data (demo mode only, body `{ "confirm": "RESET" }`) |
| `GET  /config`                       | none       | `{ demoMode, demoLogins }` - which demo-only features to show |

**Large catalogs:** the catalog is never loaded all at once. `GET /parts` does the work in the database and
accepts `q` (name or code), `category`, `status` (admin: `active`/`hidden`), `sort` (`code`, `name`, `category`,
`unitPrice`, `status`), `dir`, `page` and `limit` (max 100). The admin screen has search, category/status filters,
sortable columns and paging; engineers get a type-ahead search that returns the best matches. Admins can bulk-load
items with **Import CSV** (columns: `code, name, unitPrice`, optional `category`; up to 2000 rows per file, with a
preview before anything is saved; an existing code is updated, not duplicated). Categories: Electrical, HVAC,
Automation, Mechanical, Software, General.

**Parts catalog:** admins maintain items (code, name, unit price). When an engineer logs work they
search the catalog by name or code and enter only a quantity; the server fills in the name and price
from the catalog, so prices can't be typed in. Each report line stores a snapshot of the code, name and
price at the time it was added, so later catalog edits never change work already logged or invoiced.

**Sign-in protection:** only *failed* attempts count, tracked per account and network address (8 wrong
passwords per account / 40 per network / 8 wrong codes per account in 15 minutes; 5 verification-code
requests per account). Successful sign-ins and page refreshes are never limited, and a blocked person
sees how long to wait.

---

## Notes

- The frontend talks to `/api` (`VITE_API_BASE`, default `/api`). To point at a backend on
  another host, set `VITE_API_BASE` or the dev proxy target `VITE_API_TARGET`.
- `GET /requests` is scoped server-side: customers see only their own tickets, engineers
  see only tickets assigned to them, admins see everything.
- All data shown in the app comes from MongoDB. `src/data/initialData.js` is seed data
  only — anything created through the UI is persisted.
