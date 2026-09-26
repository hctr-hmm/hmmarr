# Hmmarr backend

The Node.js server serves the built web interface, stores users in PostgreSQL, and connects to Radarr, Sonarr, Bazarr, Prowlarr, qBittorrent, Seerr, and Jellyfin without exposing their credentials to the browser.

For setup and Docker instructions, see the [project README](../README.md). Local startup requires `DATABASE_URL` and a `HMMARR_SESSION_SECRET` of at least 32 characters. `HMMARR_BOOTSTRAP_USER` and `HMMARR_BOOTSTRAP_PASS` create the first user only when the users table is empty.

Routes:

- `GET /healthz`: public health check
- `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/password`: account sessions and own-password changes
- `GET /api/services`, `GET /api/services/:service/status`: configured services and health
- `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/:username/password`, `DELETE /api/admin/users/:username`: administrator-only user management
- `/api/proxy/:service/*`: authenticated media service proxy
- `/api/qbittorrent/:group/:action`: allowlisted qBittorrent Web API actions using server-side authentication
- `POST /api/seerr/request`: validated Seerr request submission for authenticated users; Seerr moderation via the proxy requires a Hmmarr administrator
- `GET /api/jellyfin/now-watching`, `GET /api/jellyfin/images/:id`: authenticated, read-only playback summaries and artwork

Build the frontend from `frontend/` before running this server directly if you need the web interface. API tests use a mock database and a local mock upstream service.
