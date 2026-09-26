# Hmmarr

A single web interface for Radarr, Sonarr, Bazarr, and Prowlarr. The interface includes sign-in, a service dashboard, and Radarr movie management: library, search and add, Discover, movie details, bulk editing, wanted lists, collections, download queue, release calendar, history, and blocklist. The System page shows status, health, and available storage details for all connected services. Sonarr's Series section includes a library, search and add, series settings, season and episode monitoring, searches, manual releases, missing episodes, queue, calendar, and history. Bazarr's Subtitles section includes movie and series libraries, language profiles, missing subtitle searches, manual search, subtitle uploads and deletion, wanted lists, history, and provider status. Prowlarr's Indexers section includes indexer and app management, release search and grabs, activity, statistics, and health.

## Run with Docker Compose

1. Create a root `.env` file with `POSTGRES_PASSWORD`, `HMMARR_SESSION_SECRET` (at least 32 characters), and `HMMARR_BOOTSTRAP_PASS` (at least 8 characters). `HMMARR_BOOTSTRAP_USER` defaults to `admin`. Generate secrets with `openssl rand -base64 32`.
2. Add the API keys for the media services you use: `RADARR_API_KEY`, `SONARR_API_KEY`, `BAZARR_API_KEY`, and `PROWLARR_API_KEY`. A missing key leaves that service unconfigured.
3. Set `MEDIA_NETWORK` to the Docker network shared by the media services. It defaults to `compose_default`. The service names in `docker-compose.yml` must resolve on that network; set `RADARR_URL`, `SONARR_URL`, `BAZARR_URL`, or `PROWLARR_URL` in `.env` if yours differ.
4. Run `docker compose up -d --build` and open port 3110 on this host. Sign in with the bootstrap credentials. Remove `HMMARR_BOOTSTRAP_PASS` from `.env` after the first user has been created.

The database remains in the `hmmarr-pgdata` Docker volume. The backend keeps media service API keys server-side and exposes authenticated same-origin proxy routes. Use HTTPS and set `HMMARR_SECURE_COOKIES=true` when serving Hmmarr through a reverse proxy.

## Development

The backend needs Node.js 22 or newer and PostgreSQL. Copy `backend/.env.example` to `backend/.env`, fill in the values, and run `npm ci` and `npm start` in `backend/`. For the frontend, run `npm ci` and `npm run dev` in `frontend/`; Vite forwards API calls to the backend on port 3000. `npm run build` writes the frontend into `backend/static/` for the backend to serve.

Run `npm test` in `backend/` and `npm run check` in `frontend/` to verify the current code.
