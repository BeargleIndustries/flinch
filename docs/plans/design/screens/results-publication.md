# Results › Publication export

- Route(s): `#/results/publication`, `#/results/publication/:exportId` (a saved export shown)
- Section: Results
- Purpose (one sentence, what the researcher does here): generate a table or report from the recorded runs in a chosen template, format and theme, see exactly what the server produced (with the caveats the server does not print), and download or copy it.
- Arrives from: Results sub-nav; Results overview "Export ▾ › Publication table…" on a session row (prefills the model filter); Experiments › Export "Publication report" link. Leaves to: Results overview; Library › Coach examples (from the pushback-table caveat); the file itself.
- Components used: Header, PrimaryNav, Tabs, Panel, Readout, Segmented, Select, Chip, Input, Checkbox, Button, Menu, InsetBox, Caveat, Term, Toast, EmptyState, FirstTimeTip, Progress (inline while generating).
- Baseline surfaces replaced: §24 "Dashboard › Publication Export" (template and format radios, model and domain filters, theme select with a fixed three-row sample preview, Generate Preview, `<pre>` preview, Download without an extension, Copy).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Results …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Overview   Policy scorecard   Publication export                                 │
├──────────────────────┬───────────────────────────────────────────────────────────────┤
│ R2 BUILD             │ R3 PREVIEW                                                    │
│ Name [sonnet-vs-gpt] │ ┌ Model comparison · markdown · Beargle Dark  saved as #12 ──┐│
│ Template             │ │ ▣ In plain words: 2 models, 184 runs between them. The     ││
│ (•) Model comparison │ │   table's Refusal Rate is refused ÷ runs; the runs count   ││
│ ( ) Consistency matrix│ │   is not a column, so it is listed here: claude-sonnet-4-6 ││
│ ( ) Pushback effect. │ │   112 runs, gpt-4o-2024-08-06 72 runs.                     ││
│ ( ) Full report      │ ├───────────────────────────────────────────────────────────┤│
│ Format               │ │ | Model              | Probes | Refused | … | Refusal Rate |││
│ (Markdown|HTML|CSV|PDF)│ │ | claude-sonnet-4-6  | 48     | 71      | … | 63.4%        |││
│ Filters (this template)│ │ | gpt-4o-2024-08-06  | 48     | 30      | … | 41.7%        |││
│ Models [✓ sonnet] [✓ gpt-4o]│                                                      ││
│ Domains [all ▾]      │ │ ⓘ First label per run, before any pushback.               ││
│ Dates [from] [to]    │ │ ⓘ A rate from 72 runs is a rate from 72 runs.             ││
│ Labels [✓R ✓C ✓N ✓Co]│ │ ⓘ The label is a keyword scan plus a judge model's guess. ││
│ Theme [Beargle Dark▾]│ ├───────────────────────────────────────────────────────────┤│
│ ┌ theme swatch ─────┐│ │ (Rendered | Source)  rendered HTML in a sandboxed frame     ││
│ │ Aa  ■ ■ ■  bg/acc ││ │ [Download sonnet-vs-gpt.md] [Copy] [Open in Results ▾]     ││
│ └───────────────────┘│ └───────────────────────────────────────────────────────────┘│
│ [Generate]           │ R4 PAST EXPORTS (5)                                           │
│                      │  #12 sonnet-vs-gpt · comparison_table · markdown · 14:05 [Open]│
│                      │  #11 q3-report · full_report · html · Mon            [Open]   │
└──────────────────────┴───────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
The two columns stack: R2 (build) first, then R3 preview full width, then R4. The Segmented format control wraps to two rows of two. Nothing is hidden.

## 2. Regions

### R0 Header, R1 Results sub-nav
As `results.md`.

