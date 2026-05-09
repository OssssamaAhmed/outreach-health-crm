# Outreach Health CRM

A role-based hospital reception and medical-camp management system.

> **This README is a placeholder.** The full recruiter-facing README — with
> live-demo URL, feature scan, architectural decisions, case studies, and
> tech stack — lands in a later commit on this branch.

## Run locally

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL + Google OAuth client
pnpm db:push
pnpm seed
pnpm dev
```

## Status

This commit is the cleaned codebase initialized from a private build. The
synthetic seed generator, `DEMO_MODE` flag, daily reset cron, and full
documentation arrive in subsequent commits.
