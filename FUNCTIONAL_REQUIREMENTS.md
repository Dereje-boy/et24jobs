# ET24Jobs - Functional Requirements

**Project:** ET24Jobs (etjobs.com)
**Type:** Full-stack web application for posting and discovering opportunities
**Stack:** Node.js + Express 5 + Handlebars + MySQL (Sequelize) + Bootstrap 5

---

## 1. System Overview

ET24Jobs is an online opportunities platform that helps job seekers, students, and professionals discover jobs, scholarships, and internship opportunities in Ethiopia and around the world. The platform aggregates opportunities from external sources and presents them in an easy-to-browse format.

---

## 2. User Roles

### 2.1 Public Visitors (Unauthenticated)
- Browse the homepage with featured opportunities
- Search across jobs, scholarships, and internships
- View lists of published opportunities
- View individual opportunity detail pages
- **Cannot** create, edit, or delete content
- **Cannot** access the admin panel

### 2.2 Admin Users (Authenticated)
- Log in via `/admin/login` with username/password
- Access the admin dashboard at `/admin`
- Create, edit, and delete job postings
- Manage (list, delete, change status) scholarships and internships
- Receive feedback via flash messages after actions

---

## 3. Public-Facing Features

### 3.1 Homepage (`/`)
- **Hero section** with search box for finding opportunities
- **Latest Jobs** section showing recent published jobs (card layout)
- **Latest Scholarships** section showing recent published scholarships
- **Latest Internships** section showing recent published internships
- **Featured banner** encouraging exploration
- **About ET24Jobs** section with links
- **Footer** with navigation links (Jobs, Scholarships, Internships, About, Contact, Privacy Policy, Terms)
- **Admin navbar link** appears only when an admin is logged in

Each opportunity card displays:
- Title (linked to detail page)
- Organization/provider name
- Location (if available)
- Employment type / study level / internship type (as applicable)
- Category badge (jobs only)
- Deadline information with days remaining or "closes today" indicator
- Status badges: "Deadline passed" (red) when expired

### 3.2 Jobs Listing (`/jobs`)
- Lists all **published** jobs ordered by creation date (newest first)
- Each job card shows title, company, location, employment type, category, deadline status

### 3.3 Job Detail (`/jobs/:slug`)
- **Public view:** Shows only published jobs with published attachments
- **Admin view:** Also shows draft attachments (labeled as drafts)
- Displays: title, company name, location, employment type, salary, deadline, description, responsibilities, requirements, qualifications, application info, source info
- **Attachment gallery** for image attachments (rendered as a gallery)
- **Download list** for non-image attachments
- **Related jobs** section (up to 5 other published jobs)
- Admin logged-in users see all attachment states

### 3.4 Scholarships Listing (`/scholarships`)
- Lists all scholarships (no status filter visible in code — shows all)
- Each card: title, provider name, location, study level, field of study badge, deadline

### 3.5 Scholarship Detail (`/scholarships/:slug`)
- Shows published scholarships only
- Displays full scholarship details + related scholarships (up to 5)

### 3.6 Internships Listing (`/internships`)
- Lists first 10 internships (sliced in controller)
- Each card: title, organization name, location, internship type, duration, field of study badge, deadline

### 3.7 Internship Detail (`/internships/:slug`)
- Shows published internships only
- Displays full internship details + related internships (up to 5)

### 3.8 Informational Pages
- `/about` — About ET24Jobs
- `/contact` — Contact page
- `/privacy-policy` — Privacy policy
- `/terms` — Terms & conditions
- 404 page for undefined routes
- 500 page for server errors (shows stack trace only in development)

---

## 4. Admin Panel Features

### 4.1 Authentication (`/admin/login`, `/admin/logout`)
- **Login form** with username + password fields
- Credentials validated against the `admin` table (bcrypt password hashes)
- Generic error message ("Invalid username or password") to prevent username enumeration
- Session fixation prevention via session regeneration on login
- MySQL-backed sessions (survive server restarts, pruned every 15 minutes)
- Session duration: 2 hours
- Logout clears session and redirects to login

### 4.2 Dashboard (`/admin`)
- Overview with counts: total jobs, scholarships, internships
- Recent items lists (last 5 of each type)
- Admin username displayed

### 4.3 Jobs Management (`/admin/jobs`)
- List **all** jobs (any status: draft, published, expired, archived)
- Newest first ordering
- Each row shows: title, company name, slug, status, views, deadline, creation date
- **Quick actions:**
  - **Delete** → Archives the job (soft delete, reversible)
  - **Status dropdown** → Change status (draft/published/expired/archived)
