#!/usr/bin/env node
/**
 * time-report.mjs — verifiable time accounting from the AI session transcripts.
 *
 * Parses every transcripts/*.jsonl (Claude Code session logs: one JSON record
 * per line, each with an ISO `timestamp`) and classifies the gap between
 * consecutive records:
 *
 *   - gap ≤ IDLE_MS ending in a genuine human prompt → HUMAN INPUT time
 *   - gap ≤ IDLE_MS otherwise                        → AGENT PROCESSING time
 *   - gap > IDLE_MS                                  → DEAD time (away from
 *     keyboard — eating, TV, life), excluded from the active total
 *
 * A "genuine human prompt" is a user-type record with text content, excluding
 * tool results, <command-*> stubs, and task notifications. The 5-minute idle
 * threshold is arbitrary but stated; rerun with IDLE_MINUTES=n to test
 * sensitivity. Sessions not captured as transcripts (see transcripts/README)
 * are NOT counted here — absence of evidence is reported as absence.
 *
 * Zero dependencies. Usage: node tools/time-report.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../transcripts/', import.meta.url).pathname;
const IDLE_MS = (Number(process.env.IDLE_MINUTES) > 0 ? Number(process.env.IDLE_MINUTES) : 5) * 60_000;
const TZ = 'Pacific/Honolulu'; // commit timezone (-10:00) — keeps local times comparable to git log

const isHumanPrompt = (rec) => {
  if (rec.type !== 'user') return false;
  const c = rec.message?.content;
  let text = null;
  if (typeof c === 'string') text = c;
  else if (Array.isArray(c)) {
    const kinds = new Set(c.filter((b) => b && typeof b === 'object').map((b) => b.type));
    if (kinds.has('tool_result')) return false;
    if (kinds.has('text')) text = c.map((b) => b.text ?? '').join(' ');
  }
  if (!text || !text.trim()) return false;
  return !/<command-name>|<local-command|task-notification|SYSTEM NOTIFICATION/.test(text);
};

const hm = (ms) => `${(ms / 3_600_000).toFixed(2)} h`;
const local = (d) => d.toLocaleTimeString('en-US', { timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit' });

const files = readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).sort();
const totals = { processing: 0, human: 0, dead: 0, prompts: 0 };

console.log(`Time accounting from transcripts/*.jsonl (idle threshold: ${IDLE_MS / 60_000} min; times ${TZ})\n`);
for (const f of files) {
  const events = [];
  for (const line of readFileSync(join(DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const t = Date.parse(rec.timestamp);
    if (Number.isFinite(t)) events.push({ t, human: isHumanPrompt(rec) });
  }
  events.sort((a, b) => a.t - b.t);
  if (events.length < 2) { console.log(`${f}: too few timestamped records to measure\n`); continue; }

  const s = { processing: 0, human: 0, dead: 0, prompts: events.filter((e) => e.human).length };
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].t - events[i - 1].t;
    if (gap > IDLE_MS) s.dead += gap;
    else if (events[i].human) s.human += gap;
    else s.processing += gap;
  }
  const span = events[events.length - 1].t - events[0].t;
  console.log(`${f}`);
  console.log(`  span ${hm(span)} (${local(new Date(events[0].t))}–${local(new Date(events[events.length - 1].t))} local) · ${s.prompts} human prompts`);
  console.log(`  agent processing ${hm(s.processing)} · human input ${hm(s.human)} · dead time subtracted ${hm(s.dead)}\n`);
  for (const k of ['processing', 'human', 'dead']) totals[k] += s[k];
  totals.prompts += s.prompts;
}

console.log('TOTAL (captured transcripts only)');
console.log(`  active ${hm(totals.processing + totals.human)} = agent processing ${hm(totals.processing)} + human input ${hm(totals.human)}`);
console.log(`  dead time subtracted ${hm(totals.dead)} · ${totals.prompts} human prompts`);
console.log('\nNot counted: sessions without a .jsonl transcript (see transcripts/README.md) —');
console.log('their work is bounded only by git commit timestamps, and no active-time number is claimed for them.');