### R2 Build form
- Components: Panel ("Build"), Input (name), Segmented or radio List (template), Segmented (format), Chip (models), Select (domains, multi), Input type=date ×2, Checkbox ×4 (labels), Select (theme), InsetBox (theme swatch), Button (primary "Generate", loading "Generating…").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| name | | `PublicationExportRequest.name` (models.py:146, max 200) | default "{template}-{local date}"; required; used as the download filename with spaces as underscores (app.py:2706) | Input |
| template | | `template` ∈ comparison_table, consistency_matrix, pushback_summary, full_report (app.py:2651-2656) | labels "Model comparison", "Consistency matrix", "Pushback effectiveness", "Full report", each with one sentence under it: "Per model: probes, the four first-label counts, refusal rate." / "Probe × model: refused share of repeat-study runs." / "Per pushback move: uses and successes from coach examples." / "All three plus summary lines." | radio List |
| format | | `format` | "Markdown", "HTML", "CSV", "PDF"; PDF disabled with reason "PDF needs the server fix in Q1." until resolved (see §12); JSON is not offered: the download route has no JSON type (app.py:2697-2705 → text/plain) and the generators have no JSON branch (publication.py:110-151) | Segmented |
| filters header | | | "Filters (this template)" with a line naming which apply: comparison and full report: models, domains, dates, labels (publication.py:38-76); consistency matrix: models, domains, dates (78-100); pushback: models only (331-357). Inapplicable controls are disabled with reason "Not used by this template." | text |
| models | `GET /api/sessions` `target_model` distinct, plus stat-run models | `filters.models[]` | chips, all selected; "none selected" means no filter (the key is omitted) | Chip |
| domains | `GET /api/probes` distinct `domain` | `filters.domains[]` | multi-select; empty = no filter | Select |
| dates | | `filters.date_range {start, end}` | ISO date strings; sent as "YYYY-MM-DD" and "YYYY-MM-DDT23:59:59" for end; empty = omitted | Input date |
| labels | | `filters.classifications[]` | four checkboxes with OutcomeBadge words; all checked = key omitted | Checkbox |
| theme | `GET /api/themes` (app.py:2730-2743) | `name`, `display_name`, `description`, `is_builtin` | options "Beargle Dark", "Clean Light", "Neutral Dark" (flinch/themes/presets.md), `title` = description, "built in" tag | Select |
| theme swatch | `GET /api/themes/{name}` (app.py:2746-2755; models.py:153-191) | `bg_color`, `bg_secondary`, `text_color`, `accent_color`, `border_color`, `heading_color`, `color_high`, `color_mid`, `color_low`, `font_body`, `font_heading`, `font_mono`, `header_text`, `header_subtitle` | an InsetBox painted with the theme: "Aa" in `font_heading`/`heading_color`, body sample in `font_body`, three outcome swatches, header text when set; hint "Theme applies to HTML and PDF. Markdown and CSV carry no styling." | InsetBox |
| Generate | | | disabled with reason "Give the export a name." when name empty | Button |

- Actions:

| Control | Calls | Then |
|---|---|---|
| theme change | `GET /api/themes/{name}` | swatch repaints; if a preview exists and format is HTML, R3's rendered frame reloads with `GET /api/themes/{name}/preview-css` injected (app.py:2758-2763) so the theme can be tried without regenerating |
| Generate | `POST /api/publication/export {name, format, template, filters, theme}` (app.py:2644-2674) | → `{export_id, preview}`; R3 renders; route `#/results/publication/:export_id`; R4 refreshes; Toast "Saved export #12." |

