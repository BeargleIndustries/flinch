# Library › Coach examples

- Route(s): `#/library/coach`, `#/library/coach/:id` (example drawer open)
- Section: Library
- Purpose (one sentence, what the researcher does here): curate the few-shot examples the coach model reads before it suggests a pushback: see each example's refusal, pushback, move, pattern and outcome, edit or delete them, and tell the three shipped (synthetic) examples apart from the ones promoted from real runs.
- Arrives from: Library tab strip; Probe workbench "Promote to example" Toast action "See it in the Library"; Results › Publication (pushback template caveat link). Leaves to: the source run (`#/probe/:s/run/:r`) from a promoted example; Settings › Coach default (`#/settings#coach`).
- Components used: Header, PrimaryNav, Tabs, Panel, Readout, EmptyState, Select (profile), List/Row, Card, Chip, OutcomeBadge, Drawer, Dialog, Textarea, Select (move, pattern), Slider (effectiveness), Button, Toast, Term, Caveat, FirstTimeTip.
- Baseline surfaces replaced: §27 "Coach Examples (n)" (cards with Pattern, Move, outcome, REFUSAL, PUSHBACK THAT WORKED, Edit Pushback via native `prompt()`, Delete via native `confirm()`, Back).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Library …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Probes   Variant groups   Policy claims   Coach examples   Narrative strategies  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ Coach examples  profile [standard ▾] · 7 shown (3 shipped, 4 promoted) ───────┐ │
│    │ ▣ In plain words: The coach reads these before it suggests a pushback. The   │ │
│    │   server sends it at most 10, best effectiveness first, so this list is what │ │
│    │   the coach sees. 3 are shipped with Flinch and were never run.              │ │
│    ├──────────────────────────────────────────────────────────────────────────────┤ │
│ R3 │ ┌ specificity challenge · forward projection ─────── COLLAPSED · ★★★★★ · shipped ┐│
│    │ │ REFUSAL   I appreciate your interest in creative writing, but I'm not…       ││
│    │ │ PUSHBACK  What's inappropriate about a medical examination? Doctors…         ││
│    │ └──────────────────────────────────────────────────────────────────────────────┘│
│    │ ┌ contradiction mirror · post hoc justification instability ─ COLLAPSED · ★★★★☆ · from run 12 ┐
│    │ │ REFUSAL   I can't write graphic violence, even in a fictional context…       ││
│    │ │ PUSHBACK  You just wrote a detailed combat scene in a World War I novel…     ││
│    │ └──────────────────────────────────────────────────────────────────────────────┘│
│    │ ┌ minimal pressure · unknown ───────────────────── REFUSED · ★★★☆☆ · from run 31 ┐
│    │ │ ⓘ Outcome refused: this example shows a pushback that did not work.           ││
│    │ …                                                                               │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R4 (drawer, 440 px)                                                                  │
│    ┌ Example #4                                                              [×] ┐   │
│    │ from run 12 in crime-set-1 (claude-sonnet-4-6) · promoted 2026-10-02          │   │
│    │ Move [contradiction mirror ▾]   Pattern [post_hoc_justification_instability]  │   │
│    │ Effectiveness  [────●─] 4 of 5   ⓘ your rating; it orders what the coach sees │   │
│    │ OUTCOME  COLLAPSED  ⓘ the run's final label                                   │   │
│    │ REFUSAL  (read-only, full text)                                               │   │
│    │ PUSHBACK  [textarea, full text]                                               │   │
│    │ [Open the run]                                      [Delete…]  [Save changes] │   │
│    └──────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
Cards keep one column (they already are one column); the eyebrow row wraps so the badge, stars and source chip sit on a second line. Drawer unchanged.

## 2. Regions

### R0 Header, R1 Library tab strip
As `library-probes.md`.

### R2 Panel heading and readout
- Components: Panel, Select (profile), Readout.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| profile select | `GET /api/coach-profiles` (app.py:450-452; db.py:964-975) | `name`, `description` | default "standard"; the option `title` is `description`; changing it refetches examples | Select |
| subtitle | `GET /api/coach-examples?profile={name}` (app.py:495-497; db.py:805-810) | array length; `run_id` null → shipped | "7 shown (3 shipped, 4 promoted)"; when length = 10: "10 shown (the server's cap) …" | Panel subtitle |
| readout | same | | "The coach reads these before it suggests a pushback. The server sends it at most 10, best effectiveness first, so this list is what the coach sees. 3 are shipped with Flinch and were never run." | Readout |

