## Capstone Monorepo – Flask + React + Azure SQL

This is a minimal full-stack starter using:

- **Frontend**: React (Vite)
- **Backend**: Flask (blueprint-based, production-style layout)
- **Database**: Azure SQL / Microsoft SQL Server (via SQLAlchemy + pyodbc)


### Folder structure

- **backend/**: Flask application
  - **app/**: application package
    - `__init__.py`: application factory (`create_app`)
    - `config.py`: configuration (reads `DATABASE_URL`)
    - `extensions.py`: `SQLAlchemy`, `Migrate`, `CORS` instances
    - **routes/**
      - `__init__.py`: blueprint registration
      - `health.py`: `GET /api/health` → `{ "ok": true }`
    - **models/**
      - `__init__.py`
      - `user.py`: example `User` model
  - `run.py`: backend entrypoint (exposes `app` for Flask CLI)
  - `requirements.txt`: Python dependencies
  - `.env.example`: example environment configuration
- **frontend/**: Vite React app
- `docker-compose.yml`: SQL Server + backend + frontend for local dev
- `.gitignore`: repo-level ignore file

---

### Backend – setup & environment

From the repo root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env  # and edit values
```

#### DATABASE_URL configuration

The backend uses a single `DATABASE_URL` environment variable read from `backend/.env`.

- **Azure SQL (cloud example)**:

```bash
DATABASE_URL="mssql+pyodbc://YOUR_USER:YOUR_PASSWORD@yourserver.database.windows.net:1433/yourdatabase?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30"
```

- **Local SQL Server (Docker, host access)**:

```bash
DATABASE_URL="mssql+pyodbc://sa:Your_password123@localhost:1433/appdb?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=no&TrustServerCertificate=yes"
```

- **Local SQL Server (Docker, in-container access)**:

```bash
DATABASE_URL="mssql+pyodbc://sa:Your_password123@sqlserver:1433/appdb?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=no&TrustServerCertificate=yes"
```

Make sure the referenced database (`appdb` in these examples) exists or let your migrations create it.

---

### Flask app & health endpoint

- **App factory**: `backend/app/__init__.py` exposes `create_app()`.
- **Health route**: `GET /api/health` returns:

```json
{ "ok": true }
```

Run the backend directly (without Docker):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
flask run

```

---

### Example User model

Defined in `backend/app/models/user.py`:

- **id**: `Integer`, primary key
- **email**: `String(255)`, unique, non-null
- **created_at**: `DateTime`, non-null, defaults to `datetime.utcnow`

This model is included in the migration context via the app factory.

---

### Database migrations (Flask-Migrate / Alembic)

From `backend/` with `FLASK_APP=run.py` and your virtualenv active:

```bash
cd backend
export FLASK_APP=run.py  # or use your shell's equivalent

# 1. Initialize migrations (first time only)
flask db init

# 2. Generate a new migration after model changes
flask db migrate -m "create user model"

# 3. Apply migrations to the database
flask db upgrade
```

You can inspect the generated migration files in `backend/migrations/`.

---

### Frontend – Vite React app

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:5000` (see `vite.config.js`).

The default page calls `/api/health` and displays the JSON response and basic status state.

---

### Local development with Docker Compose

From the repo root:

```bash
cp backend/.env.example backend/.env  # and edit DATABASE_URL for Docker network
docker compose up --build
```

Services:

- **sqlserver**: `mcr.microsoft.com/mssql/server:2022-latest`, exposed on `1433`.
- **backend**: `python:3.12-slim`, serves Flask on `http://localhost:5000`.
- **frontend**: `node:20-alpine`, serves Vite dev on `http://localhost:5173`.

The backend container uses:

- `FLASK_APP=run.py`
- `flask db upgrade` (and `flask db init` / `flask db migrate` on first run) before starting `flask run`.

---

### Git hygiene

Key entries in `.gitignore`:

- **Node / frontend**: `node_modules/`, `dist/`, `build/`
- **Python / backend**: `.venv/`, `__pycache__/`, `*.py[cod]`
- **Env files**: `.env`, `backend/.env`, `frontend/.env`
- **Misc**: `.DS_Store`, editor folders

This keeps local dependencies, virtualenvs, and secrets out of version control.

