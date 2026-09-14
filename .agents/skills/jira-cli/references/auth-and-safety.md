# Jira Auth And Safety

Use Atlassian CLI auth commands for Jira Cloud sessions.

## Preferred Auth Flow

Use browser auth for interactive local work:

```bash
acli jira auth login --web
```

This is the safest default because it avoids copying tokens into the chat flow.

## Token Auth Flow

Use token auth only when browser auth is not suitable.

```bash
acli jira auth login --site "example.atlassian.net" --email "user@example.com" --token < token.txt
```

Or:

```bash
echo "$JIRA_API_TOKEN" | acli jira auth login --site "example.atlassian.net" --email "user@example.com" --token
```

Guidance:

- Use stdin for the token.
- Do not place the token as a literal CLI argument.
- Do not save the token in repo files.
- Do not print the token in chat output or command summaries.

## Status And Switching

Check the active Jira account:

```bash
acli jira auth status
```

Switch to a different Jira account or site:

```bash
acli jira auth switch --site "example.atlassian.net" --email "user@example.com"
```

Use `--site` when the site matters most. Use `--email` when the site is shared across multiple accounts.

## Logout

Only log out when the user explicitly requests it:

```bash
acli jira auth logout
```

## Safety Rules

- Confirm the target Jira site before write operations.
- Prefer `auth status` before destructive or high-impact commands.
- Treat `delete`, `archive`, bulk edits, and project mutations as high risk.
- Default to read-only commands unless the user clearly requested a change in Jira.
- If a command needs sensitive input, keep that input out of persistent repo files and examples.

## Troubleshooting

- If `acli` is missing, stop and ask the user to install Atlassian CLI first.
- If `auth status` shows the wrong site, use `auth switch` before running Jira commands.
- If authentication fails, retry with the correct site hostname, email, and auth method.
