# Outreach Health CRM — built in 8 days with Claude Code

A production hospital reception + medical-camps system for a community
health NGO in Pakistan. Patient registration, visit tracking, prescription
eligibility, inventory, medical-camp logistics, and an approval workflow
gating destructive admin actions.

**[ Live demo →](https://outreach-health-crm-demo.up.railway.app)** ·
**[ Case study →](./CASE_STUDY.md)** ·
**[ Architecture →](./ARCHITECTURE.md)**

> **Demo credentials** — none. The login screen exposes
> **Sign in as: Super-admin / Admin / Receptionist** buttons that mint a
> session directly. All data resets at 03:00 UTC daily.

## Why this exists

A community-health foundation was running 700+ patients out of Google
Sheets. Reception couldn't see prescription history at intake; admins
couldn't audit who deleted what. I replaced the sheets in 8 days with
Claude Code as my engineering partner. This repo is a synthetic-data
presentation of that build — the original commits and the foundation's
real data live privately.

## Feature scan

- **OAuth + RBAC** · three roles, super-admin can deactivate accounts at
  runtime
- **Approval workflow with feature flag** · admin destructive/major
  actions require super-admin sign-off; gated behind `APPROVALS_ENFORCED`
  so it ships dark and flips on after testing
- **Beneficiary continuity** · camp patients link back to the main
  `patients` table so repeat beneficiaries are tracked across hospital +
  camps
- **Offline import** · capture patients on an Excel template when the
  network drops, import when online
- **Staff session tracking** · login/logout, last-seen, per-user activity log
- **Pricing + audit trail** · every price change writes `price_history`;
  dashboard shows live inventory worth
- **Notifications** · bell + unread badge, fan-out on approval events
  and account-status changes
- **Demo mode** · `DEMO_MODE=true` swaps OAuth for role-switcher buttons,
  blocks role mutations, runs a nightly reset

## Decisions worth highlighting

- **[Approval workflow as a feature flag](./CASE_STUDY.md#approval-flag)** —
  zero-risk rollout: ship routes + UI, flip a single env var after testing
- **[Camp patients · option C](./CASE_STUDY.md#camp-link)** — linked-but-
  nullable FK over standalone records; async fuzzy match keeps camp
  intake simple in the field
- **[Auto-migrate on container start](./CASE_STUDY.md#auto-migrate)** —
  one-line fix to a silent-failure mode where AI tooling shipped 9
  commits assuming schema changes that hadn't applied to production

## Tech stack

React 18 · TypeScript · Tailwind · shadcn/ui · wouter · tRPC ·
Drizzle ORM · MySQL · Express · Google OAuth · Railway · node-cron

## Run locally

```bash
git clone https://github.com/<you>/outreach-health-crm
cd outreach-health-crm
cp .env.example .env       # fill in DATABASE_URL + Google OAuth client
pnpm install
pnpm db:push               # drizzle-kit generate + migrate
pnpm seed                  # ~60 patients, ~160 visits, 30 inventory, 30 medicines
pnpm dev
```

Any MySQL-compatible host works. See `.env.example` for every variable.

## How this was built

8 days · 58 commits in the original private repo · 8 schema migrations ·
Claude Opus 4.7 (1M context) as engineering partner · me reviewing every
patch and steering the architecture. Solo. Ship-it.

## Built by

**Osama Ahmed** — [GitHub](https://github.com/OssssamaAhmed)
