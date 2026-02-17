# Activity Tracker – Flow & Design

## 1. Purpose

- **Admin Center block**: "Activity Tracker"
- **Goal**: Break down activity **by person** — what each user does in the system (clicks, actions, key operations).
- **Output**: Overview of each user’s performance + **exportable Excel**.

---

## 2. High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPTURE                                                                 │
│  • Frontend and/or backend records each significant user action          │
│  • Each event: who, what, when, optional context (entity, page, etc.)    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STORE                                                                   │
│  • Activity/audit table (or log store)                                   │
│  • Queryable by user_id, date range, action type, entity type            │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN UI (Activity Tracker)                                             │
│  • Select person (user) ± date range ± filters                          │
│  • List: timeline of events per user                                    │
│  • Summary: counts by action type, by entity, by day/week               │
│  • Export to Excel (raw list + optional summary sheet)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What to Track (“Events”)

| Category        | Examples |
|----------------|----------|
| **Navigation** | Page view (e.g. `/dashboard/job-seekers`, `/dashboard/jobs/123/view`) |
| **Entity view**| Opened Job Seeker, Job, Organization, Lead, Placement, Task, Hiring Manager |
| **Create**     | Created job seeker, job, organization, note, task, placement, etc. |
| **Update**     | Edited record, status change, field update |
| **Delete**     | Deleted record (or soft-delete / archive) |
| **Actions**    | Add Note, Add Task, Transfer, Print, Email, Add Submission, etc. |
| **Search**     | Global search used, list filter applied |

**Suggested minimal set for “performance overview”:**

- **Entity created** (by type: job seeker, job, organization, lead, placement, task, etc.)
- **Note added**
- **Record viewed** (which entity type + id)
- **Record updated**
- **Record deleted/archived**
- **Key actions** (e.g. Add Submission, Transfer, Add Task from record view)

Optional later: every page view, every button click (can get noisy).

---

## 4. Data Model (Activity Log)

**Option A – New table (recommended if backend supports it)**

| Field           | Type        | Description |
|-----------------|------------|-------------|
| `id`            | PK         | Unique id |
| `user_id`       | FK / int   | Who performed the action |
| `user_name`     | string     | Denormalized for export/display |
| `action`        | string     | e.g. `page_view`, `entity_view`, `create`, `update`, `delete`, `add_note`, `add_submission` |
| `entity_type`   | string     | e.g. `job_seeker`, `job`, `organization`, `lead`, `placement`, `task`, `hiring_manager` |
| `entity_id`     | string/int | Id of the record (if applicable) |
| `entity_label`  | string     | Optional human label (e.g. job title, person name) for Excel |
| `metadata`     | JSON/text  | Optional: route, query params, changed fields, etc. |
| `created_at`    | datetime   | When the action occurred (server time) |
| `ip` / `source` | string     | Optional |

**Option B – Use existing data only (no new table)**

- Use current APIs: entities with `created_by`, notes with `created_by`, and entity history endpoints.
- **Limitation**: Only “who created/updated” and “notes added” — no “who viewed” or “who clicked what”. Good for a **simplified** “performance by person” (creates + notes) and Excel export; not full “everything they click”.

Flow below assumes **Option A** for full flexibility; Option B can be a Phase 1 with existing data.

---

## 5. How to Capture Events

**5.1 Frontend (Next.js app)**

- **Single API**: e.g. `POST /api/activity` or `POST /api/audit/log`.
- **Payload**: `{ action, entity_type?, entity_id?, entity_label?, metadata? }`. `user_id` comes from auth (token/session).
- **Where to call**:
  - **Key pages**: On load of important routes (e.g. view pages), send `entity_view` or `page_view`.
  - **Key actions**: After successful mutation or action (create, update, delete, add note, add submission, transfer, etc.), send one event per action.
- **Throttling**: Optional debounce for high-frequency events (e.g. page_view) to avoid flooding.

**5.2 Backend (if you control the API)**

- In API handlers: after successful create/update/delete, write one row to the activity table (same shape as above). Ensures all mutations are logged even if frontend misses.

**5.3 Recommendation**

- Start with **backend logging** for creates/updates/deletes and **frontend logging** for views and in-app actions (Add Note, Add Submission, etc.). Then add more event types as needed.

---

## 6. API for Activity Tracker

**6.1 Write**

- `POST /api/activity`  
  - Body: `{ action, entity_type?, entity_id?, entity_label?, metadata? }`  
  - Auth: required; `user_id` from token.  
  - Response: `{ success, id? }`.

