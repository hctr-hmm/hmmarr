# Hmmarr backend

Zero-dependency Node.js API gateway for Radarr, Sonarr, Bazarr, and Prowlarr. It keeps upstream API keys server-side and exposes each service below a same-origin proxy path.

## Run

```sh
cp backend/.env.example backend/.env
set -a; . backend/.env; set +a
node backend/src/server.js
```

```sh
docker build -t hmmarr .
docker run --rm -p 3000:3000 --env-file backend/.env hmmarr
```

Set `HMMARR_SECURE_COOKIES=true` when served over HTTPS.

## Routes

- `GET /healthz`: public container health check
- `GET /api/auth/status`: authentication state
- `POST /api/auth/login`: exchange `{ "token": "..." }` for an HttpOnly cookie
- `POST /api/auth/logout`: clear session
- `GET /api/services`: configured services, without secrets
- `GET /api/services/:service/status`: upstream connectivity/version
- `ANY /api/proxy/:service/*`: authenticated transparent REST proxy

```sh
curl -H "Authorization: Bearer $HMMARR_AUTH_TOKEN" http://localhost:3000/api/proxy/radarr/api/v3/movie
```

The proxy supports JSON, binary responses, range requests, and streaming request bodies. It strips caller-supplied upstream keys and injects the configured key server-side.

Startup fails unless `HMMARR_AUTH_TOKEN` is set. `HMMARR_ALLOW_INSECURE=true` is only for isolated development. Realtime SignalR/WebSocket forwarding will come with the Svelte integration.
