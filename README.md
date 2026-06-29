# GDQ Watch Board

A small watch-party schedule board for Games Done Quick events.

## Local Development

```sh
bun install
bun run build
bun run server
```

Open `http://localhost:3000`.

## Runtime Configuration

- `PORT`: HTTP port, default `3000`
- `GDQ_EVENT_ID`: GDQ Tracker event id, default `66`
- `GDQ_TRACKER_BASE_URL`: GDQ Tracker API base URL, default `https://tracker.gamesdonequick.com/tracker/api/v2`
- `SCHEDULE_CACHE_MS`: Schedule cache duration, default `120000`

## Portainer

Use `deploy/portainer-stack.yml` after the GitHub Actions workflow publishes:

```yaml
image: ghcr.io/loldencode/gdq-cal:latest
```