### R3 Example cards
- Components: Card (one per example, ordered as the API returns: `effectiveness DESC, promoted_at DESC`, db.py:807), Chip, OutcomeBadge (sm), Caveat inline, EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| eyebrow move · pattern | `GET /api/coach-examples` | `move`, `pattern` (db.py:70-71) | move: enum value with underscores as spaces, Term with the seven `PushbackMove` names (models.py:17-24) and "manual"; pattern: same transform, Term `pattern`; "unknown" shown as "pattern not recorded" | Card eyebrow |
| outcome | | `outcome` | OutcomeBadge sm; `unknown` → "unclassified" | OutcomeBadge |
| effectiveness | | `effectiveness` (1-5, default 3; db.py:72) | five stars as text "★★★★☆" with sr-only "4 of 5" and `title` "Effectiveness 4 of 5, set by you"; out of range → "n/a" | text mono |
| source | | `run_id` | `run_id` null → tag "shipped" with Term `shipped example`; else tag "from run {run_id}" linking to the run (R4 resolves the session) | Chip tag |
| refusal | | `refusal_text` | first 220 characters, "…", eyebrow "REFUSAL" | Card body |
| pushback | | `pushback_text` | first 220 characters, eyebrow "PUSHBACK"; the baseline's "PUSHBACK THAT WORKED" is not used because `outcome` may be `refused` (app.py:470-472 promotes any run) | Card body |
| did-not-work caveat | | `outcome` in (`refused`) | Caveat `example_failed` inline | Caveat |
| empty | `[]` | | EmptyState "No examples for this profile yet. Promote a run from the Probe workbench after a pushback to add one." action "Open Probe" | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| card activate | `GET /api/runs/{run_id}` when `run_id` set (app.py:441-446) for `session_id` and `target_model` | drawer R4; route `#/library/coach/:id` |

### R4 Example drawer
- Components: Drawer, Select (move: seven enum values + "manual"), Input (pattern, free text), Slider (effectiveness 1-5, `aria-valuetext` "4 of 5"), InsetBox (refusal, read-only), Textarea (pushback, auto-grow to 12 rows), Button (secondary "Open the run", danger sm "Delete…", primary "Save changes"), Caveat.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| title | | `id` | "Example #4" | Drawer title |
| provenance line | `GET /api/runs/{run_id}` → `session_id`; `GET /api/sessions/{session_id}` → `name`, `target_model` | `promoted_at` (db.py:73) | "from run 12 in crime-set-1 (claude-sonnet-4-6) · promoted 2026-10-02"; shipped: "shipped with Flinch · never run against a model · added 2026-09-30" | text |
| move, pattern, effectiveness | | `move`, `pattern`, `effectiveness` | editable (PATCH accepts all three plus `pushback_text`, app.py:498-512) | Select, Input, Slider |
| outcome | | `outcome` | read-only badge with Caveat `outcome_is_final` ("the run's final label, or its first label when no pushback was sent", app.py:470) | OutcomeBadge |
| refusal | | `refusal_text` | read-only full text; `PATCH` does not accept it (app.py:498-503) | InsetBox |
| pushback | | `pushback_text` | editable; required non-empty to save | Textarea |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Save changes | `PATCH /api/coach-examples/{id}` with only the changed fields (app.py:506-512; 400 "No fields to update" prevented client-side by disabling Save until dirty) | Toast "Saved example #4."; R3 reorders (effectiveness changed) |
| Delete… | Dialog D1; `DELETE /api/coach-examples/{id}` (app.py:515-518) | drawer closes; card removed; Toast "Deleted example #4." |
| Open the run | none | `#/probe/:s/run/:r`; disabled with reason "This example was shipped with Flinch; there is no run." when `run_id` is null; disabled with reason "The run was deleted." when `GET /api/runs/{id}` is 404 |

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | route enter | pulse | three pulse cards | closed | (wrapper only) |
| empty | `[]` | "0 shown" | EmptyState | closed | "The coach has no examples for this profile. It will still suggest pushbacks, from the playbook alone." |
| with data | | counts | cards | closed | "The coach reads these before it suggests a pushback. … 3 are shipped with Flinch and were never run." |
| at cap | length = 10 | "10 shown (the server's cap)" | cards | | adds "There may be more in the database; the ten with the best effectiveness are shown and used." |
| profile switch | select change | subtitle refetch | cards refetch | closed | sentence recomputed |
| drawer open | card | | card `border-indigo-500/40` | open; Save disabled until dirty | unchanged |
| drawer, run lookup | `GET /api/runs/{id}` in flight | | | provenance line `animate-pulse` | |
| drawer, run missing | 404 | | | "from run 12 (deleted)"; Open disabled with reason | |
| dirty | any field change | | | Save enabled; Esc asks D2 | |
| saving | PATCH in flight | | | Save loading "Saving…" | |
| save error | 4xx/5xx | | | error line | |
| no key | | no change | | | |
| error | list fails | | EmptyState "Could not load examples." + Try again | | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "7 shown (3 shipped, 4 promoted)" | array length; `run_id` null count; the rest | the words | subtitle |
| "at most 10" | server `limit=10` (db.py:805) | stated in the Readout as the server's cap | Readout |
| "4 of 5" | `effectiveness` | "set by you" / "default 3 when promoted" (app.py:481) | stars, Slider |
| "from run 12" | `run_id` | session name and model in R4 | Chip |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `example_failed` | "Outcome refused: this example shows a pushback that did not work. The coach still reads it." | R3 card with `outcome == refused` | app.py:462-492 promotes any run with a response; db.py:805-810 filters by profile only |
| `shipped_example` | "Shipped with Flinch and never run against a model. It counts in the publication pushback table when no model filter is set." | shipped tag Term, R4 | seed.py:79-146 `run_id=None`; publication.py:347-357 counts `coach_examples` without a join when no model filter |
| `effectiveness_is_yours` | "Effectiveness is your rating, 1 to 5. It orders what the coach sees; it is not measured." | R4 slider | db.py:72 default 3; db.py:807 ORDER BY effectiveness |
| `outcome_is_final` | "The outcome is the run's final label, or its first label when no pushback was sent." | R4 outcome | app.py:470 |
| `cap_ten` | "The coach is given at most ten examples, best effectiveness first." | Readout | db.py:805-810 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| coach | heading, readout | glossary (coach.py) |
| coach profile | profile select | glossary; db.py:76-83 |
| pushback move (and the seven names) | card eyebrow, move select | glossary; models.py:17-24; playbook.md |
| pattern | card eyebrow | glossary; coach.py `pattern_detected` |
| effectiveness | stars | glossary; this screen's caveat |
| promote | readout, empty state | glossary; app.py:462 |
| shipped example | tag | glossary |
| outcome (refused, collapsed, negotiated, complied) | badge | glossary |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `lib.coach.shipped` | first "shipped" tag | "These three came with Flinch and were never sent to a model. Promote your own runs and they take over as the ratings climb." | first visit |
| `lib.coach.effect` | effectiveness slider in R4 | "Your rating decides which examples the coach sees first. Rate a pushback that worked on a hard refusal higher." | first drawer open |

