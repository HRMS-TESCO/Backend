# HRMS Assets Page — Backend API

Node.js + Express + MongoDB backend that powers the **Company Assets** page
(employees grouped with their laptops, monitors, mice, keyboards, ID cards).

---

## Quick start

```bash
# 1. install deps
npm install

# 2. start MongoDB locally (or set MONGO_URI in .env to your Atlas string)

# 3. seed sample data (Liam Foster, Zoe Martinez, Ryan Patel, Alex Thompson, Ethan Brown)
npm run seed

# 4. start the server
npm run dev      # nodemon
# or
npm start
```

Server runs on `http://localhost:5000`.

---

## Folder structure

```
Assets page backend/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── assetController.js     # Asset CRUD + grouped view + assign/unassign
│   ├── employeeController.js  # Employee CRUD
│   └── statsController.js     # Top dashboard cards data
├── middleware/
│   └── errorMiddleware.js     # 404 + central error handler
├── models/
│   ├── Asset.js
│   └── Employee.js
├── routes/
│   ├── assetRoutes.js
│   ├── employeeRoutes.js
│   └── statsRoutes.js
├── seed.js                    # Sample data from the UI
├── server.js                  # Entry point
├── .env                       # PORT, MONGO_URI, CLIENT_URL
└── package.json
```

---

## API endpoints

### Stats — for the 8 cards at the top of the page

| Method | Endpoint                | Purpose                                        |
| ------ | ----------------------- | ---------------------------------------------- |
| GET    | `/api/stats`            | totalAssets, employeesWithAssets, per-type cnt |
| GET    | `/api/stats/conditions` | breakdown by condition (Good/Fair/Poor/New)    |

**Sample response — `GET /api/stats`:**

```json
{
  "success": true,
  "data": {
    "totalAssets": 17,
    "employeesWithAssets": 5,
    "totalEmployees": 5,
    "laptops": 5,
    "monitors": 2,
    "pcs": 0,
    "mouses": 3,
    "keyboards": 2,
    "idCards": 5
  }
}
```

### Assets

| Method | Endpoint                     | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| GET    | `/api/assets`                | flat list, filters: `search`, `type`, `status` |
| GET    | `/api/assets/grouped`        | **grouped by employee** — matches the UI       |
| GET    | `/api/assets/meta/enums`     | dropdown options (types / conditions / status) |
| GET    | `/api/assets/:id`            | single asset                                   |
| POST   | `/api/assets`                | create asset                                   |
| PUT    | `/api/assets/:id`            | update asset (edit pencil icon)                |
| DELETE | `/api/assets/:id`            | delete asset (trash icon)                      |
| PATCH  | `/api/assets/:id/assign`     | assign to employee `{ employeeId: <_id> }`     |
| PATCH  | `/api/assets/:id/unassign`   | unassign                                       |

**Sample — `GET /api/assets/grouped`** (this is what the Assets page calls):

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "employee": {
        "_id": "...",
        "employeeId": "EMP-1001",
        "name": "Liam Foster",
        "role": "Frontend Dev",
        "department": "Engineering",
        "initials": "LF",
        "avatarColor": "#DBEAFE"
      },
      "assetCount": 5,
      "assets": [
        {
          "assetId": "AST-001",
          "name": "MacBook Pro M2 14\"",
          "type": "Laptop",
          "serialNo": "MBP-2023-001",
          "issuedDate": "2023-01-15T00:00:00.000Z",
          "condition": "Good",
          "status": "Assigned"
        }
      ]
    }
  ]
}
```

**Create asset — `POST /api/assets`:**

```json
{
  "assetId": "AST-018",
  "name": "iPad Pro 12.9",
  "type": "Laptop",
  "serialNo": "IPD-PRO-018",
  "issuedDate": "2026-05-21",
  "condition": "New",
  "status": "Assigned",
  "employee": "<employee_mongo_id>"
}
```

### Employees

| Method | Endpoint                | Purpose                                |
| ------ | ----------------------- | -------------------------------------- |
| GET    | `/api/employees`        | list (filters: `search`, `department`) |
| GET    | `/api/employees/:id`    | single employee (populates assets)     |
| POST   | `/api/employees`        | create                                 |
| PUT    | `/api/employees/:id`    | update                                 |
| DELETE | `/api/employees/:id`    | delete + unassign their assets         |

---

## Enums (kept in `models/Asset.js`)

```js
ASSET_TYPES = ['Laptop', 'Monitor', 'PC', 'Mouse', 'Keyboard', 'ID Card'];
CONDITIONS  = ['New', 'Good', 'Fair', 'Poor'];
STATUSES    = ['Assigned', 'Unassigned', 'In Repair', 'Retired'];
```

---

## Hooking the frontend up

In your React app point your axios/fetch base URL at `http://localhost:5000/api`
and call `GET /assets/grouped` to render the full page. Use `GET /stats` for the
top cards. The "All Types" filter dropdown maps directly to `?type=Laptop` etc.

CORS is already enabled for `http://localhost:5173` (Vite default). Change
`CLIENT_URL` in `.env` if your frontend runs elsewhere.
