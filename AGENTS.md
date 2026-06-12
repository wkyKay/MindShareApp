# Repository Instructions

## Project Shape
- This repo is split into `react-app/` (Expo React Native frontend) and `backend-server/` (FastAPI + SQLAlchemy backend); the root `package.json` is not the frontend app manifest.
- Frontend entry is `react-app/index.ts`, which initializes i18n before registering `react-app/App.tsx`.
- Backend entry is `backend-server/app/main.py`; routers are registered under `/api/v1`, and `/uploads` serves `backend-server/uploads/`.

## Frontend Commands
- Run frontend commands from `react-app/`.
- Install/start: `npm install`, then `npm run start`; platform shortcuts are `npm run ios`, `npm run android`, and `npm run web`.
- Focused verification: `npm run typecheck` for strict TypeScript, or `npm run check` for typecheck plus untranslated-CJK i18n scan.
- `npm run i18n:scan` fails when untranslated CJK literals are found and writes `docs/i18n-untranslated-report.md`; use `npm run i18n:sync` only when intentionally adding missing locale keys.
- API base URL is `EXPO_PUBLIC_API_BASE_URL` when set, otherwise `react-app/src/config/api.ts` falls back to a LAN IP; update/env-set this for simulator or device testing.

## Backend Commands
- Run backend commands from `backend-server/`.
- Setup/start: `python -m venv venv`, `source venv/bin/activate`, `pip install -r requirements.txt`, then `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
- Focused verification: `python -m compileall app`.
- `DATABASE_URL` overrides the default SQLite database; without it the app uses `backend-server/forum.db`.
- `SECRET_KEY` defaults to `dev-only-change-me`; do not rely on that outside local development.

## Repo-Specific Gotchas
- There is no Alembic migration flow; `init_db()` calls `create_all()` and applies small SQLite schema updates in `backend-server/app/database.py`.
- Auth sessions are stored in frontend AsyncStorage under `auth.session.v1`; authenticated API calls use `Authorization: Bearer <access_token>`.
- Soft-deleted posts use `status = "deleted"`; favorites keep the relation, and deleted favorite cards must stay desensitized.
- Locale keys are currently the source Chinese strings with `keySeparator: false`; do not replace them with dotted key paths unless also changing the i18n tooling.
- The local pre-commit hook runs `react-doctor --staged --blocking warning` when available; the equivalent manual check is `cd react-app && npm run doctor` for a broader scan.
