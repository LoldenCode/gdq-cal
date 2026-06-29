# GDQ Watch Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a containerized GDQ schedule webapp for a friend group watching events at `gdq.lolden.xyz`.

**Architecture:** A React/Vite frontend renders now/up-next/later schedule sections. A small Node HTTP server serves the built frontend and proxies/caches GDQ tracker API data from an event id configured by environment variable.

**Tech Stack:** Bun for local install/build, React, TypeScript, Vite, Node runtime in Docker, GitHub Actions publishing to GHCR.

---

### Task 1: Scaffold App

**Files:**
- Create: `package.json`, `index.html`, `src/*`, `server/*`

- [ ] Create the Vite React app files with schedule UI and API client.
- [ ] Create the Node server with `/api/schedule` and static file serving.
- [ ] Add `Dockerfile`, `.dockerignore`, and GHCR workflow.
- [ ] Build locally with `bun run build`.
- [ ] Initialize git, create `LoldenCode/gdq-cal`, push `main`, and let Actions publish `ghcr.io/loldencode/gdq-cal:latest`.

### Task 2: Deploy

**Files:**
- Create: `deploy/portainer-stack.yml`

- [ ] Add a Portainer stack using `ghcr.io/loldencode/gdq-cal:latest`.
- [ ] Use `porty_default`, entrypoint `https`, service port `3000`, and temporary host port `18080`.
