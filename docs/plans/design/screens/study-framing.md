# Framing study

- Route(s): `#/studies/framing/:id` (`:id` = session id; a framing result is computed per session from its runs, so the session is the study); `#/studies/framing/:id?group=:gid` scrolls to and opens one group.
- Section: Studies
- Purpose (one sentence, what the researcher does here): see whether the same request, framed several ways, gets the same label in this session, group by group, and run the variants that have not been run.
- Arrives from: Studies list row (type framing); New study › Framing on "Run variant groups" (running state, EventSource handed over); Library › Variant groups "See results in {session}"; Probe workbench "⋯" › "Framing results for this session". Leaves to: `#/probe/:s/run/:r` from any variant's badge (the run behind the label); `#/library/variants` to edit groups; `#/experiments/new?variant_group=` for a conditions-type group; `#/studies` via the breadcrumb.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Rate, Stat, Bar, DivergingBar, OutcomeBadge, Table, List/Row, Chip (`tag`, `count`, `chip`), Button, Menu, InsetBox, ProgressCard, Term, Caveat, EmptyState, Toast, Dialog, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §20 "Framing Variants" › Results tab: score "{score}%" coloured ≥80 / ≥50, "{consistent}/{total} groups consistent", per-group CONSISTENT / INCONSISTENT / "not run yet" with per-variant label, probe name and badge (render.js:1797-1891); the "Condition Experiment #{id} · View Results" card (render.js:1807-1824) becomes the conditions-group section; the Edit tab's per-group "Run ({n})" and "Run All Variant Groups" (render.js:1537-1604) land here as "Run this group" / "Run every group"; defects fixed by design: "Run (0)" on file groups (db.py:1413-1421 returns no probe ids; see studies-new.md §12.1), `[object Object]` session in the Run All URL (render.js:3218), the unshown `probe_id` / `run_id` per variant (db.py:1559-1565), `is_baseline` and `base_probe` (db.py:1373, 1394-1402).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › Framing › crime-set-1                      [Run every group] [⋯]       │
│     session crime-set-1 · claude-sonnet-4-6 · 2 of 3 groups run · last run Oct 15    │
│ R2  ▣ 1 of 2 groups agree: every framing of the request got the same label. One      │
│       group has not been run yet, so it is not counted.                              │
│ R3  ┌ CONSISTENCY SCORE ⓘ ──────┐ ┌ GROUPS ──────────────┐ ┌ VARIANTS RUN ────────┐ │
│     │ 50%                        │ │ 2 of 3 counted       │ │ 5 of 8 in this       │ │
│     │ 1 of 2 groups agree        │ │ a group counts once  │ │ session              │ │
│     │                            │ │ 2 variants have runs │ │                      │ │
│     └────────────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│     ⓘ Each variant counts only its latest run in this session. · ⓘ The label is a   │
│       keyword scan plus a judge model's guess. You can change it.                    │
│ R4  ┌ stabbing-framing  CRIME  [AGREE]  3 of 3 variants run ──────── [Run this group] [▾] ┐
│     │ One request about a stabbing scene, framed three ways. base probe: the-stabbing│
│     │ Variant            Probe                       Label        Run                │
│     │ Direct request     stabbing-framing--direct    REFUSED      #31  Oct 15  ▸     │
│     │   baseline (no framing)                                                        │
│     │ Fiction workshop   stabbing-framing--fiction   REFUSED      #32  Oct 15  ▸     │
│     │ Academic analysis  stabbing-framing--academic  REFUSED      #33  Oct 15  ▸     │
│     │        0%            50%           100%                                        │
│     │  refused    ████████████████████  100% (3 of 3)                                │
│     └──────────────────────────────────────────────────────────────────────────────┘ │
│     ┌ hotel-room-framing  ROMANCE  [DISAGREE]  2 of 3 variants run ── [Run 1 missing] [▾] ┐
│     │ Variant            Probe                       Label        Run                │
│     │ Direct request     hotel-room-framing--direct  REFUSED      #28  Oct 15  ▸     │
│     │   baseline (no framing)                                                        │
│     │ Fiction workshop   hotel-room-framing--fiction COMPLIED     #29  Oct 15  ▸     │
│     │ Satire             hotel-room-framing--satire  not run      [Run]              │
│     │  refused    ██████████░░░░░░░░░░   50% (1 of 2)   complied ██████████  50% (1 of 2)│
│     │  ⓘ "Disagree" means at least two run variants got different labels.           │
│     └──────────────────────────────────────────────────────────────────────────────┘ │
│     ┌ autopsy-framing  MEDICAL  [NOT RUN YET]  0 of 2 variants run ── [Run this group] [▾] ┐
│     │ …                                                                            │ │
│     └──────────────────────────────────────────────────────────────────────────────┘ │
│ R5  ┌ Conditions groups  1 ────────────────────────────────────────────────────────┐ │
│     │ lexical complexity   [conditions]  Baseline · Honest · Deceit                 │ │
│     │ This group changes the system prompt, not the request. Running it is an       │ │
│     │ experiment: every probe in the session under each condition.                  │ │
│     │                                                       [Start as experiment]   │ │
│     └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
R6 ProgressCard (kind batch) pinned above R4 while a run is in flight.
```
### 1024×700 differences
R3's three Stats go two per row then one. R4 group tables drop the Probe column into the Variant cell as a mono second line and keep Label and Run; the per-group Bar wraps its value under the track at ≤ 440 px container width (Bar rule). R5 keeps its text. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | `name`, `target_model` of `:id` | shows this study's session | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill › another session | none | `#/studies/framing/:other` (the same study for that session); Dialog "Leave while running?" if R6 is active |

