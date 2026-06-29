# GDQ Watch Party Planner

A small self-hosted planner for Games Done Quick watch parties. Create a long-lived group slug, share the link in Discord, let up to six friends pick the runs they plan to watch, and compare everyone in a two-pane schedule plus waterfall timeline.

## Features

- Durable group links like `https://gdq.example.com/?group=discord-watch-party`
- Up to six planners per group
- Left pane with the GDQ run schedule as selectable rows
- Right pane with a waterfall chart showing when each person plans to watch
- Server-side JSON persistence for container redeploys
- Docker image published to GitHub Container Registry

## Local Development

```sh
bun install
bun run test
bun run build
bun run server
```

Open `http://localhost:3000`.

## Sharing

1. Pick a readable group slug.
2. Enter your display name and join the plan.
3. Select the runs you plan to watch.
4. Copy the group link and share it in Discord.
5. Friends open the same link, join with their own names, and select their schedules.

## Runtime Configuration

- `PORT`: HTTP port, default `3000`
- `GDQ_EVENT_ID`: GDQ Tracker event id, default `66`
- `GDQ_TRACKER_BASE_URL`: GDQ Tracker API base URL, default `https://tracker.gamesdonequick.com/tracker/api/v2`
- `SCHEDULE_CACHE_MS`: Schedule cache duration, default `120000`
- `DATA_FILE`: JSON file for shared watch-party plans, default `data/watch-plans.json`

## Portainer

Use `deploy/portainer-stack.yml` after the GitHub Actions workflow publishes:

```yaml
image: ghcr.io/loldencode/gdq-cal:latest
```
