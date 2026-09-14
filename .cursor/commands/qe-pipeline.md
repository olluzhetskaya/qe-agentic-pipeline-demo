# QE e2e pipeline

You are the **coordinator**. Run the full requirement-to-automation pipeline
in this conversation. Sequential work is **skills** (shared context). Spawn
**subagents** only for isolated agents; they return a verdict to you — they
do not pick the next step.

Input: a Jira work item key (e.g. `KB-4821`). Use `$ARGUMENTS` if the user
supplied one; otherwise ask.

Do **not** skip human gates. Do **not** start Stage 1 until a designed case
exists under `data/`, `data/run-state.json` has `0e_xray_publish: pass`, and
every case has a non-null `xray_key`. Do **not** spawn a judge or `pr-drafter`
while `npm run gate:pipeline` (or the matching hook) is FAIL.

For every requirement-analysis handoff persist `analysis_decision` on
`data/requirement.json`. Isolated review verdicts include `Confidence: NN/100`
plus a rationale. The standing cutoff is 75 with `threshold_basis: "policy"`.
Confidence below that cutoff cannot PASS.
Before spawning an isolated judge, run `npm run verdict:context -- <agent>
<target>` and pass the JSON output as `REVIEW_CONTEXT`. The judge writes the
verdict artifact itself. After it returns, run `npm run verdict:check --
<agent> <target>`. Route only from that exit status. Never translate judge
prose into JSON. If evidence or a requested value does not exist, use `null`;
never invent it.

Update `data/run-state.json` when a stage completes so a compacted session
can resume from disk.

---

## Stage 0 — requirement to Xray

1. Apply `requirements-analysis` (`.agents/skills/requirements-analysis/SKILL.md`).
   Fetch via `acli`; ground in `wiki/`. Use `jira-cli`, `llm-wiki-query`,
   `llm-wiki-lint`; `llm-wiki-ingest` only to propose.
   Persist `type` + `grade` + `confidence` on each AC, plus
   `analysis_confidence` and `analysis_decision`, in `data/requirement.json`.
   Route from `analysis_decision.status`. Stop if `WAITING`.

2. Apply `test-objectives` (`.agents/skills/test-objectives/SKILL.md`).
   **Always stop for human go-ahead** before steps.

3. Apply `test-case-design` (`.agents/skills/test-case-design/SKILL.md`).
   Write the test-design artifact under `data/`. Wait for `afterFileEdit`
   hook PASS (schema + quality failure-modes). Do not spawn the judge while
   the hook is FAIL.

4. Spawn **`test-design-reviewer`** (`.agents/agents/test-design-reviewer.md`)
   as a subagent (fresh context). Give it the exact `REVIEW_CONTEXT`.
   It may write only that context's `output` verdict file. Require verdict
   confidence + rationale; absent references are `null`.
   Run `npm run verdict:check -- test-design-reviewer
   data/test-design.json`. Do not interpret its prose.
   - FAIL → re-apply `test-case-design`, then spawn the reviewer again.
   - PASS → show the summary table; wait for human confirmation before publish.

5. Spawn **`xray-publisher`** (`.agents/agents/xray-publisher.md`) only after
   that confirmation. One bounded search for `requirement_id`, then a local
   diff against `data/xray-index.json`. Propose only missing cases as one
   list; wait for one confirmation. Write `xray_key` values, then the
   catalogue (gitignored). Do not apply `test-generation` while any
   automatable case still has `"xray_key": null`.

---

## Stage 1 — design to code

6. Apply `test-generation` (`.agents/skills/test-generation/SKILL.md`) from
  the test-design artifact under `data/` plus `wiki/`. Use each case's
  `ac_text`. Do **not** open `data/requirement.json` or rewrite the ticket
  as Given/When/Then. Then `data-layer` (create missing fixtures, then use them),
   `explore-browser` (live scrape of locator candidates before POM write
   or locator repair), `locator-strategy`, `pom-builder`, `assertion-author`.
   Write under `src/tests/`. Hook must PASS (lint + quality per `test()`,
   not per file).

7. Spawn **`code-reviewer`** (`.agents/agents/code-reviewer.md`).
   Give it `REVIEW_CONTEXT` from `npm run verdict:context -- code-reviewer
   <spec>`.
   Calibrate against `golden_dataset/`. FAIL → fix via `test-generation`,
   spawn the reviewer again. Do not self-review. Require verdict and
   per-finding confidence; absent calibration mappings are `null`.
   Run `npm run verdict:check -- code-reviewer <spec>` and route only from
   its exit status.

8. Spawn **`pr-drafter`** (`.agents/agents/pr-drafter.md`) only after
   `stop` would PASS: pipeline gates plus hash-fresh judge PASS files.
   Draft only; never merge.

---

Standing rules (data layer, wiki, merge block, web-first assertions) stay
in `AGENTS.md` — this command is the workflow, that file is not.
