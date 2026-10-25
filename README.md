# Student Import System

A backend assessment project for importing large student datasets into PostgreSQL using Node.js, Express, PostgreSQL, Redis, and BullMQ.

## Project status

### Implemented and tested

- PostgreSQL and Redis run through Docker Compose.
- Student table schema, primary/unique constraints, and indexes.
- Imported a synthetic dataset containing 2,000,000 student records into PostgreSQL.
- SQL file upload endpoint using Express and Multer.
- Asynchronous import jobs using BullMQ and Redis.
- Separate worker process for import jobs.
- Import job status API with record counts and progress percentage.
- Bulk loading through PostgreSQL `COPY` and a temporary staging table.
- Duplicate handling using `ON CONFLICT DO NOTHING`.
- Student listing, search, and pagination API.
- Tested a new SQL file upload and verified that uploading the same records again skips duplicates.

### Pending / improvements

- React frontend for file selection, upload, import status, and progress display.
- More comprehensive validation and tests for invalid SQL files and malformed records.
- Improve row-level error handling so one bad record does not necessarily fail the entire import.
- Review and test job status behavior when BullMQ retries a failed job.
- Test recovery scenarios such as API/worker restarts and interrupted imports.
- Benchmark import throughput and search/list performance with the 2-million-record dataset.
- Add automated tests and complete end-to-end documentation.

> The React frontend and the pending reliability/performance items are not yet complete. The current working demonstration is through the backend API and PowerShell commands.

## Technology stack

- Node.js
- Express.js
- PostgreSQL
- Redis
- BullMQ
- Multer
- `pg` and PostgreSQL `COPY`
- Docker Compose

## Project directory

The project is expected to be located at:

`F:\PersonalProjects\Assessment\student-import-app`

Expected structure:

```text
student-import-app/
├── docker-compose.yml
├── README.md
└── server/
    ├── .env                 # Create locally; do not commit secrets
    ├── package.json
    ├── data/
    │   ├── students_20_lakh.sql
    │   ├── test-students.sql
    │   └── demo-new-students.sql
    ├── database/
    │   ├── schema.sql
    │   └── import-jobs.sql
    └── src/
        ├── app.js
        ├── config/
        │   ├── db.js
        │   └── redis.js
        ├── jobs/
        │   └── importQueue.js
        ├── middleware/
        │   └── upload.js
        ├── routes/
        │   ├── importRoutes.js
        │   └── studentRoutes.js
        ├── services/
        │   └── studentImportService.js
        ├── workers/
        │   └── importWorker.js
        └── import-students.js
```

Some test/demo files may be local-only and may not be present in a fresh checkout. Check the repository before relying on them.

## Prerequisites

Install the following on the machine running the project:

- Node.js and npm
- Docker Desktop with Docker Compose
- Git (optional, for cloning the repository)

## Local setup

### 1. Open the project directory

In PowerShell:

```powershell
cd F:\PersonalProjects\Assessment\student-import-app
```

Run the following commands from the project root unless a step says otherwise.

### 2. Start PostgreSQL and Redis

```powershell
docker compose up -d
docker ps
```

The Compose configuration maps PostgreSQL to host port `5433` and Redis to host port `6379`.

Database configuration used by the current local setup:

- Database: `student_import`
- User: `student_admin`
- Password: `local_dev_password`
- PostgreSQL host port: `5433`
- Redis host port: `6379`

These are local development credentials only. Change them for any shared or production environment.

### 3. Install backend dependencies

```powershell
cd .\server
npm install
```

### 4. Configure environment variables

Create `server/.env` with the following values for the provided local Docker configuration:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://student_admin:local_dev_password@127.0.0.1:5433/student_import
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./uploads
IMPORT_BATCH_SIZE=2000
```

Ensure `server/.env` is excluded from version control if it contains credentials.

### 5. Create database tables

From the project root, run these commands in PowerShell to apply the SQL files:

```powershell
Get-Content -Raw .\server\database\schema.sql |
  docker exec -i student-import-postgres psql -U student_admin -d student_import

Get-Content -Raw .\server\database\import-jobs.sql |
  docker exec -i student-import-postgres psql -U student_admin -d student_import