### R3 Preview
- Components: Panel (heading "{template label} · {format} · {theme display_name}", subtitle "saved as #12 · {created_at}"), Readout, Segmented ("Rendered" / "Source"), sandboxed `<iframe sandbox srcdoc>` (rendered) or `<pre>` (source), Caveat ×n, Button (primary sm "Download {name}.{ext}", secondary sm "Copy", Menu "Open in Results").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| readout | the `preview` string plus a parallel stats call | see Numbers | comparison: "2 models, 184 runs between them. The table's Refusal Rate is refused ÷ runs; the runs count is not a column, so it is listed here: claude-sonnet-4-6 112 runs, gpt-4o-2024-08-06 72 runs." The per-model run totals come from `GET /api/dashboard/sessions` filtered by the same models and summed `run_count` (an approximation when domain or date filters are set; then the sentence says "about" and names the filters). Matrix: "Cells are refused ÷ runs in a repeat study, 0.00 to 1.00; a blank cell is no repeat study for that pair." Pushback: "Successes are examples whose outcome was collapsed or complied. Without a model filter the 3 shipped examples count too." Full report: the three sentences in order. | Readout |
| rendered | `preview` | | HTML format: `srcdoc` = the preview (it already includes the theme CSS for full_report, publication.py:446-466; for the other templates the client wraps the fragment with `GET /api/themes/{name}/preview-css`); Markdown: rendered client-side with a small Markdown renderer in the same frame; CSV: a Table built from the rows | iframe `sandbox=""` (no scripts) |
| source | `preview` | | `<pre class="font-mono text-xs">` verbatim | pre |
| empty result | `preview` matches `_empty_message` (publication.py:503-508: "*No runs found matching filters.*", "*No stat runs found matching filters.*", "*No coach examples found matching filters.*") | | EmptyState with the server sentence rewritten: "No runs match these filters. Widen the models, domains or dates." (the Source tab still shows the raw string) | EmptyState |
| caveats | | | comparison and report: `initial_only`, `rate_n` (N = smallest run total), `classifier`, `pct_one_decimal`; matrix: `matrix_fraction`, `rate_n`; pushback: `success_def`, `seeded_examples` (when no model filter); all: `table_as_generated` | Caveat |
| Download | `GET /api/publication/exports/{id}/download` (app.py:2692-2724) | the server sets `Content-Disposition: attachment; filename="{name}.{md|html|csv|pdf}"` (app.py:2697-2706); the client uses it and never invents a filename (fixes inventory §24 "no extension") | Button |
| Copy | none | `navigator.clipboard.writeText(preview)`; button label "Copied" for 2 s; Toast "Copied 1 842 characters." | Button |
| Open in Results | none | Menu: "Sessions with these models" → `#/results?kind=sessions&models=…`; "Coach examples" → `#/library/coach` (pushback template) | Menu |

