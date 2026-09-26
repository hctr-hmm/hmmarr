# Hmmarr

Hmmarr brings a media stack into one web interface. Connect the services you use, sign in, and manage libraries, downloads, subtitles, requests, and service health without opening a separate tab for each app.

It runs as a Node.js web app with PostgreSQL. Docker Compose is the simplest way to run both. Media services are optional: Hmmarr starts with none connected and shows which ones still need configuration.

## What is included

| Area | What you can do |
| --- | --- |
| Dashboard | See library and queue counts, service status, health warnings, upcoming releases, and current Jellyfin playback. |
| Radarr | Browse and add movies; use Discover, collections, bulk editing, wanted, queue, calendar, history, and blocklist; inspect movie details and releases. |
| Sonarr | Browse and add series; manage series and episode monitoring; search releases; view missing episodes, queue, calendar, and history. |
| Bazarr | Browse subtitle libraries and wanted lists; manage language profiles; search, upload, and remove subtitles; view history and provider status. |
| Prowlarr | Manage indexers and apps; search and grab releases; inspect activity, statistics, and health. |
| qBittorrent | See transfer speeds and torrents; add links; pause, resume, recheck, reannounce, edit categories and file priorities, or remove torrents. |
| Seerr | Discover and search media, view details, submit requests, and review requests as a Hmmarr administrator. |
| Jellyfin | See who is watching, playback progress, device, and playback method. This integration is read-only. |
| System and Users | Inspect connected service details; manage accounts and change your own password. |

## Quick start with Docker Compose

You need Docker with Compose. Hmmarr listens on **port 3110** on the host. Its media-service network must already exist because Compose declares that network as external.

1. Choose a Docker network shared with your media services. If you already have one, use its name for `MEDIA_NETWORK`. To make a new one:

   ```sh
   docker network create hmmarr-upstreams
   ```

   Connect each media container you want Hmmarr to reach to that network. For example, if the container is named `radarr`:

   ```sh
   docker network connect hmmarr-upstreams radarr
   ```

2. Create `.env` beside `docker-compose.yml`. Start with these values and replace the examples with your own secrets:

   ```dotenv
   POSTGRES_PASSWORD=replace-with-a-long-url-safe-password
   HMMARR_SESSION_SECRET=replace-with-at-least-32-random-characters
   HMMARR_BOOTSTRAP_USER=admin
   HMMARR_BOOTSTRAP_PASS=replace-with-a-long-password
   MEDIA_NETWORK=hmmarr-upstreams

   RADARR_API_KEY=
   SONARR_API_KEY=
   BAZARR_API_KEY=
   PROWLARR_API_KEY=
   SEERR_API_KEY=
   JELLYFIN_API_KEY=
   ```

   Generate URL-safe database and session secrets with `openssl rand -hex 24` and `openssl rand -hex 32`, respectively. Use a unique password of at least 12 characters for the first account. Fill in only the service keys you have; the others can stay blank. The root `.env` is ignored by Git.

3. Start the app:

   ```sh
   docker compose up -d --build
   ```