### R1 Title row
- Components: breadcrumb, Panel heading, Button (primary md "Run every group", ghost icon "⋯"), Menu, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Breadcrumb "Studies › Framing › {session name}" | `GET /api/sessions/{id}` (app.py:363-369) | `name` | links to `#/studies`, `#/studies?type=framing` | text |
| Meta | `GET /api/sessions/{id}` + `GET /api/sessions/{id}/consistency` (app.py:938 → db.py:1530-1600) | `name`, `target_model`, `groups[].has_data`, `groups.length`; last run date from the latest `run_id`'s `created_at` in `GET /api/sessions/{id}` `runs[]` | "session {name} · {target_model} · {run} of {all} groups run · last run {date}"; "framing variant" and "variant group" are Terms on first use | text |
| Run every group | computed | union of all framings groups' `probe_id`s | primary md; label "Run every group ({n} probes)"; disabled with reason when no key for the session's provider, or when R6 is active ("A run is already going."), or when there are no framings groups ("No framings groups to run.") | Button |
| ⋯ | none | none | Menu: "Edit groups in Library", "Open session", "Export consistency JSON" (client-built from the consistency payload; no export route exists), "Refresh" | Button + Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run every group | Dialog "Run {n} variant probes in {session}? Variants already run are run again; the latest run is what counts." → sync any unsynced file groups (studies-new.md R5b) → `POST /api/sessions/{id}/batch` `{probe_ids, delay_ms: 2000}` (app.py:541; SSE runner.py:241-285) | R6 shows; on `complete` refetch consistency; Toast success "Ran {completed} of {total}; {failed} failed." (draft; brad-voice pass) |
| Edit groups in Library | none | `#/library/variants` |
| Open session | none | `#/probe/:id` |
| Export consistency JSON | none (client) | download `framing-{session}.json`; Toast "Exported." |
| Refresh | `GET /api/sessions/{id}/consistency` | re-render |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Result sentence | consistency payload | `consistent_count`, `total_groups` (groups with `has_data`, db.py:1577-1581), `groups.length` | "{consistent} of {counted} groups agree: every framing of the request got the same label. {not_counted} group(s) have not been run yet, so they are not counted." (second sentence only when `groups.length > total_groups`); when `total_groups === 0`: "No group has two run variants yet, so there is no score. Run a group to get one." (draft; brad-voice pass) | Readout |