**6.2 Read (for Admin)**

- `GET /api/admin/activity` (or `GET /api/activity` with admin-only check)  
  - Query params:  
    - `user_id` – filter by user (optional; if omitted, all users).  
    - `start`, `end` – date range (YYYY-MM-DD).  
    - `action` – filter by action type.  
    - `entity_type` – filter by entity type.  
    - `page`, `limit` – pagination.  
  - Response: `{ success, activities: [...], total }`.  
  - Permission: **Admin only**.

**6.3 Summary (for “performance overview”)**

- `GET /api/admin/activity/summary`  
  - Query params: `user_id`, `start`, `end` (same as above).  
  - Response: counts per user (and optionally per action, per entity_type, per day).  
  - Used for the “overview” section and for building Excel summary sheet.

---

## 7. Admin UI – Activity Tracker Page

**7.1 Entry**

- Admin Center → new block **“Activity Tracker”** → links to `/dashboard/admin/activity-tracker`.

**7.2 Layout**

1. **Filters (top)**
   - **Person**: dropdown (or search) of users (from User Management / auth). Optional “All users”.
   - **Date range**: Start date, End date.
   - **Action type**: optional filter (e.g. create, update, view, add_note, …).
   - **Entity type**: optional filter (job_seeker, job, organization, …).
   - Buttons: **Apply**, **Export to Excel**, **Clear**.

2. **Summary cards (optional)**
   - For selected user(s) and range: total actions, breakdown by action type, breakdown by entity type (e.g. “12 Job Seekers created”, “5 Notes added”).

3. **Table (main)**
   - Columns: **Date/Time**, **User**, **Action**, **Entity Type**, **Entity** (id or label), **Details** (e.g. metadata or link).
   - Sort by date (newest first by default).
   - Pagination or “Load more”.

4. **Export to Excel**
   - **Sheet 1 – Raw**: Same columns as table (Date/Time, User, Action, Entity Type, Entity, Details), all rows for current filters (respect pagination or “export all”).
   - **Sheet 2 – Summary** (optional): Per-user (and optionally per day) counts: e.g. User, Date, Action, Count.
   - File name: e.g. `Activity_Tracker_YYYY-MM-DD.xlsx`.

**7.3 Permissions**

- Only users with **Admin** (or “Activity Tracker” permission) can open this page and call the admin activity APIs.

---

## 8. Implementation Phases

| Phase | Scope | Deliverables |
|-------|--------|--------------|
| **Phase 1** | Flow + Admin entry | This flow doc; add “Activity Tracker” block on Admin Center linking to `/dashboard/admin/activity-tracker`. Placeholder page: “Coming soon” or reuse existing activity-report with Excel export. |
| **Phase 2a** | Backend only | Activity table + `POST /api/activity` + `GET /api/admin/activity` + `GET /api/admin/activity/summary`. No frontend logging yet; can backfill from entity `created_by` / notes if desired. |
| **Phase 2b** | Admin UI | Activity Tracker page: filters, table, summary, **Export to Excel** (raw + summary sheets). |
| **Phase 3** | Capture | Frontend: send events on key views and actions. Backend: log create/update/delete in API handlers. |
| **Phase 4** | Polish | More event types, throttling, cleanup/retention policy, and any extra columns in Excel. |

---

## 9. Export to Excel – Detail

- **Library**: Use existing approach (e.g. `xlsx`) as in Admin Downloader.
- **Raw sheet**: One row per activity; columns: `Date/Time`, `User`, `User Email`, `Action`, `Entity Type`, `Entity ID`, `Entity Label`, `Details/Metadata`.
- **Summary sheet**: Rows = user (and optionally date); columns = `User`, `Date` (optional), `Action` or `Entity Type`, `Count`. Pivot-style so admins can see “per person, per action” overview.
- **Filename**: `Activity_Tracker_<start>_<end>.xlsx` or `Activity_Tracker_<timestamp>.xlsx`.

---

## 10. Summary

- **Activity Tracker** = new Admin block → dedicated page.
- **Data**: New activity/audit store (recommended) or existing “created_by”/notes (simplified).
- **Capture**: Backend on mutations + frontend on views and key actions.
- **Admin UI**: Filter by person, date, action, entity → list + summary → **Export to Excel** (raw + summary).
- Implement in phases: flow + block first, then backend + UI, then instrumentation.

This flow gives you a clear path from “everything they click/do” to “by person,” “overview of performance,” and “exportable Excel.”