```

These commands assume the Docker container is named `student-import-postgres`, as in the current Compose configuration.

### 6. Load the initial 2-million-record dataset (first-time setup only)

The supplied dataset is located at:

`server/data/students_20_lakh.sql`

The project has a standalone importer at `server/src/import-students.js`. If the database is empty and you need to recreate the initial dataset, inspect that script and run it from the server directory:

```powershell
cd .\server
node .\src\import-students.js
```

**Important:** This is a one-time initial data load, not the normal upload demo. Do not run it against a database that already contains the dataset: duplicate primary/unique values can cause the import to fail. The script may also close its PostgreSQL pool when finished.

If the dataset file is not included in the repository, obtain the supplied assessment dataset before running this step.

## Run the backend

Keep each process running in its own PowerShell terminal.

### Terminal 1: API server

```powershell
cd F:\PersonalProjects\Assessment\student-import-app\server
node .\src\app.js
```

If a development script is configured in `package.json`, `npm run dev` may be used instead.

API base URL:

`http://localhost:5000`

### Terminal 2: background worker

```powershell
cd F:\PersonalProjects\Assessment\student-import-app\server
node .\src\workers\importWorker.js
```

The worker listens for BullMQ jobs and processes SQL file imports.

## API endpoints

### Upload an SQL file

`POST /api/imports`

Send multipart form data with the file field named `file`.

PowerShell example using `curl.exe`:

```powershell
cd F:\PersonalProjects\Assessment\student-import-app\server
curl.exe -X POST http://localhost:5000/api/imports -F "file=@data/demo-new-students.sql"
```

A successful request returns HTTP `202 Accepted` with an import job ID. Save this ID for the status request.

The current upload middleware accepts `.sql` files and enforces a configured file-size limit. Extension validation is not a substitute for safely validating the contents of an uploaded SQL file; use only trusted assessment files.

### Check import status

Replace `IMPORT_ID` with the ID returned by the upload endpoint:

```powershell
Invoke-RestMethod "http://localhost:5000/api/imports/IMPORT_ID" |
  ConvertTo-Json -Depth 5
```

The response includes status, total/processed/inserted/skipped/failed counts, timestamps, and progress percentage.

### List students

```powershell
Invoke-RestMethod "http://localhost:5000/api/students?page=1&limit=5" |
  ConvertTo-Json -Depth 5
```

### Search students

```powershell
Invoke-RestMethod "http://localhost:5000/api/students?search=pune&page=1&limit=5" |
  ConvertTo-Json -Depth 5
```

The current search covers student code, first name, last name, email, and college city. Pagination limits are validated by the API.

## Quick upload and duplicate test

A small test SQL file is useful for a live demo:

`server/data/demo-new-students.sql`

1. Upload it using the upload command above.
2. Copy the returned import ID.
3. Poll `GET /api/imports/IMPORT_ID` until the status is `completed` or `failed`.
4. Search for one of the new student codes through `/api/students`.
5. Upload the exact same file again.
6. Check the second job. If all records were inserted by the first upload and the data has not changed, the second import should report zero inserted and the records skipped as duplicates.

Example status command:

```powershell
Invoke-RestMethod "http://localhost:5000/api/imports/IMPORT_ID" |
  ConvertTo-Json -Depth 5
```

The sample SQL file must match the columns and format expected by the importer. Do not re-run the full 2-million-record dataset just to demonstrate the upload endpoint.

## How the backend works

1. Multer receives the uploaded SQL file and saves it to disk.
2. Express creates a row in `import_jobs`.
3. The API adds an import job to BullMQ, backed by Redis, and returns a job ID.
4. The worker consumes the job and invokes the import service.
5. The import service reads the file incrementally, loads records into a temporary staging table using PostgreSQL `COPY`, and inserts into `students`.
6. `ON CONFLICT DO NOTHING` skips records that conflict with primary-key or unique constraints.
7. The service updates record counts; the status endpoint reports the current job state and progress.

## Troubleshooting

- **API cannot connect to PostgreSQL:** Confirm Docker is running and the database port in `DATABASE_URL` is `5433`.
- **Worker cannot connect to Redis:** Confirm the Redis container is running and `REDIS_URL=redis://localhost:6379`.
- **`relation "students" does not exist`:** Apply `server/database/schema.sql`.
- **`relation "import_jobs" does not exist`:** Apply `server/database/import-jobs.sql`.
- **Upload returns connection refused:** Start the API server and confirm it listens on port `5000`.
- **Job remains queued:** Confirm the worker is running and check the worker terminal for errors.
- **Duplicate test reports skipped rows:** This is expected when the same student keys/codes were imported previously.
- **Initial dataset import conflicts:** Check whether the dataset has already been imported before running the standalone importer again.

## Notes for reviewers

- The current implementation is a backend-focused working stage; a React UI is pending.
- The initial 2-million-record dataset is a local setup/benchmark dataset. The upload endpoint can separately accept a new SQL file.
- Do not commit `.env`, uploaded files, database credentials, or large generated datasets unless the assessment explicitly requires them.
- Review and run the setup steps from the project root: `F:\PersonalProjects\Assessment\student-import-app`.