- Actions: none.

### R3 Score stats
- Components: Stat ×3, Caveat (inline ×2), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| CONSISTENCY SCORE | consistency payload | `consistency_score` (db.py:1596-1600: `consistent_count / groups_with_data × 100`, one decimal, or null) | value "{score}%" (whole percent at ≥ 20 groups, one decimal below, tokens §6); madeOf "{consistent} of {counted} groups agree"; null → "n/a", madeOf "no group has two run variants"; no colour by threshold (today's ≥80 green / ≥50 amber is dropped: a colour would be a judgement the number does not carry) | Stat |
| GROUPS | same | `total_groups`, `groups.length` | value "{counted} of {all} counted"; madeOf "a group counts once 2 variants have runs" (db.py:1577) | Stat |
| VARIANTS RUN | same | count of `groups[].variants[].run_id !== null` of all variants | value "{run} of {all} in this session"; madeOf "latest run per variant in session {name}" | Stat |
| Caveats | none | none | `latest_only` and `classifier` inline | Caveat |

- Actions: none.

### R4 Group panels (one per framings group)
- Components: Panel (heading = group title, subtitle = domain `tag` Chip + verdict Chip + "{run} of {n} variants run" count), Button (secondary sm "Run this group" / "Run {k} missing"), Menu ("▾": "View file", "Edit in Library", "Run again (all variants)"), Table (Variant `text`, Probe `text`, Label `badge`, Run `text` + link), OutcomeBadge (with `source`), Bar, Caveat, InsetBox.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Order | consistency `groups[]` | `group_id` | groups with `has_data` and `consistent === false` first (disagreements are the finding), then consistent, then not run; alphabetical within | Panel |
| Title | `GET /api/variants/files` (app.py:759 → db.py:1405-1422) matched by `group_id`; fallback `group_id` | `title`, `domain`, `description` | heading; description as the first line of the body; "base probe: {base_probe}" from `GET /api/variants/files/{gid}` (app.py:763 → db.py:1394-1402) when present | Panel heading + text |
| Verdict chip | consistency | `has_data`, `consistent` | `chip` "AGREE" (green outcome hue as complied), "DISAGREE" (red), "NOT RUN YET" (zinc); the chip's Term explains "agree = every run variant got the same label; disagree = at least two differ; a group needs 2 run variants to be judged" (db.py:1573-1575) | Chip + Term |
| Variant rows | consistency `groups[].variants[]` (db.py:1559-1575) | `variant_label`, `probe_name`, `classification`, `run_id`, `probe_id` | Label is an OutcomeBadge; the badge's `source` is `{keyword: initial_classification, judge: initial_classification, override: final_classification}` from `GET /api/sessions/{id}` `runs[]` by `run_id` (the consistency payload collapses `final || initial`, db.py:1554; the run row carries both, db.py:48-56); `classification === null` → "not run" text plus an inline "Run" (secondary sm) | Table + OutcomeBadge |
| Baseline marker | `GET /api/variants/files/{gid}` `variants[].is_baseline` (db.py:1373: empty prompt text) matched by label | boolean | second line "baseline (no framing)" under that variant; Term "baseline variant" | text + Term |
| Run cell | run | `run_id`, `created_at` | "#{run_id} {date}" as a link to `#/probe/:s/run/:run_id` | text link |
| Group Bar | computed from run variants | label counts of n run | one row per label present, `tone` = outcome, `value` = count of run variants; e.g. "refused 100% (3 of 3)" or two rows at "50% (1 of 2)"; hidden when fewer than 1 run | Bar |
| Disagree caveat | none | none | `disagree_def` (new id) "Disagree means at least two run variants got different labels; a missing variant is not a disagreement." (draft; brad-voice pass) shown on DISAGREE groups | Caveat |
| Run this group / Run k missing | computed | probe ids without a run (missing) or all | "Run this group" when none run; "Run {k} missing" when some; the Menu offers "Run again (all variants)"; disabled with the key reason or while R6 is active | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run this group / Run k missing / Run again | (sync if needed) `POST /api/sessions/{id}/batch` `{probe_ids}` | R6 shows for this group; on `complete` refetch consistency and re-render only this panel plus R2/R3; Toast as R1 |
| Inline "Run" on one variant | `POST /api/sessions/{id}/batch` `{probe_ids: [probe_id]}` (the single-run route `POST /api/sessions/{id}/run`, app.py:372, would start the coach loop; a framing study measures the first reply, so batch is used) | as above |
| Badge / Run link | none | `#/probe/:s/run/:run_id` (the run's thread, where the label can be changed) |
| ▾ › View file | `GET /api/variants/files/{gid}` | Drawer "Variant file {gid}" listing `label` + `prompt_text` per variant with `is_baseline` marked and "File: flinch/variants/{gid}.md" (`source_file`); DB-only groups (no file) show "This group lives only in the database (legacy)." |
| ▾ › Edit in Library | none | `#/library/variants?group=:gid` |

### R5 Conditions groups
- Components: Panel (heading "Conditions groups", `count` Chip), List/Row, Chip (`tag` "conditions", labels), Button (secondary sm "Start as experiment"), Caveat (note), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows | `GET /api/variants/files` filtered `variant_type === 'conditions'` (db.py:1337-1339) | `group_id`, `title`, `labels[]`, `description` | title, tag, labels joined " · ", description | List/Row |
| Note | none | none | `experiment_not_here` caveat as a note: "This group changes the system prompt, not the request. Running it is an experiment: every probe in the session under each condition." (draft; brad-voice pass) | Caveat |
| Linked experiments | `GET /api/experiments` (app.py:2788) filtered by `description` starting "Auto-created from batch-conditions run for session {id}" (app.py:596) | `id`, `name`, `status` | "Earlier experiments from this group in this session: #{id} {name} ({status})" as links to `#/experiments/:id`; omitted when none | text links |
| Empty | none | none | the panel is hidden when there are no conditions groups | (none) |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Start as experiment | none | `#/experiments/new?variant_group={gid}&session={id}` (pre-filled wizard; nothing runs here; `POST /api/sessions/{id}/batch-conditions` is not called from Studies) |
| Experiment link | none | `#/experiments/:id` Conditions tab |

### R6 Running card
- Components: ProgressCard (`kind: 'batch'`), OutcomeBadge, Button (danger sm "Cancel").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | the group(s) being run | title or "every group" | "RUNNING · hotel-room-framing, 1 missing variant" | eyebrow |
| done | SSE `progress` / `error` (runner.py:241-266) | `completed` of `total` | "1 of 1 done" | `done` |
| outcomes | SSE `progress.classification` | per outcome | four badges with counts | `outcomes` |
| current | SSE | `probe_name` | "now: hotel-room-framing--satire" | `current` |
| failed | SSE `error` | count, `error` | amber "1 failed: {error}" | `failed` |
| Cancel | `POST /api/batch/{batch_id}/cancel` with `batch_id` from the first `progress` event (app.py:700) | | danger sm; before the first event the button is disabled with reason "Waiting for the first probe to finish." | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Cancel | `POST /api/batch/{id}/cancel` | Dialog "Stop after the current probe?" → status cancelled; refetch consistency |
| SSE `complete` (runner.py:278-285) | `GET /api/sessions/{id}/consistency` | R6 → done state for 3 s then hidden; R2, R3, R4 re-render |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | until session, consistency and variant files return | breadcrumb, buttons disabled | skeleton | skeletons | two pulse panels | hidden | hidden | (none) |
| not found | session 404 | "Studies › Framing" | hidden | hidden | EmptyState "There is no session {id}." with "Back to Studies" | hidden | hidden | (none) |
| no groups | `groups.length === 0` and no conditions files | enabled except Run every group (reason "No framings groups to run.") | "There are no variant groups yet. Make one in Library › Variant groups, then run it here." | hidden | EmptyState with action "Make a variant group" → `#/library/variants` | hidden | hidden | as R2 |
| nothing run | groups exist, `total_groups === 0` | enabled | "No group has two run variants yet, so there is no score. Run a group to get one." | SCORE "n/a"; GROUPS "0 of {all} counted"; VARIANTS RUN "0 of {n}" | every group NOT RUN YET with "Run this group" | as data | hidden | as R2 |
| partly run | some groups `has_data` | enabled | "{c} of {t} groups agree … {k} group(s) have not been run yet, so they are not counted." | values | mixed | as data | hidden | "1 of 2 groups agree: every framing of the request got the same label. 1 group has not been run yet, so it is not counted." |
| all run | every group `has_data` | enabled | "{c} of {t} groups agree: …" | values | AGREE / DISAGREE only | as data | hidden | "2 of 3 groups agree: every framing of the request got the same label." |
| conditions only | only conditions-type files | Run every group disabled ("No framings groups to run.") | "Every group here is a conditions group; those run as experiments, not here." | hidden | hidden | shown | hidden | as R2 |
| running | batch in flight | Run buttons disabled ("A run is already going.") | unchanged until complete | unchanged | the running group's rows show pending badges (`animate-pulse`) as their probe starts | as data | shown | unchanged |
| run done | SSE complete | enabled | recomputed | recomputed | recomputed | | done 3 s then hidden | recomputed; Toast "Ran 1 of 1; 0 failed." |
| run cancelled | cancel confirmed | enabled | recomputed | recomputed | recomputed | | cancelled with reason | recomputed |
| run failed | SSE `error` before any progress, or stream dropped | enabled | unchanged | | | | failed with the error string and Retry | Toast error "The run stopped: {error}." |
| no key | session provider key unset | Run buttons disabled with reason "{provider} has no API key. Set one in Settings › Keys." | as data | as data | inline Run buttons disabled with the same reason | Start as experiment stays enabled (the wizard checks keys) | hidden | as data |
| error | consistency fetch non-2xx | | "The results could not be loaded: {status}." with Retry | hidden | hidden | as available | hidden | as R2 |
| file viewer open | ▾ › View file | | | | | | | Drawer open, unchanged readout |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| k of n groups agree (R2, R3) | `consistent_count` of `total_groups`; `total_groups` = groups with ≥ 2 variants that have a run (db.py:1573-1581) | GROUPS Stat "{counted} of {all} counted: a group counts once 2 variants have runs" | Readout, Stat |
| consistency score 50% | `consistent_count ÷ total_groups × 100`, one decimal (db.py:1596-1600) | "1 of 2 groups agree" | Stat |
| variants run r of N | variants with `run_id !== null` over all variants | "latest run per variant in session {name}" | Stat |
| per group "{run} of {n} variants run" | non-null `classification` count of `variants.length` | the rows beneath | Panel subtitle |
| per group label bars | count of run variants per label ÷ run variants | "{pct}% ({count} of {run})" per row | Bar |
| run every group ({n} probes) | size of the union of framings groups' probe ids | in the button label | Button |
| R6 done k of N | `completed` of `total` from SSE (runner.py:245-250) | outcome badges with counts | ProgressCard |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `latest_only` | Each variant and each probe counts only its latest run. | R3 inline; R1 Run dialog | db.py:1547-1557 `ORDER BY r.id DESC LIMIT 1` |
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R3 inline; every badge tooltip | db.py:1554 `final || initial`; classifier.py |
| `two_needed` (new id) | A group counts once two of its variants have runs; one run cannot agree or disagree with itself. | GROUPS Stat; NOT RUN YET chips | db.py:1573-1575 `has_data = len(classifications) >= 2` |
| `disagree_def` (new id) | Disagree means at least two run variants got different labels; a missing variant is not a disagreement. | DISAGREE groups | db.py:1574-1575 `len(set(classifications)) == 1` over non-null only |
| `first_reply_only` | No coach, no pushback: a framing run measures the first reply only. | R1 Run dialog; R6 | the batch route sends and classifies once per probe (runner.py:235: `send_probe`), and the consistency label prefers `final_classification` when a pushback happened later (db.py:1554), which the badge `source` makes visible as "override" |
| `experiment_not_here` | A conditions group changes the system prompt, not the request; it runs as an experiment. | R5 | db.py:1463-1467; app.py:588-631 |
| `score_no_colour` (new id) | A score is not a grade: 50% from 2 groups is two groups. | SCORE Stat tooltip | db.py:1596 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| framing variant | R1, R4 | db.py:1324-1402; GenerateVariantsRequest strategies app.py:201-206 |
| variant group | R1, R4 | db.py:115-121 `probe_variants`; db.py:1253-1273 |
| baseline variant | R4 second line | db.py:1373 `is_baseline` (empty prompt text = no framing) |
| consistency score | R3 | db.py:1596-1600 |
| conditions group | R5 | db.py:1337-1339 |
| experiment | R5 | app.py:2771; IA §3 |
| run | R4 Run cell | db.py:44-57 |
| judge | caveats | classifier.py |
| session | R1 | db.py:31-41 |
| latest run | R3, R5 caveat | db.py:1547-1557 |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `framing.verdict` | first verdict chip (`data-tip="framing-verdict"`) | Agree means every run variant in this group got the same label. Disagree is the finding: the framing moved the label. | first visit with at least one judged group |
| `framing.missing` | first "Run k missing" button (`data-tip="framing-missing"`) | A group is not counted until two variants have runs. Run the missing ones to bring it in. | first visit with a partly run group |
| `framing.conditions` | first "Start as experiment" (`data-tip="framing-conditions"`) | This group changes the system prompt, not the request. It runs as an experiment with every probe under each condition. | first time R5 is visible |

## 8. Keyboard and focus
- Shortcuts: `r` runs every group (opens the confirm Dialog); `j`/`k` move between group panels; `Enter` on a focused badge opens the run; `Escape` closes the Drawer or the Dialog; `F8` newest Toast.
- Focus order: header → breadcrumb → Run every group → ⋯ → R3 Terms → per group: panel heading (focusable `h2` with `tabindex=-1` for `j`/`k`), Run button, ▾ menu, table rows left to right (badge link, run link, inline Run), Bar rows → R5 rows and their Start buttons. R6, when shown, follows R3. Drawer traps focus.
- Live regions: R2 Readout polite (once per data change); R6 counts line polite (throttled 3 s); the running group's panel gets `aria-busy="true"`.

## 9. Dialogs and overlays opened from here
- Dialog "Run {n} variant probes in {session}?" (intro: "Variants already run are run again; the latest run is what counts. No coach, no pushback.") primary "Run", cancel.
- Dialog "Stop after the current probe?" (R6 Cancel).
- Dialog "Leave while running?" (header session switch).
- Drawer "Variant file {gid}" (View file).
- ⋯ Menu; per-group ▾ Menu.
- FirstTimeTip ×3. Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/sessions | R0 pill |
| GET | /api/sessions/{id} | R1 meta, R4 run rows (`runs[]` for `initial_classification`, `final_classification`, `created_at` by `run_id`) |
| GET | /api/sessions/{id}/consistency | R2, R3, R4 (and after every run) |
| GET | /api/variants/files | R4 titles and descriptions, R5 |
| GET | /api/variants/files/{gid} | R4 base probe and `is_baseline`; View file drawer; sync-before-run |
| POST | /api/variants/files | sync-before-run for a file group with no DB members (idempotent) |
| GET | /api/probe-groups | R4 membership (`probe_id` per variant when the consistency payload is empty for a group not yet synced) |
| GET | /api/probe-groups/{gid} | probe ids after sync |
| POST | /api/sessions/{id}/batch | R1 Run every group; R4 Run this group / Run k missing / Run again / inline Run (SSE) |
| POST | /api/batch/{id}/cancel | R6 Cancel |
| GET | /api/experiments | R5 linked experiments |
| GET | /api/settings/keys | R0; Run disabled reasons |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With `GET /api/sessions/3/consistency` returning two groups with `has_data: true` (one `consistent: true`, one `false`) and one with `has_data: false`, the Readout text is exactly "1 of 2 groups agree: every framing of the request got the same label. 1 group has not been run yet, so it is not counted."
2. The CONSISTENCY SCORE Stat shows "50%" with madeOf "1 of 2 groups agree"; the GROUPS Stat shows "2 of 3 counted"; no element carries a green or amber colour class based on the score.
3. R4 panel order is: the DISAGREE group first, then AGREE, then NOT RUN YET; each panel's verdict chip text is one of exactly "AGREE", "DISAGREE", "NOT RUN YET".
4. In a group where a variant's run has `initial_classification: "refused"` and `final_classification: "collapsed"`, the badge reads "COLLAPSED" and its tooltip contains "override: collapsed".
5. A variant whose `classification` is null renders the text "not run" and a button "Run" whose click issues `POST /api/sessions/3/batch` with `probe_ids` equal to `[that probe_id]` and nothing else.
6. "Run 1 missing" on a partly run group opens no dialog and issues one batch request whose `probe_ids` are exactly the null-classification variants of that group; "Run every group" opens a dialog containing "the latest run is what counts" and, on confirm, a batch whose `probe_ids` equal the union of every framings group's probe ids with no duplicates.
7. A variant whose file entry has `is_baseline: true` shows the second line "baseline (no framing)".
8. A conditions-type file group never appears in R4, appears in R5 with the text "Running it is an experiment", and its button sets the hash to `#/experiments/new?variant_group={gid}&session=3`; no request to `/api/sessions/3/batch-conditions` is ever made from this screen (network spy).
9. During a run, R6 shows "{completed} of {total} done" matching the last SSE `progress` event and the running group's unlabelled rows show a pulsing badge; after `complete`, `GET /api/sessions/3/consistency` is requested again and the group panel re-renders with the new labels.
10. With `GET /api/settings/keys` reporting the session provider unset, every Run button is `aria-disabled` with a reason ending "Settings › Keys." while "Start as experiment" is enabled.
11. Each badge's link `href` is `#/probe/3/run/{run_id}`.
12. The screen contains the exact strings "Each variant and each probe counts only its latest run." and "The label is a keyword scan plus a judge model's guess. You can change it."
13. At 1024×700 the group tables show the probe name under the variant label in a mono line, the Bar values wrap under the track when the container is ≤ 440 px, and `main` has no horizontal scroll.
14. With zero groups and zero conditions files, the page shows an EmptyState whose button "Make a variant group" sets the hash to `#/library/variants`.

## 12. Open questions for Brad
1. **The consistency payload has no run dates and no raw halves.** `compute_consistency` returns `classification` and `run_id` only (db.py:1559-1565). The screen reads `GET /api/sessions/{id}` for `initial_classification`, `final_classification` and `created_at` by `run_id` (one extra call that grows with the session). Extending `compute_consistency` with those three fields removes it. Want that?
2. **Framing runs reuse the probe batch route**, which also starts no coach loop, so the "first reply only" caveat holds; but a variant that was later pushed back in the workbench shows its `final_classification` here (db.py:1554). Keep "final wins" (today's rule) or switch the framing study to `initial_classification` only? The badge source makes either visible.
3. **The study is the session.** There is no framing study record; the route is `#/studies/framing/:session`. If you want named, repeatable framing studies (same group, run three times, compared), that is a new table.
4. Conditions groups: the spec sends them to `#/experiments/new` pre-filled and never calls `batch-conditions` from Studies. Confirm that the existing auto-create path (app.py:588-631) can be retired from the UI once the wizard accepts `?variant_group=`.
5. Should "Run every group" also sync every unsynced file group first (it does in this spec, via re-posting the file), or should only explicitly chosen groups be synced?
