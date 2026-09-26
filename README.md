# Hmmarr

A single web interface for Radarr, Sonarr, Bazarr, Prowlarr, qBittorrent, and Seerr. The interface includes multi-user sign-in, a Users page for account management, a dashboard with service activity, health warnings, and upcoming releases, and Radarr movie management: library, search and add, Discover, movie details, bulk editing, wanted lists, collections, download queue, release calendar, history, and blocklist. The System page shows status, health, and available storage details for all connected services. Sonarr's Series section includes a library, search and add, series settings, season and episode monitoring, searches, manual releases, missing episodes, queue, calendar, and history. Bazarr's Subtitles section includes movie and series libraries, language profiles, missing subtitle searches, manual search, subtitle uploads and deletion, wanted lists, history, and provider status. Prowlarr's Indexers section includes indexer and app management, release search and grabs, activity, statistics, and health. qBittorrent's Torrents section includes transfer speeds, filtering, adding links, pause and resume, category editing, file priority, recheck, reannounce, and removal. Seerr's Requests section includes discovery, search, media details, submitting requests, and administrator review.

## Run with Docker Compose

Jellyfin's **Now watching** page and dashboard panel show active viewers, playback progress, client devices, and whether playback is paused or transcoding. Jellyfin remains read-only in Hmmarr.

1. Create a root `.env` file with `POSTGRES_PASSWORD`, `HMMARR_SESSION_SECRET` (at least 32 characters), and `HMMARR_BOOTSTRAP_PASS` (at least 8 characters). `HMMARR_BOOTSTRAP_USER` defaults to `admin`. Generate secrets with `openssl rand -base64 32`.
2. Add the API keys for the media services you use: `RADARR_API_KEY`, `SONARR_API_KEY`, `BAZARR_API_KEY`, and `PROWLARR_API_KEY`. A missing key leaves that service unconfigured. To connect qBittorrent, set `QBITTORRENT_URL=http://qbittorrent:8081` and either `QBITTORRENT_API_KEY` (qBittorrent 5.2+) or both `QBITTORRENT_USERNAME` and `QBITTORRENT_PASSWORD`. To connect Seerr, set `SEERR_API_KEY`; `SEERR_URL` defaults to `http://seerr:5055` in Docker Compose.
   To show Jellyfin playback, set `JELLYFIN_API_KEY` from Jellyfin's Dashboard → API Keys. Compose uses `http://host.docker.internal:8096` by default because this Jellyfin instance uses host networking; set `JELLYFIN_URL` if yours differs.
3. Set `MEDIA_NETWORK` to the Docker network shared by the media services. It defaults to `compose_default`. The service names in `docker-compose.yml` must resolve on that network; set `RADARR_URL`, `SONARR_URL`, `BAZARR_URL`, or `PROWLARR_URL` in `.env` if yours differ.
4. Run `docker compose up -d --build` and open port 3110 on this host. Sign in with the bootstrap credentials. Remove `HMMARR_BOOTSTRAP_PASS` from `.env` after the first user has been created.

The database remains in the `hmmarr-pgdata` Docker volume. The backend keeps media service API keys server-side and exposes authenticated same-origin proxy routes. Use HTTPS and set `HMMARR_SECURE_COOKIES=true` when serving Hmmarr through a reverse proxy.

The first account is the administrator. Open **Users** to add other accounts, reset their passwords, or remove them. All signed-in users can change their own password; only the administrator can manage accounts. New and changed passwords must have 12–256 characters. Updating from an older Hmmarr version signs everyone out once because sessions are now tied to individual accounts.

## Development

The backend needs Node.js 22 or newer and PostgreSQL. Copy `backend/.env.example` to `backend/.env`, fill in the values, and run `npm ci` and `npm start` in `backend/`. For the frontend, run `npm ci` and `npm run dev` in `frontend/`; Vite forwards API calls to the backend on port 3000. `npm run build` writes the frontend into `backend/static/` for the backend to serve.

Run `npm test` in `backend/` and `npm run check` in `frontend/` to verify the current code.
