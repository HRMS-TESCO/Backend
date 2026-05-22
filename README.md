# HRM Slim Backend — Announcement + Payroll Only

A minimal Express + MongoDB API that exposes **only** the Announcement and
Payroll endpoints (plus the auth scaffolding they need to enforce JWT + roles).

Use this when you want to ship or test just these two modules without the rest
of the HRM suite. The full backend (with Employees, Attendance, Leave, Assets,
etc.) lives next door in `../backend/` and is unchanged.

---

## Folder Structure

```
backend-announce-payroll/
├── config/db.js                  # MongoDB connection
├── controllers/
│   ├── authController.js         # register/login/me (no forgot-password here)
│   ├── announcementController.js
│   └── payrollController.js
├── middleware/
│   ├── authMiddleware.js         # JWT verify (protect)
│   ├── roleMiddleware.js         # authorize(...roles)
│   ├── errorMiddleware.js        # notFound + global error handler
│   └── validateRequest.js
├── models/
│   ├── User.js                   # slim user (auth + role + employeeId)
│   ├── Announcement.js
│   └── Payroll.js
├── routes/
│   ├── authRoutes.js             # /api/auth/*
│   ├── announcementRoutes.js     # /api/announcements/*
│   └── payrollRoutes.js          # /api/payroll/*
├── utils/
│   ├── generateToken.js
│   └── ApiError.js
├── validators/
│   ├── authValidator.js
│   ├── announcementValidator.js
│   └── payrollValidator.js
├── app.js                        # Express app
├── server.js                     # Entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick Start

```bash
cd backend-announce-payroll
npm install
cp .env.example .env       # set MONGO_URI and JWT_SECRET
npm run dev                # nodemon
# or
npm start
```

Default port is `5001` (one above the full backend at 5000) so both can run
side-by-side during testing.

---

## Environment Variables

| Key          | Purpose                              |
| ------------ | ------------------------------------ |
| `PORT`       | API port (default 5001)              |
| `NODE_ENV`   | `development` / `production`         |
| `MONGO_URI`  | MongoDB connection string            |
| `JWT_SECRET` | Long random string for JWT signing   |
| `JWT_EXPIRE` | e.g. `7d`                            |
| `CLIENT_URL` | Frontend origin for CORS             |

---

## Endpoints

All protected endpoints require `Authorization: Bearer <token>`.

### Auth (`/api/auth`)
| Method | Path        | Access  |
| ------ | ----------- | ------- |
| POST   | `/register` | Public  |
| POST   | `/login`    | Public  |
| GET    | `/me`       | Private |

### Announcements (`/api/announcements`)
| Method | Path          | Access      |
| ------ | ------------- | ----------- |
| GET    | `/`           | Private     |
| GET    | `/:id`        | Private     |
| POST   | `/`           | Admin / HR  |
| PUT    | `/:id`        | Admin / HR  |
| DELETE | `/:id`        | Admin       |
| PATCH  | `/:id/read`   | Private     |

### Payroll (`/api/payroll`)
| Method | Path                | Access      |
| ------ | ------------------- | ----------- |
| GET    | `/`                 | Admin / HR  |
| GET    | `/my`               | Private     |
| GET    | `/:id`              | Private     |
| POST   | `/`                 | Admin / HR  |
| PUT    | `/:id`              | Admin / HR  |
| PATCH  | `/:id/pay`          | Admin / HR  |
| DELETE | `/:id`              | Admin       |
| GET    | `/:id/payslip`      | Private     |
| GET    | `/summary/:year`    | Admin / HR  |

---

## Sample Requests

**Register an Admin (run once for setup):**
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"secret123","role":"Admin"}'
```

**Login:**
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123"}'
```

**Create announcement:**
```bash
curl -X POST http://localhost:5001/api/announcements \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Office closed Friday","content":"Diwali holiday.","category":"Holiday","priority":"High"}'
```

**Create a payroll record:**
```bash
curl -X POST http://localhost:5001/api/payroll \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee":"<USER_ID>",
    "month":5,
    "year":2026,
    "basicSalary":50000,
    "allowances":{"hra":10000,"travel":2000},
    "deductions":{"pf":6000,"tax":4000}
  }'
```

Net / gross / total deductions are computed automatically in a Mongoose
pre-save hook.

---

## How this differs from the full `backend/`

| Module          | Full backend | This slim backend |
| --------------- | :----------: | :---------------: |
| Auth            | full (incl. forgot/reset password + email) | login/register/me only |
| Announcements   | ✔            | ✔ |
| Payroll         | ✔            | ✔ |
| Employees       | ✔            | — |
| Departments     | ✔            | — |
| Designations    | ✔            | — |
| Attendance      | ✔            | — |
| Leaves          | ✔            | — |
| Allowances      | ✔            | — |
| Assets          | ✔            | — |
| Performance     | ✔            | — |
| Live Tracking   | ✔            | — |
| Role Permissions| ✔            | — |
| Settings        | ✔            | — |
| Reports         | ✔            | — |
