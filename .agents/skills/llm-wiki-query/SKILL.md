---
name: llm-wiki-query
description: >
  Use when any agent needs to retrieve a rule, entity definition, or
  coverage note from wiki/. Returns verbatim text with line numbers so
  the caller can cite the source.
---

# Skill: Wiki Query

## Purpose
`wiki/` is the living source of truth for business rules. Cite what is
actually written rather than what you remember.

## Usage patterns

### Look up a named rule
```bash
grep -n "submission-gating\|tenant-isolation\|plan-tier" wiki/
```

### Look up an entity
```bash
grep -n "Tenant\|Employee\|BenefitPlan" wiki/
```

### Get all rules at once
Read only the `## Business rules` section — stop before `## Why this file exists`.

### Full read
Read the wiki when complete context is needed (first run of a new session,
or calibrating code-reviewer). Use sparingly; targeted queries keep context
windows clean.

## Output contract
Return matched text **verbatim**, with line numbers. If nothing matches,
return `NOT_FOUND` — never guess or paraphrase. The caller cites the line
in its output so humans can verify the rule hasn't drifted.