### R4 Past exports
- Components: Panel ("Past exports (5)"), List rows, Button (secondary sm "Open"), EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| row | `GET /api/publication/exports` (app.py:2677-2680; db.py:3192-3196) | `id`, `name`, `format`, `template`, `created_at` | "#12 sonnet-vs-gpt · Model comparison · markdown · 14:05" | Row |
| empty | `[]` | | EmptyState "No exports yet. Build one on the left." | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Open | `GET /api/publication/exports/{id}` (app.py:2683-2689; db.py:3180-3190) → `{id, name, format, template, filters, content, created_at}` | R3 shows `content`; R2 fills from `filters`, `template`, `format` (theme is not stored, db.py:308-316, so the select shows "theme not recorded" as a disabled first option); route `#/results/publication/:id` |

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | route enter | themes/models pulse | EmptyState "Pick a template and press Generate." | pulse rows | (wrapper only) |
| no runs | `GET /api/dashboard/stats` `total_runs == 0` | Generate enabled (the server returns the empty message) | EmptyState | | "Nothing to export yet: there are no runs." |
| ready | | form | EmptyState "Pick a template…" | rows | (wrapper only) |
| template changed | radio | inapplicable filters disabled with reason | unchanged | | |
| theme loading | select change | swatch pulse | | | |
| generating | Generate | primary loading; Progress indeterminate | skeleton | | "Generating a Model comparison in Markdown…" |
| generated | 200 | | preview, caveats, buttons | new row first | template sentence (see R3) |
| generated, empty | server empty message | | EmptyState (rewritten) with Source tab | row still saved (the server saves empty content too, app.py:2664-2666) | "No runs match these filters." |
| generate error | 400 unknown template / 500 "Export generation failed: …" (app.py:2660, 2674) | error Toast with the detail | previous stays | | |
| PDF chosen | | format disabled with reason | | | |
| past export opened | Open | prefilled; theme "not recorded" | content | row selected | sentence recomputed when the template is known |
| copied | Copy | | label "Copied" 2 s | | |
| no key | | no change (no key needed) | | | |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Refusal Rate column (e.g. "63.4%") | server `_pct(refused, total_runs)` = `refused / total_runs` to one decimal (publication.py:22-25); `total_runs` = `COUNT(r.id)` per model (201-215) | not in the table (only Probes = distinct probe ids, and the four counts); the Readout lists runs per model and the `pct_one_decimal` caveat says the denominator | Readout |
| Probes column | `COUNT(DISTINCT r.probe_id)` | | table as generated |
| Matrix cell "0.70" | `refused / total` iterations per probe × model, `round(…, 4)` printed `:.2f` (publication.py:291-307); no-iteration pair prints "—"; a pair with `_rate` None prints 0.00 (299) | `matrix_fraction` caveat; N per cell is not printed by the server | Caveat |
| Success Rate | `successes / total` per move, `_pct` (publication.py:362-391) | Uses and Successes columns are present | table |
| Overall refusal rate (full report) | `_pct(stats.refused, stats.total_runs)` (publication.py:432, 449, 476) | "Total runs" line is in the same header block | table |
| "184 runs between them" | Σ `run_count` of `GET /api/dashboard/sessions` rows with those models | per-model list in the sentence | Readout |
| "3 shipped examples count too" | `GET /api/coach-examples` rows with `run_id` null | | Readout |
| "1 842 characters" | `preview.length` | | Toast |
| "(5)" | exports length | | R4 heading |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `table_as_generated` | "The table is shown exactly as the server wrote it; the notes below it are not in the file." | R3 above the caveats | app.py:2663 `preview = content` |
| `pct_one_decimal` | "Refusal Rate is refused ÷ runs for that model, to one decimal. The runs column is not in the table; the counts are in the sentence above." | comparison, full report | publication.py:22-25, 215, 237 |
| `rate_n` | "A rate from N runs is a rate from N runs." | every template | `03-components.md §5` |
| `initial_only` | "First label per run, before any pushback." | comparison, full report | publication.py:205-208 `initial_classification` |
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | comparison, report | classifier.py |
| `matrix_fraction` | "A matrix cell is refused ÷ runs in that repeat study, printed 0.00 to 1.00 without its N. A dash is no repeat study for that pair." | matrix | publication.py:291-307 |
| `success_def` | "Success means the example's outcome was collapsed or complied, by the labels in this database." | pushback | publication.py:326, 338-355 |
| `seeded_examples` | "Without a model filter the 3 examples shipped with Flinch count as uses; they were never sent to a model." | pushback, no model filter | publication.py:347-357 (no join); seed.py `run_id=None` |
| `theme_not_stored` | "The theme is not saved with an export; pick it again before downloading an old HTML export." | R4 Open | db.py:308-316 (no theme column) |
| `empty_saved` | "An export with no matching rows is still saved." | generated-empty state | app.py:2664-2666 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| template | R2 | glossary |
| theme | R2, R3 | glossary |
| first label | caveats | glossary |
| repeat study (stat run) | matrix | glossary |
| pushback move | pushback table | glossary; models.py:17-24 |
| coach example | pushback | glossary → `library-coach.md` |
| refusal rate | tables | glossary ("refused ÷ runs; the N is the runs count") |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `pub.filters` | filters header | "Only the filters a template uses are live. The others are greyed out with the reason." | first visit |
| `pub.caveats` | first caveat under a preview | "The notes under the table are not in the file. Copy them into your write-up if you need them." | first generated preview |
| `pub.theme` | theme select | "Themes only change HTML and PDF. Markdown and CSV are plain." | first theme change |

