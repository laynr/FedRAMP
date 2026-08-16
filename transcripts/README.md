# AI development transcripts

Per the assignment's request to "submit your Claude/AI transcripts," these are the Claude Code
session exports from building OnRamp — evidence of how the AI was directed, evaluated,
and corrected.

## Files

| File | What it is |
|---|---|
| `claude-code-session-main.jsonl` | The main build session, 09:45–13:23 (v1 → v2 pivot → v3 hardening → OnRamp rebrand). |
| `claude-code-session-evening-hardening.jsonl` | A ~6-minute session around the evening commits (20:56–21:02). |
| `claude-code-session-integrity.jsonl` | A submission review followed by the resulting fixes. |
| `codex-hardening-session.md` | Author-written summary of the evening Codex hardening pass. **Not a transcript** — see below. |
| `codex-combined-audit-session.md` | Summary of the final combined audit, repairs, and verification. **Not a transcript.** |

The `.jsonl` files are Claude Code exports from sessions that contributed to the implementation
or submission-integrity fixes. Non-development sessions are outside this inventory. The `codex-*.md`
files are written summaries of Codex sessions; they are not raw Codex transcripts.

## What these logs are — and are not

Inventory and capture limits:

- `claude-code-session-main.jsonl` has 2,156 lines, but most are harness bookkeeping. The
  actual conversation is ~953 messages (615 assistant, 338 user-type records — of which 305
  are tool results). **Genuine typed human prompts: about 15.**
- **Subagent transcripts are not captured.** The parallel review agents described in
  RATIONALE.md appear here only as task-notification stubs; their internal reasoning is not
  in these files.
- **The evening hardening pass ran mostly in Codex, a tool whose raw log was not retained.**
  `codex-hardening-session.md` is a written summary of it, not a transcript. The two tiny
  Claude sessions from that evening are included above; they are minutes, not the session.
- Each export is captured from within a running session, so a file's final few exchanges
  (the export itself and the commit that follows) are not inside it.

## Reading them

Newline-delimited JSON — one record per line, each with a `type` (`user` / `assistant` / …),
`message` content, and tool calls/results:

```bash
# human-skim the conversation (roles + first line of each message)
jq -r 'select(.type=="user" or .type=="assistant") | "\(.type): \(.message.content // .message | tostring | .[0:200])"' transcripts/claude-code-session-main.jsonl | less
```

`node tools/time-report.mjs` estimates active time from the raw Claude Code exports' timestamp
gaps. It does not measure the Codex sessions represented only by written summaries, so it is
supporting evidence rather than a complete clock.

## Useful points in the history

- **The v1 → v2 teardown** (main session): the cited explainer was judged too passive and rebuilt
  around live data and a return-use workflow. (Git: `b7cf0f7` → `e075f7d`.)
- **Review and hardening** (main and integrity sessions): findings led to security, deployment,
  refresh, statistics, watchlist, and journey-ordering regressions.
- **Owner guardrails set against the AI**: cited-or-cut, no claims about any company's
  compliance posture, humble tone, and the deliberate choice to paraphrase rather than
  republish the assignment text.
