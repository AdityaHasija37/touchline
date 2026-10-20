# Decision Register

The brief says: prefer the documented default, log ambiguity here, and don't build conflicting behaviours side by side.
Status values: **Adopted** (a spec default or an owner decision), **Proposed** (my default, open to change), **Open** (needs an owner answer before the phase it blocks).

## Adopted

| ID | Decision | Source |
|---|---|---|
| D-01 | Formats are 5v5, 7v7 and 11v11; 9v9 later | PRD §8 default |
| D-02 | Players view published briefings without login; nothing is editable | PRD §8 default |
| D-03 | Single owner per team in MVP | PRD §8, ADR-04 |
| D-04 | No animations; sequences are separate boards | PRD §8 |
| D-05 | Private notes allowed; each section must be explicitly included before publish | PRD §8 |
| DEC-01 | Repo at `~/code/touchline`; specs copied to `docs/specs/` | Owner, 19 Oct 2026 |
| DEC-02 | Local Supabase (Docker) for dev and tests; hosted free project only at deploy | Owner, 19 Oct 2026 |
| DEC-03 | Deploy target is Vercel + Supabase cloud, never automatic | Owner, 19 Oct 2026 |
| DEC-04 | Visual direction: light neutral UI, grass-green primary, dark high-contrast presenter (UX S09) | Owner, 19 Oct 2026 |
| DEC-14 | Email confirmation **required** at sign-up (Q-01). Local emails go to Mailpit, and links use the token-hash flow so they work across devices | Owner, 19 Oct 2026 |
| DEC-15 | Product name stays **Touchline**, with a minimal pitch-outline SVG mark (Q-02) | Owner, 19 Oct 2026 |
| DEC-05 | Next 16.3.8 / React 19.3.0 rather than the latest patch releases. react-konva 19.3 needs React ≥19.3, and the newest patches were under 2 weeks old | Engineering, 19 Oct 2026 |

## Proposed (defaults I'm applying unless you object)