- Links to: "Create Job" (`/jobs/post`), edit page (`/jobs/:id/edit`)

### 4.4 Scholarships Management (`/admin/scholarships`)
- List all scholarships (any status)
- Quick delete (permanent) and status change
- **Note:** Create/edit forms for scholarships are not built yet (stub pages exist)

### 4.5 Internships Management (`/admin/internships`)
- List all internships (any status)
- Quick delete (permanent) and status change
- **Note:** Create/edit forms for internships are not built yet (stub pages exist)

### 4.6 Status Management
- Four statuses: `draft`, `published`, `expired`, `archived`
- Status change triggers:
  - **publishing a job:** Sends Telegram announcement (if configured)
  - **restoring an archived job:** Sets status to "draft" with success flash
  - **publishing an expired-deadline job:** Warning flash about auto-expiry
- `publishedAt` timestamp set when first published, cleared on unpublish

### 4.7 Delete Behavior
- **Jobs:** Soft delete (archived status) — row, attachments, and files preserved; reversible via "Restore" (status → draft)
- **Scholarships & Internships:** Permanent deletion

---

## 5. Job Creation & Management (Core Feature)

### 5.1 Create Job (`/jobs/post` → form, `/jobs/create` → submission)
**Requires admin authentication.**

**Form fields:**
| Field | Type | Required | Validation |
|---|---|---|---|
| Title | text | Yes | 5-255 chars |
| Organization | text | Yes | 3-255 chars |
| Category | select (from `categories` table, active only) | Yes | Positive integer |
| Location | text | No | Max 150 chars (defaults to "Ethiopia") |
| Employment Type | select | No | Enum: full-time, part-time, contract, temporary, internship, volunteer |
| Slug | text (auto-generated, editable) | Yes (auto-generated) | Max 300 chars, unique in DB |
| Salary | text | No | Max 150 chars |
| Deadline | date (YYYY-MM-DD) | No | Must be today or future (unless unchanged on edit) |
| Description | textarea | Yes | Max 60,000 chars |
| Responsibilities | textarea | No | Max 60,000 chars |
| Requirements | textarea | No | Max 60,000 chars |
| Qualifications | textarea | No | Max 60,000 chars |
| Application URL | url | No | Max 500 chars |
| Application Email | email | No | Max 255 chars, valid email |
| Application Instructions | textarea | No | Max 60,000 chars |
| Source Name | text | No | Max 255 chars |
| Source URL | url | No | Max 500 chars, must have protocol |
| Status | select | No | draft or published (defaults to published) |

**Attachments:**
- Drag-and-drop dropzone + file input
- Max files: configurable via `JOB_ATTACHMENT_MAX_FILES` env (default: 5)
- Max file size: configurable via `JOB_ATTACHMENT_MAX_SIZE_BYTES` env (default: 10 MB)
- Any file type allowed
- Files stored in `public/uploads/jobs/` with generated names: `<timestamp>-<random hex>.<ext>`
- Files submitted as multipart form data
- Server-side validation via multer (file count, file size limits)
- Client-side validation mirrors server limits (from `window.JOB_VALIDATION`)

**Slug generation:**
- Auto-generated from title + organization + date on form load
- Can be manually edited
- On submit: if empty, generated from title + timestamp
- Must be unique (DB unique constraint); duplicate → form re-rendered with error

**On successful create:**
- Job + attachments saved in a database transaction
- If status = "published": fires a Telegram announcement (fire-and-forget)
- Redirects to `/jobs`

**On failure:**
- Transaction rolled back
- Uploaded files cleaned up (no orphans)
- Form re-rendered with error messages and submitted values preserved

### 5.2 Edit Job (`/jobs/:id/edit`)
**Requires admin authentication.**

- Pre-populated form with existing job data
- Same fields as create form
- **Attachment lifecycle management:**
  - Existing attachments can be set to: `published`, `draft`, or `delete`
  - New files can be uploaded (added as published)
  - All changes in one transaction
- **Slug:** Empty input keeps current slug; otherwise normalized
- **Deadline validation exception:** Unchanged past deadline is allowed (so old jobs can be edited)
- **On status change to published:** Triggers Telegram announcement (if transitioning from non-published)
- **On duplicate slug:** Re-renders form with error
- Redirects to `/jobs/:slug` on success

### 5.3 Delete Job (`/jobs/:id/delete`)
**Requires admin authentication.**

- Archives the job (status → "archived")
- Does NOT delete the row, attachments, or files
- Redirects to `/admin/jobs`

---

## 6. Automated Features

