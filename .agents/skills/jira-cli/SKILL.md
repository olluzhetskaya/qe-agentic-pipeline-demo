---
name: jira-cli
description: Authenticate to a Jira site and interact with Jira tickets through Atlassian CLI (`acli`) instead of MCP. Use when the user wants to search, view, create, edit, transition, assign, or comment on Jira tickets, or otherwise work with Jira projects and boards through CLI.
---

# Jira CLI

Use Atlassian CLI for Jira Cloud workflows in this repo. Prefer `acli jira ...` over MCP-based Jira access. Use built-in agent tools for orchestration, local context gathering, and result formatting, but keep Jira auth and Jira reads or writes on `acli`.

## When To Use

Use this skill when the user asks to:

- authenticate to a Jira site, asking the user for the site URL when it is not already defined
- switch between Jira accounts or sites, asking for the target site URL when it is missing
- inspect Jira projects, work items, boards, filters, or sprints
- create, edit, assign, transition, comment on, or otherwise update Jira items through CLI

## Preconditions

1. Confirm `acli` is available before planning any Jira workflow.
2. If `acli` is not installed, stop and tell the user installation is required before proceeding.
Intallation links:
- MacOS: https://developer.atlassian.com/cloud/acli/guides/install-macos/
- Linux: https://developer.atlassian.com/cloud/acli/guides/install-linux/
- Windows: https://developer.atlassian.com/cloud/acli/guides/install-windows/
3. Treat this skill as Jira Cloud specific.

## Required Workflow

Follow this order:

1. Gather the target Jira site, prompting the user for the site URL when it is not already defined, and gather email if the workflow is account-specific.
2. Verify `acli` exists.
3. Check the current Jira auth state with `acli jira auth status`.
4. If not authenticated to the right site/account, authenticate or switch.
5. Run the requested Jira command family.
6. Summarize the result for the user without exposing secrets.

## Interoperability Rule

Treat `acli` as the source of truth for Jira state:

- use built-in tools to gather missing inputs, inspect local files, draft content, and summarize results
- use `acli jira ...` to authenticate, search, view, create, edit, transition, assign, or comment on Jira items
- do not replace a supported `acli` read or write flow with browser automation or an unrelated MCP
- if Context7 is available, use it only to look up tool or CLI documentation, not as the source of live Jira data

For specific Cursor and Claude Code tool mappings, read [references/interoperability.md](references/interoperability.md).

## Authentication

Default to browser auth when possible:

```bash
acli jira auth login --web
```

Use explicit site auth when the user provides a Jira host:

```bash
acli jira auth login --site "example.atlassian.net" --email "user@example.com" --token
```

Read tokens from standard input only. Never place secrets directly in chat, command history examples, or saved files.

## Session Validation

Check the active Jira account:

```bash
acli jira auth status
```

Switch to the correct account or site when needed:

```bash
acli jira auth switch --site "example.atlassian.net" --email "user@example.com"
```

Use logout only when the user explicitly asks for it:

```bash
acli jira auth logout
```

## Command Families

Use the narrowest command family that matches the request:

- `acli jira project ...` for project listing, inspection, and project administration
- `acli jira workitem ...` for issue search, view, creation, editing, transitions, comments, assignment, and linking
- `acli jira board ...` for board-related workflows
- `acli jira filter ...` for saved filter workflows
- `acli jira sprint ...` for sprint workflows
- `acli jira field ...` when field metadata is needed for create or edit operations

For a concise command map, read [references/command-map.md](references/command-map.md).

## Read-Only Default

Default to non-mutating commands unless the user explicitly asks for a write action.

Safe defaults include:

- auth status checks
- project list or view
- work item search or view
- board, sprint, field, and filter inspection

## Write Safety Rules

Require explicit user intent before any modifying command, including:

- `project create`, `project update`, `project delete`
- `workitem create`, `edit`, `assign`, `transition`, `link`
- `workitem comment-create`, `comment-update`, `attachment-*`
- `workitem archive`, `unarchive`, `delete`

Before mutating Jira state:

1. Confirm the target site or account is correct.
2. Confirm the target work item or project key is correct.
3. Restate the intended change briefly.
4. Execute the minimal command needed.

## Secret Handling

- Never ask the user to paste an API token into chat unless they explicitly choose to.
- Prefer browser auth for interactive sessions.
- If token auth is required, use stdin-based examples from [references/auth-and-safety.md](references/auth-and-safety.md).
- Never echo tokens back to the user.
- Never store tokens in repo files, skill assets, or generated notes.

## Communication

- Summarize the important Jira result in plain language.
- Include the exact command only when it helps the user.
- Redact or omit sensitive values.
- If the command fails, report the actionable error and the next fix to try.

## Additional Resources

- Auth and secret handling: [references/auth-and-safety.md](references/auth-and-safety.md)
- Jira command map: [references/command-map.md](references/command-map.md)
- Cursor and Claude Code interoperability: [references/interoperability.md](references/interoperability.md)
- Example workflows: [assets/example-workflows.md](assets/example-workflows.md)
