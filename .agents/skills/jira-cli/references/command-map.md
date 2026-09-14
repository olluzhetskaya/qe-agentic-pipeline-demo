# Jira CLI Command Map

Use the smallest Jira command family that matches the task.

## Auth

```bash
acli jira auth status
acli jira auth login --web
acli jira auth login --site "example.atlassian.net" --email "user@example.com" --token
acli jira auth switch --site "example.atlassian.net" --email "user@example.com"
acli jira auth logout
```

## Projects

Read-oriented:

```bash
acli jira project list
acli jira project view --help
```

Write-oriented:

```bash
acli jira project create --help
acli jira project update --help
acli jira project archive --help
acli jira project delete --help
```

## Work Items

Read-oriented:

```bash
acli jira workitem search --help
acli jira workitem view --help
acli jira workitem comment-list --help
acli jira workitem attachment-list --help
```

Write-oriented:

```bash
acli jira workitem create --help
acli jira workitem edit --help
acli jira workitem assign --help
acli jira workitem transition --help
acli jira workitem comment-create --help
acli jira workitem comment-update --help
acli jira workitem comment-delete --help
acli jira workitem link --help
acli jira workitem attachment-delete --help
acli jira workitem delete --help
```

## Other Jira Areas

Use these when the request is not primarily about a single work item:

```bash
acli jira board --help
acli jira filter --help
acli jira sprint --help
acli jira field --help
acli jira dashboard --help
```

## Selection Rules

- Use `project` when the target is a Jira project.
- Use `workitem` when the target is an issue, task, bug, story, or epic.
- Use `field` before create or edit flows when custom field names or IDs are unclear.
- Use `board` and `sprint` for agile planning data.
- Use `filter` when the user refers to saved searches or reusable JQL views.

## Safety Reminder

Anything that creates, edits, transitions, archives, or deletes Jira data needs explicit user intent first.