## 8. Keyboard and focus
- Shortcuts: `Ctrl+Enter` generates; `Ctrl+C` while the preview frame is focused copies the source; `Esc` closes menus.
- Focus order: header → sub-nav → name → template radios (arrow keys) → format segmented → filters → theme → Generate → preview tabs → iframe (`tabindex=0`, `title="Preview"`) → Download → Copy → Open in Results → past exports.
- Live regions: Readout; "Generating…" announced once; Toasts.

## 9. Dialogs and overlays opened from here
- Open-in-Results Menu. No dialogs (exports have no delete route; see Q2).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/themes` | R2 theme select |
| GET | `/api/themes/{name}` | R2 swatch |
| GET | `/api/themes/{name}/preview-css` | R3 rendered frame (non-report HTML, Markdown re-theme) |
| GET | `/api/sessions` | R2 model chips |
| GET | `/api/probes` | R2 domain select |
| GET | `/api/dashboard/sessions` | R3 readout run totals |
| GET | `/api/dashboard/stats` | no-runs state |
| GET | `/api/coach-examples?profile=standard` | R3 pushback readout (shipped count) |
| POST | `/api/publication/export` | Generate |
| GET | `/api/publication/exports` | R4 |
| GET | `/api/publication/exports/{export_id}` | R4 Open, `#/results/publication/:id` |
| GET | `/api/publication/exports/{export_id}/download` | Download |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Choosing "Pushback effectiveness" disables the Domains, Dates and Labels controls with the visible reason "Not used by this template."; the request body then contains `filters: {models: […]}` only (or `{}` when every model chip is selected).
2. Generate sends `{"name":"sonnet-vs-gpt","format":"markdown","template":"comparison_table","filters":{…},"theme":"beargle-dark"}`; the response `preview` appears verbatim in the Source tab (string equality).
3. The Download button's `href` is `/api/publication/exports/{id}/download` and the saved file name comes from the response header (test: the anchor has no `download` attribute with a client-invented name).
4. With the fixture preview `| Model | Probes | Refused | Collapsed | Negotiated | Complied | Refusal Rate |` and two rows, the Readout contains "2 models" and lists a runs count per model, and the `pct_one_decimal` and `rate_n` phrases are present under the preview.
5. For a pushback export with no model filter the `seeded_examples` phrase is present; with a model filter it is absent.
6. The rendered frame is an `<iframe sandbox>` whose `sandbox` attribute does not contain `allow-scripts`.
7. The PDF segment is `aria-disabled` with a visible reason until Q1 is resolved; JSON does not appear in the format control.
8. Opening a past export fills the template and format from the record, shows the theme select's "theme not recorded" option selected and disabled, and the `theme_not_stored` phrase.
9. A server empty message (e.g. `*No runs found matching filters.*`) renders the EmptyState text "No runs match these filters. Widen the models, domains or dates." in Rendered and the raw string in Source.
10. At 1024×700 the build form stacks above the preview and no horizontal scroll exists.

## 12. Open questions for Brad
1. PDF is broken two ways today: `generate_full_report(format="pdf")` returns bytes (publication.py:467-469) that `POST /api/publication/export` stores and tries to return as JSON (app.py:2663-2668), and for the other templates the download route runs `html_to_pdf` over Markdown text (app.py:2708-2714; `_format_table` has no pdf branch). WeasyPrint is also an optional install (themes/__init__.py:410-421). Fix the server (render HTML, convert on download only) and ship PDF, or drop PDF from this release?
2. Exports accumulate with no delete route (`publication_exports`, db.py:308-316). Add `DELETE /api/publication/exports/{id}`?
3. Add `theme` and `total_runs` per model to the stored export / the comparison table so the file carries its own N (then `pct_one_decimal` shrinks to the one-decimal note)?
