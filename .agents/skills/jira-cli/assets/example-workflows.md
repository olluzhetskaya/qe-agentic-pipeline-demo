# Example Jira CLI Workflows

These are reference examples for the skill. Adjust flags to match the user request and the active Jira site.

## Authenticate To A Specific Jira Site

Preferred:

```bash
acli jira auth login --web
```

Site-specific token flow:

```bash
echo "$JIRA_API_TOKEN" | acli jira auth login --site "example.atlassian.net" --email "user@example.com" --token
```

## Verify Active Jira Context

```bash
acli jira auth status
```

If the wrong site or account is active:

```bash
acli jira auth switch --site "example.atlassian.net" --email "user@example.com"
```

## Inspect Projects

```bash
acli jira project list
```

If the user wants a specific project, inspect the command options first:

```bash
acli jira project view --help
```

## Search And View Work Items

Start with help when the exact search flags are unknown:

```bash
acli jira workitem search --help
acli jira workitem view --help
```

Typical flow:

1. Search for matching work items.
2. Pick the target key.
3. View the target work item.

## Hybrid Tooling Workflow

Use built-in agent tools around the CLI instead of replacing it:

1. Use structured prompts or local file reads to gather the Jira site, project key, or draft content.
2. Run `acli jira auth status`.
3. If needed, authenticate with `acli jira auth login --web`.
4. Fetch the target data with `acli jira ...`.
5. Summarize, group, or reformat the result with built-in tools.

Example:

1. Read a local release note draft with file tools.
2. Confirm the target issue key with the user.
3. Inspect `acli jira workitem comment-create --help`.
4. Post the approved comment once with `acli`.

## Update A Work Item

Only do this when the user explicitly asks for a Jira change.

Recommended flow:

1. Check `acli jira auth status`.
2. Confirm the target site and work item key.
3. Inspect the command shape with `acli jira workitem edit --help`.
4. Run the minimal update command.

## Transition A Work Item

Only do this with explicit user intent.

Recommended flow:

1. Confirm the work item key.
2. Inspect `acli jira workitem transition --help`.
3. Apply the requested transition.

## Comment On A Work Item

Use comments for user-requested status notes or handoff messages:

```bash
acli jira workitem comment-create --help
```

Before posting:

1. Confirm the target work item.
2. Confirm the comment text if the wording matters.
3. Post the comment once.

## High-Risk Actions

Treat these as high risk and require explicit confirmation of intent:

- project create, update, archive, delete
- workitem create, delete, archive, unarchive
- bulk creation or other multi-item mutations