4. Open [http://localhost:3110](http://localhost:3110) on the Docker host and sign in with `HMMARR_BOOTSTRAP_USER` and `HMMARR_BOOTSTRAP_PASS`. The first account is created only when the user database is empty. After signing in, remove `HMMARR_BOOTSTRAP_PASS` from `.env` and recreate Hmmarr to remove it from the container environment:

   ```sh
   docker compose up -d --no-deps --force-recreate hmmarr
   ```

The PostgreSQL data is stored in the `hmmarr-pgdata` Docker volume. Rebuilding the app container does not remove that volume or its accounts.

## Connect media services

Add each service's settings to the root `.env`. The defaults below are from `docker-compose.yml`; change a URL if its container name, port, or network is different. URLs must be reachable **from the Hmmarr container**, not just from your browser.

| Service | Required settings | Default URL in Compose |
| --- | --- | --- |
| Radarr | `RADARR_API_KEY` | `RADARR_URL=http://radarr:7878` |
| Sonarr | `SONARR_API_KEY` | `SONARR_URL=http://sonarr:8989` |
| Bazarr | `BAZARR_API_KEY` | `BAZARR_URL=http://bazarr:6767` |
| Prowlarr | `PROWLARR_API_KEY` | `PROWLARR_URL=http://prowlarr:9696` |
| Seerr | `SEERR_API_KEY` | `SEERR_URL=http://seerr:5055` |
| Jellyfin | `JELLYFIN_API_KEY` | `JELLYFIN_URL=http://host.docker.internal:8096` |
| qBittorrent | `QBITTORRENT_URL` and an authentication option below | No URL is set by default |

For qBittorrent, use either `QBITTORRENT_API_KEY` or both `QBITTORRENT_USERNAME` and `QBITTORRENT_PASSWORD`. An example URL is `http://qbittorrent:8081`. Leave `QBITTORRENT_URL` unset if you are not connecting it.

For Jellyfin, create an API key in **Jellyfin Dashboard → API Keys**. The Compose default reaches a Jellyfin server running on the Docker host through `host.docker.internal`; set `JELLYFIN_URL` to a different address if needed.

After changing `.env`, recreate the app container so it reads the new values:

```sh
docker compose up -d --no-deps --force-recreate hmmarr
```

A service without the required credentials appears as **Not configured**. Hmmarr keeps those credentials on the server; the browser calls Hmmarr's authenticated API instead of calling the services with their keys.

## Accounts and access

The first account is an administrator. In **Users**, an administrator can create other accounts, reset their passwords, and remove them. Every signed-in user can manage connected media services and change their own password. Only administrators can manage accounts and moderate Seerr requests.

Passwords created or changed in **Users** must be 12–256 characters. Changing or resetting a password signs out that account's other sessions. Session cookies are HTTP-only and expire after seven days by default.

If you serve Hmmarr behind an HTTPS reverse proxy, set `HMMARR_SECURE_COOKIES=true` in `.env` and recreate the container. Keep it `false` when using plain HTTP locally, or the browser will not send the secure session cookie.

## Health and troubleshooting

```sh
docker compose ps
docker compose logs -f hmmarr
curl -fsS http://localhost:3110/healthz
```

| Symptom | Check |
| --- | --- |
| Compose says the external network does not exist | Create the network named by `MEDIA_NETWORK`, or point it at an existing network shared with your media containers. |
| A service says **Not configured** | Check its key or qBittorrent credentials in `.env`, then recreate Hmmarr. |
| A service says **Offline** | Check its URL and port from inside the Docker network, and confirm the media service is running. |
| Sign-in fails on a new installation | Check that `HMMARR_BOOTSTRAP_PASS` was set on the first start and look for `bootstrap_user_created` in the logs. Bootstrap settings do not reset an existing account. |
| Posters or Jellyfin artwork are empty | Confirm that the source service has artwork and Hmmarr can reach it; check the service's status in **System** and the Hmmarr logs. |

## Local development

Use Node.js **22 or newer** and a running PostgreSQL database. The backend does not load `.env` automatically, so pass it to Node explicitly:

```sh
cp backend/.env.example backend/.env
# Edit backend/.env: set DATABASE_URL and HMMARR_SESSION_SECRET,
# use URLs reachable from your machine, and leave unused service keys blank.
cd backend
npm ci
node --env-file=.env src/server.js
```

In another terminal, start the frontend:

```sh
cd frontend
npm ci
npm run dev
```

Vite serves the development UI on port 5173 and forwards `/api` and `/healthz` to the backend on port 3000. For a production build, run `npm run build` in `frontend/`; it writes the static files to `backend/static/` for the backend to serve.

Verification commands:

```sh
npm --prefix backend test
npm --prefix frontend run check
```

See [backend/README.md](backend/README.md) for a short overview of the server routes.
