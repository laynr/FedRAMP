# AI development transcripts

Per the assignment's request to "submit your Claude/AI transcripts," these are the raw Claude
Code session logs from building OnRamp — the evidence of how the AI was directed, evaluated,
and corrected.

## Files

| File | What it is |
|---|---|
| `claude-code-session-main.jsonl` | The main build session, 09:45–13:23 (v1 → v2 pivot → v3 hardening → OnRamp rebrand). |
| `claude-code-session-evening-hardening.jsonl` | A ~6-minute session around the evening commits (20:56–21:02). |
| `claude-code-session-integrity.jsonl` | The post-submission integrity pass: a requested harsh-grade review of this submission, then the fixes it demanded (including the corrections to this very file). |
| `codex-hardening-session.md` | Author-written summary of the evening Codex hardening pass. **Not a transcript** — see below. |

## What these logs are — and are not

Honest inventory, because the first version of this README overstated it:

- `claude-code-session-main.jsonl` has 2,157 lines, but most are harness bookkeeping. The
  actual conversation is ~953 messages (615 assistant, 338 user-type records — of which 305
  are tool results). **Genuine typed human prompts: about 15.** That ratio is the point of the
  workflow (direction, not typing), but the count should be stated plainly.
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

`node tools/time-report.mjs` computes the time accounting quoted in SUBMISSION.md from these
files' timestamps.

## Moments worth jumping to (the judgment, not the typing)

- **The v1 → v2 teardown** (main session): the owner reviewed a shipped, cited explainer and
  killed it as a "wall of text," pivoting to a tool. (Corroborated in git: `b7cf0f7` → `e075f7d`.)
- **The adversarial hardening pass** (main session): review agents turned loose on finished work
  found live XSS, a dead deploy pipeline, and a percentile off-by-one that had made the headline
  median wrong (361 → 327). All fixed before submission.
- **The integrity pass** (integrity session): the owner asked for a harsh grade of the finished
  submission and then directed fixes for what it found — including a stale time claim in three
  documents, this README's inflated message count, and a journey-engine tie-break bug that
  misreported the current status of eight real services.
- **Owner guardrails set against the AI**: cited-or-cut, no claims about any company's
  compliance posture, humble tone, and the deliberate choice to paraphrase rather than
  republish the assignment text.