### 6.1 Auto-Expiry Sweeper
- Runs at server boot (catch-up) and every 12 hours thereafter
- Sets `status = 'expired'` for published jobs whose deadline is before today
- Uses local date comparison (matches the `isExpired()` view helper)
- Only touches `status = 'published'` jobs
- Never crashes the server on failure (logged, retried next cycle)
- NULL deadlines are never expired (open-ended jobs stay published)

### 6.2 Telegram Announcements
**Configured via environment variables:**
- `TELEGRAM_BOT_TOKEN` — Bot token from @BotFather
- `TELEGRAM_CHANNEL_ID` — Public channel username (e.g., `@channel`)
- `PUBLIC_BASE_URL` — Base URL for job links (e.g., `https://etjobs.com`)

**Behavior:**
- Announces when a job **becomes** published (draft/expired/archived → published)
- Republishing an already-published job re-announces by design
- Message format: emoji header + job title + company + location/type + salary + deadline + link
- **Image handling:**
  - 0 images → plain text message (`sendMessage`)
  - 1 image → `sendPhoto` with caption
  - 2-10 images → `sendMediaGroup` album (caption on first item)
- **Image delivery:** files are read from `public/uploads/jobs/` and uploaded as multipart/form-data (no public image URL required)
- Max 10 images per album
- Caption truncated to 1024 chars
- Timeout: 4 seconds per request
- Feature disables gracefully when env vars are missing
- Never throws — returns `{ ok: boolean, error?, disabled? }`

### 6.3 Session Pruning
- Expired session rows pruned every 15 minutes by `connect-session-sequelize`

---

## 7. Data Models

### 7.1 Job
| Field | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED (PK, auto) | |
| title | STRING(255) | Required |
| slug | STRING(300) | Required, unique |
| companyName | STRING(255) | Required, DB field: `company_name` |
| companyInitials | STRING(10) | Optional |
| categoryId | BIGINT UNSIGNED | Optional, FK to categories |
| location | STRING(150) | Default: "Ethiopia" |
| employmentType | ENUM | Default: "full-time" |
| salary | STRING(150) | Optional |
| description | TEXT | Required |
| requirements | TEXT | Optional |
| responsibilities | TEXT | Optional |
| qualifications | TEXT | Optional |
| deadline | DATEONLY | Optional |
| applicationUrl | STRING(500) | Optional |
| applicationEmail | STRING(255) | Optional |
| applicationInstructions | TEXT | Optional |
| sourceName | STRING(255) | Optional |
| sourceUrl | STRING(500) | Optional |
| status | ENUM(draft, published, expired, archived) | Default: "draft" |
| views | INTEGER UNSIGNED | Default: 0 |
| publishedAt | DATE | Optional |
| created_at, updated_at | TIMESTAMP | Auto-managed |

### 7.2 JobAttachment
| Field | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED (PK, auto) | |
| jobId | BIGINT UNSIGNED | FK to jobs, CASCADE delete |
| storedName | STRING | Generated filename |
| originalName | STRING | Original filename |
| mimeType | STRING | MIME type |
| sizeBytes | INTEGER | File size |
| status | ENUM(published, draft) | Default: "published" |

### 7.3 Scholarship
Similar structure to Job with scholarship-specific fields: `providerName`, `providerWebsite`, `scholarshipType`, `studyLevel`, `fieldOfStudy`, `hostCountry`, `hostInstitution`, `studyMode` (enum), `fundingType` (enum), `fundingDetails`, `eligibility`.

### 7.4 Internship
Similar structure with internship-specific fields: `organizationName`, `organizationWebsite`, `internshipType` (enum), `duration`, `fieldOfStudy`, `studyLevel`, `compensationType` (enum), `compensationDetails`, `eligibility`, `benefits`, `startDate`.

### 7.5 Category
| Field | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED (PK, auto) | |
| name | STRING(100) | Required, unique |
| slug | STRING(120) | Required, unique |
| description | TEXT | Optional |
| status | ENUM(active, inactive) | Default: "active" |

### 7.6 Admin
| Field | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED (PK, auto) | |
| username | STRING(50) | Required, unique |
| passwordHash | STRING(255) | Required (bcrypt hash) |

### 7.7 Session
Managed by `connect-session-sequelize`, stored in MySQL `sessions` table.

---

## 8. Validation Rules

### 8.1 Server-Side Validation (express-validator)
All job create/edit submissions are validated before reaching the controller:
- All required fields validated for presence and length
- Enum fields validated against allowed values
- URL fields validated for protocol
- Email field validated as email format
- Date fields validated as YYYY-MM-DD format
- Deadline validated as today or future (with edit exception for unchanged dates)
- Attachment limits validated by multer
- Validation failures return HTTP 422 with field-specific error messages and preserved form data

