# GDQ Watch Party Planner

A small self-hosted planner for Games Done Quick watch parties in Discord servers.

Create a long-lived group slug, share the link, let friends choose the runs they plan to watch, and compare everyone's schedule in a two-pane view: schedule rows on the left, waterfall timeline on the right.

## What It Does

- Durable group links like `https://gdq.example.com/group/discord-watch-party`
- Up to 24 planners per group
- Each person owns their own selected watch schedule
- Optional per-person passwords for casual protection, blank by default
- Full GDQ schedule as selectable rows
- Waterfall chart showing when each person plans to watch
- Server-side JSON persistence across container redeploys
- No accounts, no external database, no Discord bot required
- Docker image published to GitHub Container Registry

## Quick Start

```sh
docker compose -f deploy/docker-compose.yml up -d
```

Open:

```text
http://localhost:3000/group/my-discord-watch-party
```

For Portainer, use `deploy/portainer-stack.yml`.

For Traefik, use `deploy/traefik-stack.yml` and change:

```yaml
traefik.http.routers.gdq-watch-party.rule=Host(`gdq.example.com`)
```

## Sharing With Friends

1. Open a shared group link or pick a readable group slug, such as `my-server-agdq`.
2. Enter your display name and join the group.
3. Optionally enter a password if you want to protect that name from casual edits.
4. Select the runs your group plans to watch.
5. Copy the canonical `/group/my-server-agdq` group link and share it in Discord.
6. Friends open the same link, join with their own names, and select their schedules.

The link is long-lived as long as the mounted data volume is preserved.

## Runtime Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port inside the container |
| `GDQ_EVENT_ID` | `66` | GDQ Tracker event id |
| `GDQ_TRACKER_BASE_URL` | `https://tracker.gamesdonequick.com/tracker/api/v2` | Tracker API base URL |
| `SCHEDULE_CACHE_MS` | `120000` | Schedule cache duration |
| `DATA_FILE` | `data/watch-plans.json` | JSON file for shared watch-party plans |
| `ADMIN_KEY` | unset | Enables `/admin/` and protects admin APIs with this password |

## Data Persistence

Mount a volume at `/data` and set:

```yaml
environment:
  DATA_FILE: /data/watch-plans.json
  ADMIN_KEY: change-me
volumes:
  - gdq_watch_party_data:/data
```

Do not delete this volume if you want group links to keep working weeks later.

## Admin

Set `ADMIN_KEY`, then open `/admin/` and enter that value to list every group, review members, and remove people. Public planner pages do not expose member removal.

## Local Development

```sh
bun install
bun run test
bun run build
bun run server
```

Open `http://localhost:3000`.

## Publishing Your Own Image

The included GitHub Actions workflow publishes this repository to:

```text
ghcr.io/loldencode/gdq-cal:latest
```

If you fork the repo, update `.github/workflows/publish.yml` and your Compose files to use your own GHCR namespace. If you want Portainer or another host to pull without logging in, make the GHCR package public in GitHub's package settings.

## License

MIT
