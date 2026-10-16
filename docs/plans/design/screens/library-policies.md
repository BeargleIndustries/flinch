# Library › Policy claims

- Route(s): `#/library/policies`, `#/library/policies/:provider` (tab), `#/library/policies/:provider/:claimId` (claim drawer open)
- Section: Library
- Purpose (one sentence, what the researcher does here): read the provider content-policy claims Flinch can score against, and link probes to the claims they test so the Policy scorecard has something to count.
- Arrives from: Library tab strip; Results › Scorecard "Link probes to claims" link (when a claim has no linked probes); Library › Probes claim chip. Leaves to: Results › Scorecard (`#/results/scorecard`); Library › Probes (`#/library/probes/:id`) from a linked-probe chip.
- Components used: Header, PrimaryNav, Tabs (Library strip and provider Tabs), Panel, Readout, EmptyState, Table, Chip, Drawer, Dialog, Button, Input, Checkbox, Toast, Term, Caveat, FirstTimeTip.
- Baseline surfaces replaced: §25 "Policy Claims Browser" (provider tabs, claim rows, expand detail) plus the never-reachable probe-claim links (routes app.py:1896-1912; dead client functions api.js:949-958). §26 Compliance scorecard stays dropped (IA §4).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Library …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Probes   Variant groups   Policy claims   Coach examples   Narrative strategies  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ Policy claims  17 claims · 4 providers · 6 linked to probes ──────────────────┐ │
│    │ ▣ In plain words: Each row is Flinch's one-line summary of a rule a provider  │ │
│    │   publishes. It is a paraphrase, not a quote. Link probes to a claim and the  │ │
│    │   scorecard counts how often the model refused those probes.                 │ │
│    │  All 17   Anthropic 5   OpenAI 5   Google 4   xAI 3        [search claims…  ] │ │
│    ├──────────────────────────────────────────────────────────────────────────────┤ │
│ R3 │ Sev  Provider   Claim                           Category   Expected  Probes   │ │
│    │ ●    anthropic  weapons-mass-destruction          Weapons    refuse    0       │ │
│    │      Do not provide instructions for creating biological, chemical, …        │ │
│    │ ●    anthropic  graphic-violence                  Violence   refuse    4       │ │
│    │      Avoid gratuitous depictions of graphic violence                          │ │
│    │ ○    google     medical-advice                    Professional refuse  2      │ │
│    │ ○    xai        adult-content-optin               Sexual     allow     0       │ │
│    │ …                                                                            │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R4 (drawer, 440 px)                                                                  │
│    ┌ anthropic / graphic-violence                                          [×] ┐    │
│    │ Violence · severity medium · expected: should refuse                       │    │
│    │ CLAIM (Flinch's summary)  Avoid gratuitous depictions of graphic violence  │    │
│    │ TESTABLE AS   Model should refuse gratuitous violence but may allow …       │    │
│    │ NOTES         Subjective qualifier: 'gratuitous'                            │    │
│    │ ⓘ The claim text is Flinch's paraphrase of the provider's policy, not a     │    │
│    │   quotation, and carries no link to the source page.                        │    │
│    │ LINKED PROBES (4)  the-stabbing ×  the-robbery ×  violence-framing--… ×     │    │
│    │ [Link probes…]                                                              │    │
│    │ [See this claim on the scorecard]                                           │    │
│    └─────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
R3 hides nothing: the Claim column wraps to two lines and Category becomes a chip under the claim id. Provider tabs keep their counts. Drawer unchanged.

## 2. Regions

### R0 Header, R1 Library tab strip
As `library-probes.md`.

### R2 Panel heading, readout, provider tabs, search
- Components: Panel, Readout, Tabs (`aria-label="Provider"`), Input (header variant).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| subtitle | `GET /api/policies` | object keyed by provider → arrays (app.py:1879-1888) | "17 claims · 4 providers · 6 linked to probes"; linked count = claims with ≥ 1 linked probe (see R3 "Probes" column) | Panel subtitle |
| readout | | | fixed sentence (first visit) then "17 claims, 6 with linked probes. 11 claims will show as not tested on the scorecard." | Readout |
| provider tabs | `GET /api/policies` | keys, array lengths | "All 17", then one per provider in payload order with its count; provider shown as the raw key with Term (`anthropic`, `openai`, `google`, `xai`); never calls `GET /api/policies/{provider}` (it returns an array, inventory §25 defect) | Tabs with count pills |
| search | client | matches `claim_id`, `claim_text`, `category`, `testable_statement` | placeholder "Search claims…" | Input |

- Actions:

| Control | Calls | Then |
|---|---|---|
| provider tab | none | client filter; route `#/library/policies/:provider` |
| search | none | client filter; `?q=` |

### R3 Claims table
- Components: Table (columns: severity, provider, claim, category, expected, probes), Chip, EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| severity | `GET /api/policies` | `severity` (db.py:140; seeds: hard/medium/soft) | dot: hard `bg-red-400`, medium `bg-amber-400`, soft `bg-zinc-500`, plus sr-only word; the word is also in the row `title`; unknown value → hollow dot and "unrated" | Table badge-like cell |
| provider | | `provider` | mono | text |
| claim id + text | | `claim_id`, `claim_text` | id mono on line 1; `claim_text` on line 2 in `text-zinc-400`, truncated at 110 characters | text |
| category | | `category` | tag chip | Chip |
| expected | | `expected_behavior` | "refuse" / "allow" / "warn" / "context" from `should_refuse`, `should_allow`, `should_warn`, `context_dependent` (db.py:3083-3086 docstring; seeds use the first two) with Term `expected behaviour`; unknown value shown raw in mono | text |
| probes | `GET /api/probes/{id}/claims` for every probe (cached per Library visit) inverted client-side to claim → probes | count of probes linked to this claim | number; "0" in `text-zinc-500` with `title` "No probe linked; the scorecard cannot test this claim." | number cell |
| empty (search) | | | EmptyState "No claim matches that search." | EmptyState |
| empty (no claims) | `GET /api/policies` returns `{}` | | EmptyState "No policy claims in the database. They are seeded on first start; restart Flinch to seed them." | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| row activate | none (data already loaded) | drawer R4; route `#/library/policies/:provider/:claimId` |
| sort headers | none | sorts by provider, category, severity (hard > medium > soft), probes |

### R4 Claim drawer
- Components: Drawer, InsetBox, Chip (removable), Button, Caveat note.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| title | `GET /api/policies` | `provider`, `claim_id` | "anthropic / graphic-violence" mono | Drawer title |
| meta | | `category`, `severity`, `expected_behavior` | "Violence · severity medium · expected: should refuse" | text |
| claim | | `claim_text` | eyebrow "CLAIM (Flinch's summary)" | InsetBox |
| testable as | | `testable_statement` | eyebrow "TESTABLE AS" | InsetBox |
| notes | | `notes` | shown when non-empty; the seed notes include "NOT tested by Flinch default probes" for CSAM claims (seeds/policies.py), which is shown verbatim | InsetBox |
| provenance caveat | | | Caveat `claim_paraphrase` as note | Caveat |
| linked probes | inverted `GET /api/probes/{id}/claims` | probe `id`, `name` | removable chips "the-stabbing ×" ("Unlink the-stabbing") linking to `#/library/probes/:id`; "(4)" count; none → "No probe linked yet." | Chip |
| Link probes… | `GET /api/probes` | | opens D1 | Button secondary sm |
| scorecard link | | | text button → `#/results/scorecard?claim=:id` | Button text |

- Actions:

| Control | Calls | Then |
|---|---|---|
| chip Remove | `DELETE /api/probes/{probe_id}/claims/{claim_id}` (app.py:1904-1907) | chip removed; R3 count −1; Toast "Unlinked the-stabbing from graphic-violence." |
| D1 primary | `POST /api/probes/{probe_id}/claims {claim_ids: [id]}` once per chosen probe (app.py:1896-1901; the route is per probe, so k probes = k calls, sent in parallel) | chips added; Toast "Linked 3 probes to graphic-violence." |

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | route enter | pulse | three pulse rows | closed | (wrapper only) |
| loading links | after claims load, while per-probe claim calls run | subtitle "… · linking…" | Probes column shows "…" `animate-pulse` | | "17 claims. Counting linked probes…" |
| with data | | counts | rows | closed | "Each row is Flinch's one-line summary of a rule a provider publishes. It is a paraphrase, not a quote. …" |
| no claims | `{}` | "0 claims" | EmptyState | | "No policy claims are in the database." |
| provider filtered | tab | tab selected | rows of that provider | | "5 Anthropic claims, 2 with linked probes." |
| search, no match | | | EmptyState | | "No claim matches "foo"." |
| drawer open | row | | row selected | open | unchanged |
| linking | D1 primary | | | chips pulse | |
| link error | 4xx/5xx | | | error line in drawer | |
| no key | | no change (no key needed) | | | |
| error | `GET /api/policies` fails | | EmptyState with "Try again" | | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "17 claims" | sum of array lengths in `GET /api/policies` | "4 providers" | Panel subtitle |
| "6 linked to probes" | claims with ≥ 1 entry in the inverted link map | per-row Probes column | subtitle, Readout |
| "11 claims will show as not tested" | claims − linked | | Readout |
| per-provider tab count | array length | | Tabs pill |
| Probes column | linked probe count per claim | drawer lists the names | Table |
| "(4)" | linked chips count | the chips | R4 |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `claim_paraphrase` | "The claim text is Flinch's paraphrase of the provider's policy, not a quotation, and carries no link to the source page." | R2 readout, R4 note | seeds/policies.py:1-20 (plain strings, no URL or date field; db.py:132-144 has no source column) |
| `claim_untested` | "A claim with no linked probe cannot appear on the scorecard." | Probes "0" title, Readout | db.py:3098-3101 joins through `probe_claim_links`; 3119-3120 skips `total == 0` |
| `claim_seed_date` | "Claims were written when Flinch's seed file was last edited; providers change their policies." | R4 note (second sentence of the same note) | seeds/policies.py has no `last_checked`; `created_at` is the DB row date (db.py:142) |
| `csam_not_tested` | (verbatim seed note) "NOT tested by Flinch default probes" | R4 notes for the three CSAM claims | seeds/policies.py notes field |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| policy claim | heading, readout | glossary |
| expected behaviour | column header | glossary; db.py:139 values |
| severity | column header | glossary; seeds hard/medium/soft |
| testable statement | R4 eyebrow | glossary; db.py:138 |
| scorecard | R4 link | glossary → `results-scorecard.md` |
| provider (anthropic, openai, google, xai) | tabs | glossary entries name the company and the key env var |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `lib.policies.link` | first "0" in the Probes column | "A claim only counts on the scorecard once probes are linked to it. Open a claim and link the probes that test it." | first visit with 0 linked claims |
| `lib.policies.paraphrase` | the readout | "These are Flinch's summaries, not the providers' words. Check the provider's page before quoting one." | first visit |

## 8. Keyboard and focus
- Shortcuts: `/` search; `←/→` on the provider tablist; `↑/↓`, `Enter` on rows; `Esc` closes the drawer, then clears search.
- Focus order: header → Library tabs → provider tabs → search → table headers (sort buttons) → rows → drawer.
- Live regions: Readout; "Linked 3 probes" via Toast `role="status"`; the linking skeleton announces "Counting linked probes" once.

## 9. Dialogs and overlays opened from here
- **D1 Link probes** (Dialog wide): the ProbeList rows (`03-components.md §25`, no session footer) with search and domain filter and checkboxes; already-linked probes checked and disabled with reason "already linked"; primary "Link 3 probes"; intro names the claim and its expected behaviour so the researcher links probes that test it.
- Drawer R4; Toasts; tips.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/policies` | R2/R3 load |
| GET | `/api/probes` | link map (ids), D1 |
| GET | `/api/probes/{probe_id}/claims` | link map, one call per probe, parallel, cached for the Library visit |
| POST | `/api/probes/{probe_id}/claims` | D1 |
| DELETE | `/api/probes/{probe_id}/claims/{claim_id}` | R4 chip Remove |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With the seed data (seeds/policies.py), R3 renders 17 rows; the provider tabs read "All 17", "anthropic 5", "openai 5", "google 4", "xai 3" (as count pills).
2. No request to `/api/policies/{provider}` is made when switching tabs (network assertion).
3. The row for `xai/adult-content-optin` shows expected "allow"; every other seed row shows "refuse".
4. The Readout contains the exact phrase "It is a paraphrase, not a quote." and the drawer contains the `claim_paraphrase` caveat phrase.
5. After linking two probes in D1, two `POST /api/probes/{id}/claims` requests are sent with body `{"claim_ids":[<claim db id>]}`, the drawer shows two removable chips, and the R3 Probes cell reads "2".
6. Removing a chip sends `DELETE /api/probes/{probe_id}/claims/{claim_id}` with the claim's DB `id` (not its `claim_id` slug).
7. The three CSAM rows show the seed note text containing "NOT tested by Flinch default probes" in the drawer.
8. Severity dots have an sr-only text node with the word; the row `title` includes it.
9. At 1024×700 the table has no horizontal scroll and the Claim column wraps.

## 12. Open questions for Brad
1. There is no route listing probes per claim; this spec fans out `GET /api/probes/{id}/claims` across every probe (48 calls for the default set). Add `GET /api/policies/claims/{id}/probes` or a `probe_ids` field to `/api/policies`?
2. Should the seed gain `source_url` and `last_checked` columns so the drawer can link to the provider page? Until then the caveat says there is no link.
3. "expected behaviour" values `should_warn` and `context_dependent` appear only in a docstring (db.py:3083-3086); no seed uses them. Keep the four-way display or show only refuse/allow?
