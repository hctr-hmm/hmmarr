# Hmmarr backend

The Node.js server serves the built web interface, stores users in PostgreSQL, and proxies Radarr, Sonarr, Bazarr, and Prowlarr requests without exposing their API keys to the browser.

For setup and Docker instructions, see the [project README](../README.md). Local startup requires `DATABASE_URL` and a `HMMARR_SESSION_SECRET` of at least 32 characters. `HMMARR_BOOTSTRAP_USER` and `HMMARR_BOOTSTRAP_PASS` create the first user only when the users table is empty.

Routes:

- `GET /healthz`: public health check
- `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`: session login
- `GET /api/services`, `GET /api/services/:service/status`: configured services and health
- `GET /api/admin/users`, `POST /api/admin/users`, `DELETE /api/admin/users/:username`: user management
- `/api/proxy/:service/*`: authenticated media service proxy

Build the frontend from `frontend/` before running this server directly if you need the web interface. API tests use a mock database and a local mock upstream service.
