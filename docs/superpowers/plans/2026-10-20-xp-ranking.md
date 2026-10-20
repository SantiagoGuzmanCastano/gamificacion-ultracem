# XP and Advisor Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a database-backed advisor XP value and ranking without introducing a new table.

**Architecture:** Keep `mvp_profiles`, `mvp_clients`, and `mvp_tasks` as the source of truth. Each completed task contributes 10 XP; a protected Supabase RPC aggregates completed tasks by advisor, so deleting tasks or clients automatically removes their contribution. The frontend loads and displays the ranking in both role-specific dashboards.

**Tech Stack:** Vite, vanilla JavaScript, Supabase JS, PostgreSQL RPC, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-xp-ranking-design.md`

## Global Constraints

- XP is fixed at 10 per completed task.
- No new XP table is added.
- Only authenticated users can request the ranking.
- The frontend cannot edit XP directly.
- Deleting a task or client removes its XP contribution; other client points remain.

## Review Focus

- No advisors exist: both dashboards show a clear empty ranking state.
- All tasks are pending: XP is zero and the ranking remains valid.
- A task is completed: XP increases by exactly 10.
- A task is deleted: only its 10 XP contribution disappears.
- A client is deleted: only that client’s task XP disappears.
- Ranking RPC is called anonymously: the database rejects the call.

### Task 1: Add protected ranking RPC

**Files:**
- Create: `supabase/migrations/20261020000005_advisor_ranking.sql`
- Modify: none
- Test: Supabase SQL verification query

**Interfaces:**
- Produces: `public.get_mvp_advisor_ranking()` returning `advisor_id`, `full_name`, `completed_tasks`, `xp`, and `position`.

- [ ] **Step 1: Write the migration**

Create a `security definer` function with an empty search path that rejects anonymous calls, aggregates completed `mvp_tasks` through `mvp_clients`, orders by XP descending then name, and grants execute only to `authenticated`. Keep the fixed XP multiplier as the SQL constant `10`.

- [ ] **Step 2: Apply the migration**

Run it against project `iynwzclstiusgxxevmlp` with the Supabase migration tool.

- [ ] **Step 3: Verify permissions and shape**

Query `pg_proc` for execute privileges and call the RPC from an authenticated context when test accounts are available. Confirm anonymous execution is false.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261020000005_advisor_ranking.sql
git commit -m "feat: add advisor XP ranking rpc"
```

### Task 2: Load ranking data in the application

**Files:**
- Modify: `src/main.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `db.rpc('get_mvp_advisor_ranking')`.
- Produces: module state `ranking`, with rows `{ advisor_id, full_name, completed_tasks, xp, position }`.

- [ ] **Step 1: Add the pure XP calculation test**

Add assertions that a completed-task count of 0, 1, and 4 maps to 0, 10, and 40 XP, and that task deletion lowers the calculated contribution.

- [ ] **Step 2: Implement ranking loading**

Initialize `ranking` as an empty array and load it after the authenticated profile and clients. Surface RPC errors through the existing notice/error path instead of rendering stale values as current data.

- [ ] **Step 3: Run the unit test**

Run `npm test`; it must pass before UI changes continue.

### Task 3: Render XP and ranking in both dashboards

**Files:**
- Modify: `src/main.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `ranking` from Task 2.
- Produces: an XP metric and a ranking section in admin and advisor views.

- [ ] **Step 1: Add ranking rendering**

Render ordered rows with position, advisor name, completed task count, and XP. Show a concise empty state when no advisors have data. Highlight the signed-in advisor’s row in the advisor view.

- [ ] **Step 2: Add XP to current metrics**

Admin metrics show total XP; advisor metrics show that advisor’s XP and position. Keep existing client/task metrics unchanged.

- [ ] **Step 3: Style the ranking**

Add responsive styles consistent with the current green/neutral visual system. Ensure the ranking does not overflow at mobile widths.

- [ ] **Step 4: Build and inspect**

Run `npm run build` and inspect the local dashboard for empty, zero-XP, and populated ranking states.

### Task 4: Verify deletion semantics and document the feature

**Files:**
- Modify: `DECISIONES.md`
- Modify: `README.md`
- Test: Supabase SQL verification queries

- [ ] **Step 1: Verify task deletion semantics**

Confirm that deleting a task reduces only its advisor’s aggregate by 10 and that deleting a client removes only that client’s contribution.

- [ ] **Step 2: Run the full checks**

Run `npm test`, `npm run build`, and `git diff --check`.

- [ ] **Step 3: Document the final behavior**

Record the fixed XP value, ranking source, and deletion rule in the project documentation.

- [ ] **Step 4: Commit**

```bash
git add src/main.js src/style.css tests/game.test.js README.md DECISIONES.md supabase/migrations/20261020000005_advisor_ranking.sql
git commit -m "feat: add advisor XP and ranking"
```
