# Reddit Post Draft

Title:

```text
I made a self-hosted GDQ watch-party planner for Discord friend groups
```

Body:

```text
I built a small self-hosted app for planning Games Done Quick watch parties with friends.

You create a group slug, share the link in Discord, and up to 24 people can pick the runs they plan to watch. The page has two panes: the full schedule on the left and time-aligned per-person calendar lanes on the right so you can see gaps and overlaps across the group.

It is intentionally simple:
- no accounts
- no database
- one Docker container
- JSON persistence on a mounted volume
- configurable GDQ Tracker event id

Repo:
https://github.com/LoldenCode/gdq-cal

Docker image:
ghcr.io/loldencode/gdq-cal:latest

Example:
docker compose -f deploy/docker-compose.yml up -d

If you host it for a Discord server, share a link like:
https://your-domain.example/group/your-server-watch-party
```
