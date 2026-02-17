# Backend requirements for Admin Data Downloader (full export)

When users export data from **Admin Center → Downloader** with "Select all" fields, the CSV/Excel should include **all columns with values**, not just 4 (e.g. Company, Phone, Website, Status). Right now only those 4 have data because the backend returns minimal records.

The frontend expects one of the following.

---

## Option A (recommended): List endpoint returns full records

**Request**

- `GET /api/organizations?full=1` (and same for `/api/jobs`, `/api/leads`, `/api/job-seekers`, `/api/hiring-managers`, `/api/placements`, `/api/tasks`)
- When query param **`full=1`** (or your backend can support **`expand=all`**) is present, the list response must include **every field** for each record.

**Response shape (unchanged)**

- Same as today, e.g. `{ organizations: [ ... ] }`, but each item must include:
  - All standard fields (e.g. for organizations: `name`, `contact_phone`, `website`, `status`, `nicknames`, `parent_organization`, `address`, `year_founded`, `num_employees`, `num_offices`, `contract_on_file`, `date_contract_signed`, `overview`, etc.)
  - **`custom_fields`**: either a **plain object** (e.g. `{ "Industry": "Tech", "Region": "North" }`) or a **JSON string** (e.g. `"{\"Industry\":\"Tech\"}"`). Both are supported.

**Auth**

- Same as today: `Authorization: Bearer <token>`.

If the list endpoint returns full records when `full=1` is present, the downloader will use that and will **not** call GET-by-id per row.

---

## Option B: Get-by-id returns full records (current fallback)

If the list endpoint keeps returning minimal data (e.g. only `id`, `name`, `contact_phone`, `website`, `status`), the downloader will call **GET by ID** for each row to get the full record.

**Request**

- `GET /api/organizations/{id}` (and same for jobs, leads, job-seekers, hiring-managers, placements, tasks)
- Headers: `Authorization: Bearer <token>`

**Response shape (one of these)**

1. Wrapped: `{ organization: { id, name, contact_phone, ..., custom_fields, ... } }`  
   (Same for `job`, `lead`, `jobSeeker`, `hiringManager`, `placement`, `task`.)
2. Top-level record: `{ id, name, contact_phone, ..., custom_fields, ... }` (no wrapper)

The response must include the **same full record** as in Option A (all standard fields + `custom_fields` as object or JSON string).

---

## Summary

| Issue | Cause | Backend fix |
|-------|--------|-------------|
| Only 4 columns have values in export | List (and/or GET-by-id) returns minimal fields | **Option A:** For `GET /api/{entity}?full=1`, return full records including `custom_fields`. **Option B:** Ensure `GET /api/{entity}/{id}` returns the full record (all fields + `custom_fields`). |

Once the backend returns full records (via Option A or B), the existing downloader code will show all selected columns with values in the CSV/Excel.