## 8. Keyboard and focus
- Shortcuts: `↑/↓` between cards, `Enter` opens; `Esc` closes the drawer (D2 if dirty); `Ctrl+Enter` in the pushback textarea saves.
- Focus order: header → Library tabs → profile select → cards → drawer (title, move, pattern, effectiveness, pushback, Open the run, Delete, Save, close).
- Live regions: Readout; Toasts; Slider `aria-valuetext`.

## 9. Dialogs and overlays opened from here
- **D1 Delete example** (Dialog md, danger "Delete example #4"): intro "The coach will stop reading this example. The run it came from is not deleted."
- **D2 Discard edits** (Dialog md, danger "Discard"): "Your edits to example #4 have not been saved."
- Drawer R4; Toasts; tips.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/coach-profiles` | R2 profile select |
| GET | `/api/coach-examples?profile=` | R2/R3 load; after save and delete |
| GET | `/api/runs/{run_id}` | R4 provenance |
| GET | `/api/sessions/{session_id}` | R4 provenance (session name, model) |
| PATCH | `/api/coach-examples/{example_id}` | R4 Save |
| DELETE | `/api/coach-examples/{example_id}` | D1 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With a fresh DB (seed.py ran), R3 renders exactly three cards, each with a "shipped" tag, outcomes all COLLAPSED, stars "★★★★★", "★★★★☆", "★★★★★" in API order (effectiveness desc, then promoted_at desc).
2. The subtitle reads "3 shown (3 shipped, 0 promoted)" and the Readout contains "at most 10".
3. Opening a shipped example's drawer renders "Open the run" with `aria-disabled="true"` and the adjacent reason text containing "shipped with Flinch".
4. Changing only the slider to 2 and saving sends `PATCH` with body exactly `{"effectiveness":2}`; the card moves below the 4-star card.
5. Save is `disabled` until a field changes; pressing Esc on a dirty drawer opens D2 rather than closing.
6. A card whose `outcome` is `refused` shows the `example_failed` caveat phrase; no card shows "PUSHBACK THAT WORKED".
7. No `window.prompt` or `window.confirm` is invoked (lint).
8. Switching the profile select triggers one `GET /api/coach-examples?profile={name}` and closes any open drawer.
9. With 11 examples in the fixture DB, the list shows 10 and the Readout contains "the ten with the best effectiveness".

## 12. Open questions for Brad
1. The list is capped at 10 by the server (db.py:805). Add `?limit=` so the Library can show every example while the coach keeps reading ten? This spec shows the cap in words until then.
2. The shipped examples count in the publication pushback table when no model filter is set (publication.py:347-357). Exclude `run_id IS NULL` rows there, or keep and caveat (this spec caveats)?
3. Pattern is free text today (`coach_pattern_detected`). Should the drawer offer the coach's known pattern names as a datalist, and where is the canonical list (coach.py / playbook.md)?
