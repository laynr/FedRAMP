# AI development transcripts

Per the assignment's request to "submit your Claude/AI transcripts," these are the raw Claude
Code session logs from building OnRamp. They are the primary evidence of how the AI was
**directed, evaluated, and corrected** — the judgment story the brief evaluates.

## Files

| File | What it is |
|---|---|
| `claude-code-session-main.jsonl` | The main build session (v1 → v2 pivot → v3 hardening → OnRamp rebrand). ~2,150 messages. |

These are newline-delimited JSON (`.jsonl`) — one message per line — as written by Claude Code
under `~/.claude/projects/`. Each line has a `type` (`user` / `assistant`), `message` content,
and tool calls/results. To read them:

```bash
# human-skim the conversation (roles + first line of each message)
jq -r 'select(.type=="user" or .type=="assistant") | "\(.type): \(.message.content // .message | tostring | .[0:200])"' transcripts/claude-code-session-main.jsonl | less
```

## Moments worth jumping to (the judgment, not the typing)

- **The v1 → v2 teardown**: the owner reviewed a shipped, cited explainer and killed it as a
  "wall of text," pivoting to a tool. (Corroborated in git: commit `b7cf0f7` → `e075f7d`.)
- **The adversarial hardening pass**: three review agents turned loose on finished work found
  live XSS, a dead deploy pipeline, and a percentile off-by-one that had made the headline
  median wrong (361 → 327). All fixed before submission. (See `CLAUDE.md` lessons + `AGENTS.md`.)
- **Owner guardrails set against the AI**: cited-or-cut, no claims about any company's
  compliance posture, humble tone, and the deliberate choice to paraphrase rather than
  republish the assignment text.

The transcripts were captured from within the final session, so the very last few exchanges
(this export and the commit that follows) are not in `claude-code-session-main.jsonl`.
