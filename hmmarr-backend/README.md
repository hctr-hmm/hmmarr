# hmmarr

A replacement WebUI for Radarr, Sonarr, Bazarr, and Prowlarr.

## Current state

- Authenticated REST proxy for all four applications
- Server-side upstream API keys
- HttpOnly cookie login and bearer-token support
- Service discovery and health/version probes
- Streaming uploads and binary downloads
- Zero runtime dependencies
- Dockerfile, Compose example, and tests

The Svelte frontend and realtime SignalR/WebSocket forwarding are next. See [backend/README.md](backend/README.md).