### 8.2 Client-Side Validation
- Slug auto-generation from title + organization + date
- File selection limits (max files, max size per file) enforced before upload
- Shared validation constants injected via `window.JOB_VALIDATION` from server

### 8.3 Database-Level Constraints
- NOT NULL on required fields
- UNIQUE on slugs
- ENUM constraints on status, employmentType, etc.
- Foreign key relationships (category → jobs, job → attachments)

---

## 9. File Upload System

### 9.1 Local Storage (Current Default)
- Files stored in `public/uploads/jobs/`
- Served statically via Express (`express.static("public")`) under `/uploads/jobs/`
- Generated filenames prevent path traversal and collisions
- Files cleaned up on validation failures or errors (no orphan files)

### 9.2 Cloudflare R2 Storage (Optional/Configured)
- Configured via `CLOUDFLARE_UPLOAD_ENABLED=true`
- Uses presigned PUT URLs for direct browser upload
- Uses signed URLs for reads
- UUID-based object keys under configurable prefix
- Requires: endpoint, bucket, access key, secret key, attachment limits

---

## 10. Search

- Search form on homepage posts to `/search` (GET with `q` parameter)
- Search route defined in `routes/informationalpages.js`
- **Note:** The search functionality appears to be a stub (the route exists but implementation details are minimal)

---

## 11. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_NAME` | Yes | MySQL database name |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | No | MySQL port (default: 3306) |
| `SESSION_SECRET` | No | Session signing secret (dev fallback provided) |
| `ADMIN_USERNAME` | Yes* | Admin username (for `create-admin` script) |
| `ADMIN_PASSWORD` | Yes* | Admin password (for `create-admin` script) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for announcements |
| `TELEGRAM_CHANNEL_ID` | No | Telegram channel username |
| `PUBLIC_BASE_URL` | No | Base URL for job links |
| `JOB_ATTACHMENT_MAX_FILES` | No | Max attachment files (default: 5) |
| `JOB_ATTACHMENT_MAX_SIZE_BYTES` | No | Max file size in bytes (default: 10,485,760) |
| `CLOUDFLARE_UPLOAD_ENABLED` | No | Enable Cloudflare R2 storage |
| `CLOUDFLARE_STORAGE_ENDPOINT_HOST` | No* | Cloudflare R2 endpoint |
| `CLOUDFLARE_STORAGE_HOST` | No* | Cloudflare storage host |
| `CLOUDFLARE_STORAGE_BUCKET` | Yes* | Cloudflare bucket name |
| `CLOUDFLARE_STORAGE_PREFIX` | No | Object key prefix |
| `CLOUDFLARE_ACCESS_KEY_ID` | No* | Cloudflare access key |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | No* | Cloudflare secret key |
| `CLOUDFLARE_UPLOAD_URL_TTL_SECONDS` | No | Presigned URL TTL (default: 3600) |
| `CLOUDFLARE_PUBLIC_OBJECT_BASE_URL` | No | Public base URL for objects |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (affects error stack trace display) |

*Required only when the corresponding feature is enabled.

---

## 12. Project Scripts

| Script | Command | Purpose |
|---|---|---|
| Start | `npm start` | Start dev server with nodemon |
| Create Admin | `npm run create-admin` | Create initial admin account |
| Migrate Attachments | `npm run migrate-attachments` | Run attachment status migration |

---

## 13. Known Limitations / Not Yet Implemented

1. **Scholarship create/edit forms** — Only list, delete, and status management exist in admin; public post pages are stubs
2. **Internship create/edit forms** — Same as scholarships
3. **Search functionality** — Route exists but implementation is minimal/stub
4. **Job views counter** — The `views` field exists on models but is not incremented in the current controllers
5. **Cloudflare storage** — Configured but the upload routes (`/cloudflare-upload`) exist separately; the job form currently uses local multer storage

---

## 14. Key Design Decisions

1. **Soft delete for jobs** — Jobs are archived, not deleted, to allow undo and preserve history
2. **Transaction-wrapped job creation** — Job + attachments created in a transaction; failures clean up uploaded files
3. **Fire-and-forget Telegram** — Announcements don't block admin workflows; failures are logged only
4. **Local date comparison** — Deadline/expiry uses local midnight to avoid UTC offset issues
5. **Shared validation constants** — Single source of truth (`jobValidationConstants.js`) used by server validation, multer config, and client-side JS
6. **Mock session header** — Dev/testing helper (`x-mock-session` header) for faking admin login in tests