| ID | Ambiguity | Proposed default | Why |
|---|---|---|---|
| DEC-06 | TECH-003 lists REST routes "illustrative" | Owner mutations use **server actions** with Zod. Route handlers only for the PDF and anything that needs HTTP semantics | One codebase (ADR-01). Same auth and validation either way |
| DEC-07 | Team deletion vs. existing share links | Deleting a team cascades and **revokes** its published links. Viewers see the generic unavailable page | Deleting a team should remove its data. Keeping public copies alive afterwards would surprise people |
| DEC-08 | QA-10 says "delete or archive player" | Players are **archive-only** (no DELETE grant). The lineup FK is `cascade`, so it only fires when a whole team or account is deleted (`restrict` broke team deletion; fixed in Phase 4). Snapshots embed name and number anyway | TEAM-02 only specifies archive |
| DEC-09 | "Timezone-aware kickoff" | Store `kickoff_at timestamptz` plus `kickoff_tz` (IANA, captured from the browser) and display in that zone | A fixture's local time shouldn't move when viewed from elsewhere |
| DEC-10 | Public token read path | SECURITY DEFINER RPC `get_published_snapshot(token, client_hash)` hashes the token in SQL and returns only the snapshot. *Revised by DEC-40:* callable only by the app server | Least privilege. Anon has zero table grants and no RPC access |
| DEC-11 | Who may export PDF | The owner, or anyone holding a valid unrevoked token (TECH-003 §5) | As specified |
| DEC-12 | Pitch geometry | 0–100 on both axes mapped onto a 68 × 105 pitch. `orientation` stored per board, default vertical | ADR-02, UX §5 |
| DEC-16 | Position vocabulary unspecified | A fixed set: GK / DEF / MID / FWD, enforced in Zod and a DB CHECK | Grassroots-friendly vocabulary. Finer roles can come later |
| DEC-17 | Shirt number uniqueness unspecified | Optional and **not** unique per team | Grassroots squads often share or skip numbers. Lineups use player IDs, not numbers |
| DEC-18 | How to confirm team deletion | Require typing the team name. The dialog lists what gets deleted | UX-002 §10, destructive actions |
| DEC-19 | When to save the board | Autosave 1.5 s after edits stop, plus Save and Cmd/Ctrl+S. A failed save pauses autosave until Retry; a conflict stops it entirely | UX-002 §5 "Saving… then Saved"; never show success before the server acknowledges |
| DEC-20 | What counts as a stale write | `version` increments only when `board_json` changes, set by a DB trigger and not client-writable. Renames never conflict with an open editor | Avoids false conflicts from renaming in another tab |
| DEC-21 | Conflict recovery options | "Save mine as a copy" (new tactic) or "Discard mine and reload". No automatic merge in MVP | UX-002 §7: prevent overwrite; prompt reload or duplicate |
| DEC-22 | Linking board markers to players | Server rejects boards that link players outside the tactic's team. Labels default to the shirt number, else initials | Stops a crafted board from referencing other rosters |
| DEC-23 | Marker colour vs. grass | Team colour is darkened until it reaches 3:1 contrast against the pitch | Grass green was nearly invisible on green |
| DEC-24 | Board limits | Presets filtered by team format. Max `format` markers per side, one ball, 200 objects, 256 KB JSON | TAC-01 "presets cannot silently introduce 11 players" |
| DEC-25 | What counts as one undo step | One committed op = one step: a drag records on release, a handle drag on release, a typed field on Enter/blur. Selection, tool changes and renames aren't board history | TAC-04 "undo restores last mutation exactly" |
| DEC-26 | Undo while typing | Board undo/redo shortcuts are ignored while focus is in a text field, which keeps the browser's own text undo | Avoids surprising board changes mid-typing |
| DEC-27 | Text placement | Clicking with the Text tool shows a ghost; nothing is added until Enter. Esc cancels and leaves no history entry | UX-002 §5 "Esc cancels; Enter commits" |
| DEC-28 | Tool persistence and arrow style | Draw tools stay active for repeated drawing (Esc/V returns to select). The drawn item is selected; changing its arrow style also sets the style for the next arrow | Fewer clicks when sketching several runs |
| DEC-29 | Zoom fit (UX-002 S05 bottom bar) | Not built: the pitch always auto-fits its container, so a fit button would do nothing. Revisit if free zoom/pan is added | Avoids a control with no effect |
| DEC-30 | Text wrapping | One deterministic word wrap (22 characters per line) shared by the Konva editor and the SVG renderer | Keeps editor, presenter and PDF identical |
| DEC-31 | Format of an existing fixture when the team format changes | Each match stores `match_format` at creation; later team changes never alter it. Board sections in another format show a warning (non-blocking) | PRD §6 "Team format changes do not silently alter existing match snapshots" |
| DEC-32 | Private notes (D-05) | Every section has public notes plus a separate private note that is never copied into a published briefing. Sections are included by default; the Phase 5 publish review shows exactly what goes out | Keeps coach-only context next to the plan without risking exposure |
| DEC-33 | Section ordering control | Up/down buttons calling an RPC that swaps neighbours, not drag-and-drop | Keyboard-accessible by default and atomic |
| DEC-34 | Lineup saves | Whole lineup replaced atomically by `save_lineup` RPC; client serialises requests so the latest picks win. Starter cap and same-team checks enforced again by a DB trigger | MATCH-02; no partially saved lineups |
| DEC-35 | Publish readiness | A pure `planReadiness()` drives the S07 checklist now and will gate the publish action in Phase 5. Blocking: starters ≠ format, no included sections, a board section without a tactic. Warnings: archived starters, format mismatch, missing objective | QA-05; one rule set, used in UI and server |
| DEC-36 | Where kickoff times are formatted | Server only; passed to client components as text | Node and browser ICU data disagree ("GMT" vs "GMT+0") and caused hydration mismatches |
| DEC-37 | Plan concurrency | Last write wins per field for plan text (single owner, field-level saves). Lineup is replaced as a whole. Boards keep optimistic concurrency (DEC-20) | Low conflict risk in MVP (ADR-04); revisit with multi-coach roles |
| DEC-38 | Where the share token goes in the URL | `/p#<token>`: the token is in the fragment, which browsers never send to servers, and the page POSTs it to `/api/briefing`. It never appears in access or Vercel logs or in `Referer` headers. Deviates from TECH-003's illustrative `GET /p/:token` | Brief: "treat public share tokens as secrets; never print them to logs" |
| DEC-39 | Showing the link again | Only the SHA-256 hash is stored (TECH-003 §6), so the link is shown once at publish. "Get a new link" rotates the token (old link dies). Republish keeps the same link and updates its content | Spec forbids storing raw tokens; rotation keeps owners unblocked |
| DEC-40 | Rate limiting public lookups (Q-04, owner chose a Postgres counter) | 60 lookups per salted-hash-of-IP per minute in `share_lookup_counters`. Only the app server can call `get_published_snapshot` (service role, one server-only route), because anon calling it via the REST API could pass any client hash and dodge the limit. **Revises DEC-10**: the service-role key is now used in exactly this one request path. IP header preference: `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for` | Limit can't be bypassed; no paid service |
| DEC-41 | Draft vs published detection | The publish screen builds a fresh snapshot and compares content fingerprints (ignoring publish time) with the live one | Catches tactic, lineup and section edits, not just plan-text edits |
| DEC-42 | Caching of `/p` | The `/p` shell holds no data, so Next may cache it; `/api/briefing` is `no-store`. Both are `noindex` + `Referrer-Policy: no-referrer` | Sensitive content only travels in no-store API responses |
| DEC-43 | Owner presenter source | `/present` shows the published snapshot; `?source=draft` (or an unpublished plan) shows a clearly labelled draft preview built by the same snapshot and SlideSpec code | One renderer, no drift between preview and what players see |
| DEC-44 | Analytics sink (Q-05) | `analytics_events` table, written only via `track_event()` (owner-checked, per-event property allowlist) or inside the public lookup. Teams are referenced by a random `analytics_id` users can't read, so events are unlinkable once a team is deleted. Best effort; never blocks a user | PLAN-004 §5: safe properties only, pseudonymous, deletion path |
| DEC-45 | PDF engine (Q-03, owner chose react-pdf) | `@react-pdf/renderer` 4.9.0. Boards drawn from shared render primitives (`lib/domain/board-render.ts`) that the screen SVG also uses; arrowheads are explicit triangles. A4 landscape, one page per SlideSpec | Vercel-friendly; parity by construction |
| DEC-46 | PDF fonts | Embedded Noto Sans (SIL OFL), vendored as two TTFs in `assets/fonts/`, because the built-in PDF fonts drop letters in names like "Łukasz Żółć". Covers Latin, Cyrillic and Greek; CJK, Arabic and Hebrew not yet | User names must print correctly |
| DEC-47 | Colour tokens | `--muted-foreground` and `--destructive` darkened after the axe audit to meet WCAG AA on tinted backgrounds | NFR-01 |
| DEC-48 | How evaluators (recruiters, curious captains) try the product | "Try the demo" creates a private, pre-filled sandbox account (7v7 team, squad, annotated tactic, ready plan) and signs in directly, with no email. Sandboxes are deleted after 24 h by opportunistic cleanup; at most 5 per visitor per hour and 300 live overall. Uses the service role for this second server-only job (extends DEC-40). `DEMO_ENABLED=false` turns it off | A shared demo account would expose visitors to each other's changes; email sign-up is too much friction for a 2-minute look |
| DEC-49 | Player roles (LINE-01, D-06) | A fixed list of 20 Football Manager-style roles (`lib/domain/roles.ts`) stored as slug keys, each with the lines it suits and the duties it allows; the UI offers only roles for the starter's line. A free-text instruction (≤ 140) covers anything the list can't say | Consistent wording players recognise, without turning the plan into a stats game |
| DEC-50 | Where the formation lives (LINE-02) | `match_plans.formation_id`, separate from any tactic board. Slot labels become positions; "None (list only)" keeps the MVP list. Changing formation keeps valid slots and re-slots the rest by fit; nobody is dropped | A match lineup and a teaching board are different jobs; tying them would make editing one silently change the other |
| DEC-51 | Position fit | Compare the player's preferred lines (GK/DEF/MID/FWD) with the slot's line: same = natural, one line away = can cover, otherwise (or keeper ↔ outfield) = out of position. Shown as a coloured ring **and** in text | A grassroots-sized version of EA FC position chemistry / FM role suitability; colour is never the only signal |
| DEC-52 | Storage for set pieces and the sub plan | Validated JSON columns on `match_plans` (4 KB / 8 KB caps), not new tables. Always saved whole, re-validated with Zod on every read and write; malformed data falls back to empty | Small, plan-scoped, replaced as a unit; no queries ever need to join into them |
| DEC-53 | How published briefings refer to players | Per-briefing keys (`p1`… starters in slot order, then bench). Snapshot stays `version: 1` with optional fields so every earlier briefing still parses; board markers map to keys via `markerRefs` | Find me, set pieces and subs need to link people across slides without ever publishing internal ids |
| DEC-54 | Fair minutes (SUBS-01, D-07) | Warn when a player gets under half the match; never block. Rolling subs (re-entry) allowed, as in most grassroots football. Default lengths 40 / 60 / 90 by format, editable 10–120 | Teams have different rules; the tool should make unfairness visible, not decide it |
| DEC-55 | Find me (VIEW-01) | Built entirely in the browser from the snapshot already loaded: no extra request, no analytics, nothing stored. Highlight lasts only while the page is open | The public page has no login; recording who looked themselves up would be tracking players |
| DEC-56 | Do 1.1 features gate publishing? (D-08) | No. Out-of-position starters, broken subs and short minutes are checklist warnings; invalid subs and set-piece jobs held by benched players are left out of the briefing | Keeps the MVP's publish rules intact; extra detail should never stop a captain sending the plan |
| DEC-57 | Draft-vs-published comparison | The snapshot fingerprint now sorts object keys before comparing | Bug found by E2E: Postgres `jsonb` reorders keys, so the new `markerRefs` record made an unchanged plan look edited |
| DEC-58 | Measuring 1.1 adoption | `plan_published` also carries counts only: `has_formation`, `roles_count`, `set_piece_jobs`, `subs_count` (allowlist extended in migration 0009) | Tells us whether captains use the new detail, without recording any of its content |
| DEC-13 | Board format vs. team format | Each tactic stores its own `format`. Changing the team format warns and needs explicit conversion for drafts, and never touches snapshots | PRD §6 |

## Open (blocking a later phase)

| ID | Question | Blocks | Options |
|---|---|---|---|
| (none open) | All MVP questions resolved; see DEC-44/45 | n/a | n/a |

## Change log

| Date | Change |
|---|---|
| 19 Oct 2026 | Register created at M0 |
| 20 Oct 2026 | Release 1.1 (matchday detail): DEC-49 to DEC-58; D-06 to D-08 added to PRD-001 §8 |
| 20 Oct 2026 | Portfolio release: DEC-48 (demo sandboxes) |
| 20 Oct 2026 | Phase 6: DEC-44 to DEC-47; Q-03 and Q-05 resolved |
| 19 Oct 2026 | Phase 5: DEC-38 to DEC-43; Q-04 resolved; DEC-10 revised |
| 19 Oct 2026 | Phase 4: DEC-31 to DEC-37; DEC-08 revised (lineup FK cascade) |
| 19 Oct 2026 | Phase 3: DEC-25 to DEC-30 added |
| 19 Oct 2026 | Phase 2: DEC-19 to DEC-24 added |
| 19 Oct 2026 | Q-01, Q-02 resolved (DEC-14/15). DEC-16 to DEC-18 added in Phase 1 |
