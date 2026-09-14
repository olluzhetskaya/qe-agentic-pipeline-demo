# Jira CLI Interoperability

Use this reference when the agent has both Atlassian CLI and built-in coding-agent tools available.

## Core Rule

Keep the split clear:

- built-in tools gather context, inspect local files, draft content, and format results
- `acli jira ...` performs Jira authentication and Jira data access
- browser automation is a fallback for interactive auth or explicit UI validation, not the default Jira API path

## Cursor Tool Mapping

Preferred usage in Cursor:

- `AskQuestion`: collect missing site, email, project key, issue key, or explicit confirmation before Jira writes
- `Shell`: run every `acli jira ...` command
- `ReadFile`: inspect local notes, templates, changelogs, or text the user wants posted to Jira
- `ApplyPatch` or file edit tools: update local helper docs, templates, or scripts that support the Jira workflow
- `ReadLints`: validate edited helper files when you changed local automation around Jira usage
- `CallMcpTool`: use non-Jira MCPs only when they add value around the Jira task
- `Subagent`: parallelize large read-only analysis after Jira data is fetched
- browser MCP tools: useful for OAuth login or page-level verification when the user asks for UI confirmation

## Claude Code Tool Mapping

Typical Claude Code equivalents:

- `Bash`: run every `acli jira ...` command
- `AskUserQuestion` (Claude Code): collect missing site, email, project key, issue key, or explicit confirmation before Jira writes
- `Read` and `Edit`: inspect or prepare local content that will later be used in Jira
- `Glob` and `Grep`: locate templates, helper scripts, or local references related to the Jira task
- `WebFetch`: read public docs when command syntax or product behavior needs confirmation
- `Task`: delegate broad analysis or multi-ticket summarization after the Jira data has already been collected

If the exact tool surface differs by environment, keep the same division of responsibility: native tools handle orchestration and local context, while `acli` handles Jira operations.

## Recommended Hybrid Workflow

1. Use built-in tools to gather missing user inputs and inspect any local context that matters.
2. Verify `acli` is installed.
3. Check `acli jira auth status`.
4. Authenticate or switch accounts if needed.
5. Inspect `--help` for the narrow Jira command family if the flag shape is unclear.
6. Run the minimal `acli jira ...` command needed.
7. Use built-in tools again to summarize, group, or transform the result for the user.

## Safe Patterns

- Use local file tools to draft a Jira comment, then post it with `acli jira workitem comment-create` only after explicit user approval.
- Use search or analysis tools to group many issues by priority, assignee, or area after fetching them with `acli jira workitem search`.
- Use browser-based auth when token handling would be less safe or less convenient.

## Avoid

- reading live Jira data from an alternate source when `acli` can fetch it directly
- performing Jira writes through browser automation when `acli` already supports the action
- asking the user for a token in chat when browser auth is viable
- mixing local draft content and Jira writes without confirming the target issue and intended change

## Documentation Lookup

If Context7 is enabled in the environment:

- use it to look up Cursor tool docs, Claude Code tool docs, or `acli` examples
- do not treat it as a live Jira backend
- prefer the actual tool schema and `--help` output over memory when the command surface matters
