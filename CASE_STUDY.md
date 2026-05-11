# Case Study — Outreach Health CRM

Four moments from the 8-day build where the AI's first proposal was wrong
or risky and the actual decision matters more than the code.

- [1. The IPv6 bind that made Railway return 502](#ipv6-bind)
- [2. Approval workflow shipped behind a feature flag](#approval-flag)
- [3. Camp patients: option C — the middle-path schema decision](#camp-link)
- [4. The silent failure that shipped 9 commits of broken assumptions](#auto-migrate)

---

## <a id="ipv6-bind"></a>1. The IPv6 bind that made Railway return 502

**Situation.** Production deploy succeeded. Logs showed the app running.
Railway's healthcheck kept failing. `curl https://...railway.app` → 502
Bad Gateway. Local dev worked perfectly.

**What the AI initially proposed.** Add more retries to the healthcheck.
Lengthen the startup grace period. Wrap the Express app in a try/catch.
None of these were the actual problem.

**Why those were wrong.** They treated a connectivity failure as a
timing or error-handling failure. The app *was* running. The proxy
*couldn't reach it*. Adding retries to a connection that was never going
to succeed just moves the failure later.

**The actual decision.** Read the Railway proxy docs literally. Railway's
proxy speaks IPv4. Express's default `app.listen(port)` binds to all
interfaces resolved by the host's resolver, which on Railway's container
image preferred IPv6 (`::`). The fix:

```ts
app.listen(port, "0.0.0.0", () => { ... });
```

One literal string. Five-character commit.

**Outcome.** Healthcheck green within 30 seconds of redeploy. **Lesson:**
when the symptom is "proxy can't reach a running app," the question is
"what interface is it bound to," not "is it running."

---

## <a id="approval-flag"></a>2. Approval workflow shipped behind a feature flag

**Situation.** The foundation needed admin destructive actions (delete a
patient, change a medicine price) to require super-admin sign-off. But
the super-admin (the foundation owner) wasn't going to be available to
approve during the cutover week. The workflow had to ship without
immediately enforcing.

**What the AI initially proposed.** Two parallel route trees: keep the
old direct routes alive, add new approval routes alongside, switch the
frontend to call approval routes when ready. Three commits, two router
trees, two sets of tests.

**Why that was wrong.** It doubles the surface to test. Both code paths
have to be maintained until cutover. And — the killer — once you flip,
you have two routes that "work" for slightly different roles, which is
the exact configuration that produces six-months-later "why is this
admin's delete button still working?" bugs.

**The actual decision.** One set of routes. Routes always check
`requiresApprovalRouting(role)`, which returns `role === "admin" &&
ENV.approvalsEnforced`. With the flag off (default), admin direct
deletes go through as before. With the flag on, the same routes 400
with "Submit via approvals.request." The flag is a single env var on
Railway. No code change to enforce.

```ts
function requiresApprovalRouting(role: string): boolean {
  return role === "admin" && ENV.approvalsEnforced;
}
```

The frontend ships the request UI from day one — when the flag is off,
the server still permits the direct path the UI no longer offers.
Admins technically can't bypass via the UI; the flag is a belt around
the suspenders.

**Outcome.** Approval workflow shipped over ~9 commits (server + client).
Flag stays off until the super-admin tests it manually. Zero rollback
risk: flipping off the env var restores prior behavior with no code
change.

---

## <a id="camp-link"></a>3. Camp patients: option C — the middle-path schema decision

**Situation.** The foundation runs medical camps in addition to the
hospital. Camp patients are captured field-side on a paper-then-Excel
form: name, age, complaint, no IDs. Some are first-timers, some are
existing hospital patients walking into the camp. The foundation wants
to track *beneficiary continuity* — "did this person get treated for
the same thing six months ago at the hospital?" — but the camp form
doesn't have a patient ID at write time.

**The three options on the table.**

| Option | What it does | Cost |
|---|---|---|
| A. Standalone | `camp_patients` is its own island. No FK to `patients`. | Zero migration, zero continuity. |
| B. Full merge | Camp patients are written directly into `patients` with a flag. | Requires forcing patient-ID lookup at the camp's intake desk, which the camp staff explicitly said they couldn't do reliably. |
| C. Linked-but-nullable | `camp_patients.patientId` is a nullable FK to `patients`. Captured rows save without an ID; a background `findCandidate` route does phone + name fuzzy matching to fill it in later. | One column, one route, no behavioral change to the camp intake flow. |

**What the AI initially proposed.** Option B. "Just normalize it. One
patients table, one source of truth." Clean, textbook.

**Why that was wrong.** It assumed the camp staff could be retrained to
look up patient IDs at intake. They can't — half the camps are in areas
with no signal, and the volunteer running registration is a community
health worker, not a database operator. Forcing option B would either
create a stream of duplicate patients (volunteers picking the wrong
match under pressure) or grind the intake line to a halt. The data
model would be cleaner; the operational reality would be worse.

**The actual decision.** Option C. The camp keeps its existing capture
flow unchanged. Field workflow stays simple. The match work moves to a
deliberate, async, super-admin-reviewable step (the `findCandidate`
endpoint suggests candidates by phone + fuzzy name, the admin confirms
or rejects). One column added. One route added. Beneficiary continuity
is recoverable without forcing a schema-level merge that the operating
context can't sustain.

**Outcome.** Three commits, one weekend, no operational disruption.

**Meta-learning.** Picking the middle path is unglamorous but it's the
one that survives contact with the field. AI tooling defaults to
"normalize everything" because that's the textbook answer. The textbook
doesn't account for the volunteer at a folding table in Shah Faisal
Colony with no signal.

---

## <a id="auto-migrate"></a>4. The silent failure that shipped 9 commits of broken assumptions

**Situation.** A schema migration was added to `drizzle/`. The git
commit ran `drizzle-kit generate`, produced a clean SQL file, passed
review, was merged, deployed. The build succeeded. The container booted.
The app reported healthy. *Nothing actually applied the migration.*

Eight more commits stacked on top, all writing code that assumed the new
columns existed. Every PR review passed because the schema *in the
TypeScript* was correct. The reality drift only surfaced when a query
hit the missing column at runtime, after the feature had been
demonstrated to the foundation.

**What the AI initially proposed.** "Re-run the migration." Reasonable.
Except — it had been "running" on every deploy, in the AI's mental
model. The drizzle config was correct, the migration files were
correct, the schema.ts was correct. The AI's chain of reasoning never
checked *whether the deploy actually invoked `drizzle-kit migrate`*. It
assumed the toolchain closed the loop.

**Why that's the interesting bug.** The fix is one line of
`package.json`:

```diff
- "start": "node dist/index.js"
+ "start": "drizzle-kit migrate && node dist/index.js"
```

But the fix isn't the lesson. The lesson is the *failure mode*: the AI
generated code, generated migrations, generated commit messages, all
assuming infrastructure changes that **never executed**. The git tree
was internally consistent. The production database wasn't. Nine commits
sailed through review on internal consistency alone.

**The actual decision.** Two parts. First, the one-line fix to make
migrations run on every container boot. Second — and this is the
operating principle that came out of it — every time AI tooling claims
an infrastructure change happened ("ran the migration," "updated the
env var," "applied the schema"), I now manually verify the loop closed
*on the production system*, not on git. `git log` shows intent.
`SHOW TABLES` shows reality. They are not the same artifact.

**Outcome.** Schema drift caught and fixed in 30 minutes once the
"column not found" log line surfaced. Process change: the auto-migrate
step is now part of the container start command on every deploy. The
deeper fix is operational — I treat AI claims about external systems
as proposals to verify, not as completed work.

**Meta-learning.** AI will happily ship code that depends on
infrastructure changes the AI didn't actually make. The git tree looks
right because it *is* right — internally. The break is between the tree
and the system the tree assumes. Always close that loop manually until
the tooling proves it's closing it for you.
