# Brillo Travel — Design System

| | |
|---|---|
| **Status** | Draft 0.5, Oct 15, 2026 ("Metro", Direction A of the Oct 15 direction study, chosen by Jordan). Supersedes 0.4. Formal approval by Jordan and Lindsay still pending (Phase 0 gate, HANDOFF §14). |
| **Implements** | HANDOFF §9 (design brief), §8 (screens), §7 (`css/app.css`). |
| **Source of truth** | Tokens and component styles live in `css/app.css`. This file explains them. If the two disagree, fix whichever is wrong and rerun the contrast check. |
| **Preview** | `docs/style-preview.html` uses `css/app.css` directly. **It is git-ignored**: it uses real trip details so it feels like theirs, and the repo is public. Jordan reviews it through a private link. |
| **Contrast check** | `python3 tests/contrast_check.py`. Exits 1 on any failure. Rerun after any color change and paste its output into §3. |

**Changes in 0.5 (Oct 15, "Metro", Jordan):** Jordan found 0.4 generic (the ink-navy palette, Fraunces and the line icons). He chose Direction A of a three-way study based on Japanese rail signage. Neutral charcoal shell (§2); city colors from real rail lines, as HANDOFF §9 now says (§2); Avenir Next replaces Fraunces, which is removed from the app (§4); flat panels with hairlines, and glows cut to a faint top light (§5–6); circle station marks with the city's initial (§6); filled pictograms on line-color tiles (§7); the Now glow no longer breathes (§8). Contrast: 85 of 85 pass (§3).

Earlier direction (Oct 13): a dark shell, a serif for headings, and custom pictograms (not emoji). Phone review is through a private preview link.

---

## 1. Principles

1. **Color carries meaning.** Each line color has one job (§2). If a new element needs color, it borrows an existing meaning or stays neutral. Panels are flat. The only tints are a faint city top light behind the header and a corner light on tonight's hotel, and the contrast check tests every text color at their peaks (§3).
2. **The day is a metro line.** The itinerary is drawn as a thick line in the city's color with white stations, like a metro map. The day badge copies Tokyo Metro station marks: a white disc ringed in the line color, with a letter over a number (`K 03`). The letter is the city's initial, not a real line letter. This is the app's signature.
3. **Pictograms, not emoji.** A small custom set of solid pictograms in the manner of Japanese public signage (JIS Z8210, §7). On itinerary items they sit on a line-color tile. Icons sit next to words to speed up scanning. They never replace a label.
4. **Staff cards break the theme.** Anything a Japanese speaker reads across a counter is paper-white, near-black and huge.
5. **Quiet system states.** Sync, offline, update and staging use neutrals only, so they never compete with city, budget or allergy colors.
6. **Readable first.** Body text is 17 pt and grows with the iPhone's Text Size setting, but never shrinks below the §9 minimums. Primary actions sit low on the screen.

---

## 2. Color tokens

All values are in `:root` in `css/app.css`.

### Shell (charcoal, neutral)

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#111214` | App background; also the tab bar, which is opaque |
| `--surface-1` | `#1A1C1F` | Cards |
| `--surface-2` | `#24272B` | Sheets, banners, secondary buttons, chips, pictogram tiles |
| `--surface-3` | `#30343A` | Pressed state, meter track, done pictogram tile |
| `--line` / `--line-strong` | `#2B2E33` / `#3E434A` | Hairlines; button and banner borders |
| `--text` | `#F3F3F1` | Primary text; primary button fill |
| `--text-2` | `#B5B8BD` | Secondary text, the day line |
| `--text-3` | `#90949A` | Eyebrows, inactive tabs, empty checkbox ring |
| `--on-fill` | `#111214` | Text and pictograms on any color or light fill |
| `--mark` | `#F3F3F1` | The station-mark disc and the rail's stations |
| `--ring-neutral` | `#7A7E84` | The station ring when there's no city (before and after the trip); 3:1 on both the disc and the shell |

### Places (one rail-line color per city, HANDOFF §9)

| Token | Hex | Line | Used on |
|---|---|---|---|
| `--osaka` | `#E44D93` | Osaka Metro Sennichimae line | Station-mark ring, day line square, rail, pictogram tiles, section bar, tab marker, city name in Trip, top light |
| `--kyoto` | `#2C9B5E` | Kyoto Subway Karasuma line, deepened a touch so the ring clears 3:1 on the white disc | same |
| `--tokyo` | `#8F76D6` | Tokyo Metro Hanzomon line, picked for a purple that stays apart from the other colors | same |
| `--travel` | `#3D8EDC` | Shinkansen blue (approximate) | same, travel days only. Screens with no city use neutrals, so blue always means a travel day. |

Set `.city-osaka`, `.city-kyoto`, `.city-tokyo` or `.city-travel` on a container. Children read `var(--city)`.

### Depth (0.5)

| Token | Value | Role |
|---|---|---|
| `--glow-peak` | 14% | Peak share of the city color in the top light behind the header (the contrast check reads it from `css/app.css`) |

No shadows: panels are flat, separated by 1 px hairlines.

### Reserved meanings

| Token | Hex | Meaning (only this) |
|---|---|---|
| `--now` | `#F0CF76` | **Now / Next**: the NOW tag, NEXT outline, and the current station on the rail |
| `--ok` | `#74D3B8` | On track (budget); done (checklist tick) |
| `--close` | `#F2A469` | Getting close (budget); overdue (checklist); allergy **Caution**. Sharing one color here is a proposal; see §10. |
| `--over` | `#FF8F8F` | Over budget. The meter also gets a diagonal stripe, so the state doesn't depend on color. |
| `--allergy` | `#FF5A2E` | **Allergy danger only**: the High badge and the header band of the verified allergy card. Nothing else uses it. (Jordan's call, Oct 13: the card counts as danger however it was opened. Caution badges stay amber.) |

### Staff cards (light)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#FBF8F1` | Card background |
| `--paper-ink` | `#12151C` | Card text |
| `--paper-ink-2` | `#4A5163` | Labels, hints |
| `--paper-line` | `#E3DED2` | Divider |
| `--paper-allergy` | `#B3290C` | The allergen word |

---

## 3. Contrast results

Target: WCAG AA. 4.5:1 for text, 3:1 for large text and UI marks (pictograms, meter fills, rings). Generated by `tests/contrast_check.py` on Oct 15, 2026. **85 of 85 pass.** `mix:a:pct:b` rows are CSS `color-mix(in srgb, …)` results. Named surfaces such as `kyoto-top` or `osaka-hotel` are the brightest point of a tint (the script's `DERIVED` list): the 14% top light behind the header and the 9% corner light on tonight's hotel. The hotel light sits bottom-right, away from the `--text-3` "Tonight" eyebrow, so only `--text` and `--text-2` are checked on it.

| Foreground | Background | Ratio | Needs | Result | Used for |
|---|---|---|---|---|---|
| `text` #F3F3F1 | `bg` #111214 | 16.87 | 4.5 | pass | Body text on the shell |
| `text` #F3F3F1 | `surface-1` #1A1C1F | 15.37 | 4.5 | pass | Body text on cards |
| `text` #F3F3F1 | `surface-2` #24272B | 13.50 | 4.5 | pass | Banner and sheet text |
| `text` #F3F3F1 | `surface-3` #30343A | 11.26 | 4.5 | pass | Text on a pressed button |
| `text-2` #B5B8BD | `bg` #111214 | 9.42 | 4.5 | pass | Secondary text on the shell |
| `text-2` #B5B8BD | `surface-1` #1A1C1F | 8.58 | 4.5 | pass | Secondary text on cards |
| `text-2` #B5B8BD | `surface-2` #24272B | 7.54 | 4.5 | pass | Chips, banner detail |
| `text-3` #90949A | `bg` #111214 | 6.15 | 4.5 | pass | Eyebrows, inactive tabs |
| `text-3` #90949A | `surface-1` #1A1C1F | 5.60 | 4.5 | pass | Eyebrows on cards |
| `osaka` #E44D93 | `bg` #111214 | 5.16 | 4.5 | pass | Osaka city name and marks on the shell |
| `kyoto` #2C9B5E | `bg` #111214 | 5.32 | 4.5 | pass | Kyoto city name and marks on the shell |
| `tokyo` #8F76D6 | `bg` #111214 | 5.11 | 4.5 | pass | Tokyo city name and marks on the shell |
| `travel` #3D8EDC | `bg` #111214 | 5.45 | 4.5 | pass | Travel city name and marks on the shell |
| `osaka` #E44D93 | `surface-1` #1A1C1F | 4.70 | 4.5 | pass | Osaka label on a card |
| `kyoto` #2C9B5E | `surface-1` #1A1C1F | 4.84 | 4.5 | pass | Kyoto label on a card |
| `tokyo` #8F76D6 | `surface-1` #1A1C1F | 4.66 | 4.5 | pass | Tokyo label on a card |
| `travel` #3D8EDC | `surface-1` #1A1C1F | 4.96 | 4.5 | pass | Travel label on a card |
| `now` #F0CF76 | `surface-1` #1A1C1F | 11.30 | 4.5 | pass | NEXT tag text |
| `on-fill` #111214 | `now` #F0CF76 | 12.40 | 4.5 | pass | NOW tag text |
| `ok` #74D3B8 | `surface-1` #1A1C1F | 9.56 | 4.5 | pass | On track label |
| `close` #F2A469 | `surface-1` #1A1C1F | 8.37 | 4.5 | pass | Getting close, Overdue, Caution |
| `close` #F2A469 | `bg` #111214 | 9.18 | 4.5 | pass | Caution badge on the shell |
| `over` #FF8F8F | `surface-1` #1A1C1F | 7.79 | 4.5 | pass | Over budget label |
| `on-fill` #111214 | `allergy` #FF5A2E | 6.03 | 4.5 | pass | Allergy High badge and card band |
| `on-fill` #111214 | `text` #F3F3F1 | 16.87 | 4.5 | pass | Primary button label |
| `on-fill` #111214 | `text-2` #B5B8BD | 9.42 | 4.5 | pass | STAGING ribbon (light stripe) |
| `on-fill` #111214 | `text-3` #90949A | 6.15 | 4.5 | pass | STAGING ribbon (dark stripe) |
| `paper-ink` #12151C | `paper` #FBF8F1 | 17.22 | 4.5 | pass | Staff card text |
| `paper-ink-2` #4A5163 | `paper` #FBF8F1 | 7.48 | 4.5 | pass | Staff card secondary text |
| `paper-allergy` #B3290C | `paper` #FBF8F1 | 6.11 | 4.5 | pass | Allergen word on the allergy card |
| `allergy` #FF5A2E | `bg` #111214 | 6.03 | 3.0 | pass | Allergy High badge shape on the shell |
| `allergy` #FF5A2E | `surface-1` #1A1C1F | 5.49 | 3.0 | pass | Allergy High badge shape on a card |
| `ok` #74D3B8 | `surface-3` #30343A | 7.00 | 3.0 | pass | Meter fill on its track |
| `close` #F2A469 | `surface-3` #30343A | 6.13 | 3.0 | pass | Meter fill on its track |
| `over` #FF8F8F | `surface-3` #30343A | 5.71 | 3.0 | pass | Meter fill on its track |
| `text-3` #90949A | `surface-1` #1A1C1F | 5.60 | 3.0 | pass | Empty checkbox ring |
| `on-fill` #111214 | `ok` #74D3B8 | 10.49 | 3.0 | pass | Checkmark on a done item |
| `text-2` #B5B8BD | `surface-3` #30343A | 6.29 | 4.5 | pass | Quiet button label while pressed |
| `on-fill` #111214 | `text-2` #B5B8BD | 9.42 | 4.5 | pass | Primary button label while pressed |
| `now` #F0CF76 | `bg` #111214 | 12.40 | 3.0 | pass | Current station on the rail |
| `ok` #74D3B8 | `bg` #111214 | 10.49 | 3.0 | pass | Done station / tick on the shell |
| `mix:over:70:surface-3` #C17476 | `surface-3` #30343A | 3.59 | 3.0 | pass | Over-budget meter, dark stripe |
| `osaka` #E44D93 | `surface-2` #24272B | 4.13 | 3.0 | pass | Osaka pictogram in its tile |
| `kyoto` #2C9B5E | `surface-2` #24272B | 4.25 | 3.0 | pass | Kyoto pictogram in its tile |
| `tokyo` #8F76D6 | `surface-2` #24272B | 4.09 | 3.0 | pass | Tokyo pictogram in its tile |
| `travel` #3D8EDC | `surface-2` #24272B | 4.36 | 3.0 | pass | Travel pictogram in its tile |
| `text` #F3F3F1 | `surface-2` #24272B | 13.50 | 3.0 | pass | Neutral pictogram in its tile |
| `text` #F3F3F1 | `osaka-top` #2F1A26 | 14.58 | 4.5 | pass | Greeting / title under the osaka top light |
| `text-2` #B5B8BD | `osaka-top` #2F1A26 | 8.14 | 4.5 | pass | Day line and back link under the osaka top light |
| `text-3` #90949A | `osaka-top` #2F1A26 | 5.31 | 4.5 | pass | Eyebrows under the osaka top light |
| `text` #F3F3F1 | `osaka-hotel` #2C2029 | 14.05 | 4.5 | pass | Hotel name on the osaka hotel light |
| `text-2` #B5B8BD | `osaka-hotel` #2C2029 | 7.84 | 4.5 | pass | Hotel details on the osaka hotel light |
| `on-fill` #111214 | `osaka` #E44D93 | 5.16 | 3.0 | pass | Pictogram on the osaka tile |
| `osaka` #E44D93 | `mark` #F3F3F1 | 3.27 | 3.0 | pass | osaka ring on the white station disc |
| `text` #F3F3F1 | `kyoto-top` #15251E | 14.37 | 4.5 | pass | Greeting / title under the kyoto top light |
| `text-2` #B5B8BD | `kyoto-top` #15251E | 8.03 | 4.5 | pass | Day line and back link under the kyoto top light |
| `text-3` #90949A | `kyoto-top` #15251E | 5.24 | 4.5 | pass | Eyebrows under the kyoto top light |
| `text` #F3F3F1 | `kyoto-hotel` #1C2725 | 13.83 | 4.5 | pass | Hotel name on the kyoto hotel light |
| `text-2` #B5B8BD | `kyoto-hotel` #1C2725 | 7.73 | 4.5 | pass | Hotel details on the kyoto hotel light |
| `on-fill` #111214 | `kyoto` #2C9B5E | 5.32 | 3.0 | pass | Pictogram on the kyoto tile |
| `kyoto` #2C9B5E | `mark` #F3F3F1 | 3.17 | 3.0 | pass | kyoto ring on the white station disc |
| `text` #F3F3F1 | `tokyo-top` #23202F | 14.33 | 4.5 | pass | Greeting / title under the tokyo top light |
| `text-2` #B5B8BD | `tokyo-top` #23202F | 8.00 | 4.5 | pass | Day line and back link under the tokyo top light |
| `text-3` #90949A | `tokyo-top` #23202F | 5.22 | 4.5 | pass | Eyebrows under the tokyo top light |
| `text` #F3F3F1 | `tokyo-hotel` #25242F | 13.78 | 4.5 | pass | Hotel name on the tokyo hotel light |
| `text-2` #B5B8BD | `tokyo-hotel` #25242F | 7.69 | 4.5 | pass | Hotel details on the tokyo hotel light |
| `on-fill` #111214 | `tokyo` #8F76D6 | 5.11 | 3.0 | pass | Pictogram on the tokyo tile |
| `tokyo` #8F76D6 | `mark` #F3F3F1 | 3.30 | 3.0 | pass | tokyo ring on the white station disc |
| `text` #F3F3F1 | `travel-top` #172330 | 14.32 | 4.5 | pass | Greeting / title under the travel top light |
| `text-2` #B5B8BD | `travel-top` #172330 | 8.00 | 4.5 | pass | Day line and back link under the travel top light |
| `text-3` #90949A | `travel-top` #172330 | 5.22 | 4.5 | pass | Eyebrows under the travel top light |
| `text` #F3F3F1 | `travel-hotel` #1D2630 | 13.77 | 4.5 | pass | Hotel name on the travel hotel light |
| `text-2` #B5B8BD | `travel-hotel` #1D2630 | 7.69 | 4.5 | pass | Hotel details on the travel hotel light |
| `on-fill` #111214 | `travel` #3D8EDC | 5.45 | 3.0 | pass | Pictogram on the travel tile |
| `travel` #3D8EDC | `mark` #F3F3F1 | 3.10 | 3.0 | pass | travel ring on the white station disc |
| `text` #F3F3F1 | `neutral-top` #1C1D1F | 15.18 | 4.5 | pass | Title under the neutral top light |
| `text-2` #B5B8BD | `neutral-top` #1C1D1F | 8.48 | 4.5 | pass | Secondary text under the neutral top light |
| `on-fill` #111214 | `mark` #F3F3F1 | 16.87 | 4.5 | pass | Letter and day number on the station disc |
| `text-3` #90949A | `neutral-top` #1C1D1F | 5.53 | 4.5 | pass | Eyebrows under the neutral top light |
| `text` #F3F3F1 | `mix:text:9:surface-1` #2E2F32 | 12.05 | 4.5 | pass | Hotel name on the neutral hotel light |
| `text-2` #B5B8BD | `mix:text:9:surface-1` #2E2F32 | 6.73 | 4.5 | pass | Hotel details on the neutral hotel light |
| `ring-neutral` #7A7E84 | `bg` #111214 | 4.59 | 3.0 | pass | Neutral station ring (no city) on the shell |
| `ring-neutral` #7A7E84 | `mark` #F3F3F1 | 3.67 | 3.0 | pass | Neutral station ring on the white disc |
| `text-2` #B5B8BD | `surface-3` #30343A | 6.29 | 3.0 | pass | Pictogram on a done (neutral) tile |
| `text-3` #90949A | `surface-1` #1A1C1F | 5.60 | 3.0 | pass | Today's day-row outline |

Closest meaning-color pairs (CIE76 ΔE, minimum 20):

- `now` vs `close`: 25.3 
- `tokyo` vs `travel`: 29.9 
- `close` vs `over`: 30.3 
- `kyoto` vs `ok`: 30.3 
- `osaka` vs `over`: 36.7

The closest pairs (Now vs close, Tokyo vs travel) never appear in the same component, and both always come with a text label.

---

## 4. Type

| Role | Token | Size (default) | Floor | Face |
|---|---|---|---|---|
| Display (countdown) | `--fs-display` | 2.75rem · 47 | — | Avenir Next 600 (3.6rem in the countdown) |
| Title 1 (screen title) | `--fs-title-1` | 2rem · 34 | — | Avenir Next 600 |
| Title 2 (greeting; section titles are 1.15rem · 19.5) | `--fs-title-2` | 1.5rem · 25.5 | — | Avenir Next 600 |
| Title 3 (Now/Next item, hotel and idea names) | `--fs-title-3` | 1.25rem · 21 | — | Avenir Next 600 |
| Body | `--fs-body` | 1rem · 17 | 17 | Avenir Next |
| Secondary | `--fs-secondary` | 0.9rem · 15.3 | 15 | Avenir Next |
| Caption (nothing smaller, including the station-mark letter) | `--fs-caption` | 0.8rem · 13.6 | 13 | Avenir Next |
| Staff-card Japanese, hotel address | `--fs-card-ja` | 2rem · 34 | 32 | Hiragino Sans 700 (address 600) |
| Allergen word | `--fs-card-allergen` | 2.6rem · 44 | 40 | Hiragino Sans 800 |
| Booking reference | `--fs-card-ref` | 2.6rem · 44 | 40 | Avenir Next 800, tabular |

- **Sizes scale up but never below their floor.** On iOS, `html { font: -apple-system-body }` (gated to iOS only) ties `1rem` to the Text Size setting. Each floored token is `max(rem, px)`, so a larger Text Size grows the text and a smaller one leaves the §9 minimums in place. This settles the conflict in §9 between "respect Text Size" and "nothing under 13 pt".
- **Avenir Next** is used for all Latin text (HANDOFF §9). It's built into iOS, so nothing downloads and it works offline. It's a close cousin of the Frutiger that Tokyo Metro signs use. Fallback: the system font. Fraunces (0.4) is removed from the app; its file is archived in `private/design/fonts-archive/`.
- **Japanese** uses the system Hiragino Sans (`:lang(ja)` or `.ja`). No Japanese web font ships.
- **Numbers** (money, times, distances, booking refs) use `font-variant-numeric: tabular-nums` (`.num`).
- Uppercase labels (`.eyebrow`) get 0.08em letter-spacing. Headings use `text-wrap: balance`.

---

## 5. Space, shape, touch

- Spacing scale (4-based): `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48.
- Radii by role, tighter than 0.4 to read as signage: `--r-chip` 3 (tags, chips, sync) · 4 (inline pictogram tiles) · `--r-card` 8 (cards, banners, rows, inputs, quick-search and idea tiles) · 10 (buttons) · `--r-sheet` 24 (staff cards, sheets) · 50% (station marks).
- Every tappable element is at least **44 × 44 pt** (`--tap`). Two smaller-looking controls get a larger hit area: the allergy badge looks 28 pt tall but taps as 44 pt (`::before` hit area), and the checklist **row** toggles while the 44 pt ring button carries the accessible state (`aria-pressed`). Category chips are labels today. If they become filter buttons in Nearby, they need 44 pt height.
- Side gutter 16 px. Layout works from 375 pt wide with no horizontal scroll (rechecked Oct 16 on ten screens at 375 × 812: `scrollWidth` = 375).
- Safe areas: the tab bar pads by `env(safe-area-inset-bottom)`. The app shell pads the top by `env(safe-area-inset-top)`. The tab bar is opaque `--bg`, so content scrolling under it never changes label contrast.
- Primary actions use the light button (`--text` fill, `--on-fill` text), so color stays reserved for meaning. Secondary actions use a charcoal button. Quiet actions (Skip) use text only.

---

## 6. Components

All ten components from HANDOFF §9 are in the preview, plus the remaining staff cards. Class names are what Phase 1 builds against.

| # | Component | Class | Notes and states |
|---|---|---|---|
| 1 | **Tab bar** | `.tabbar` `.tab` | Today · Trip · Lists · Budget · Nearby. Opaque. The active tab has `aria-current="page"`, `--text` label and a 3 px line-color bar at its top edge (neutral when the screen has no city). |
| 2 | **Now / Next card** | `.now-next` `.nn-row(.next)` `.nn-tag` `.nn-title` | A flat sign panel with a 3 px gold band along the top. NOW is a solid gold tag; NEXT is a gold outline (tags share a width so titles align). Titles in Avenir Next 600, led by a pictogram on a city-color tile. Directions (primary) and Mark done (secondary). |
| 3 | **Itinerary item** | `.line` > `.stop` | A metro map: a 6 px line in the city color and 16 px white stations ringed in it. Columns: time or slot (nowrap, `--text` 600), line, body. The title is led by a pictogram on a city-color tile. Station states: default white; `.is-done` filled in the city color, with a neutral tile; `.is-now` gold with a white ring and gold halo. A single stop hides the line. Travel items put both local times with zones in the meta line. |
| — | Station mark (day badge) | `.day-badge` (`role="img"` + `aria-label`) | A 3.3 rem white disc with a 4 px ring in the line color: the city's initial (O, K, T) over the two-digit day number. Travel days show ✈ in a blue ring. Before and after the trip the ring is neutral `--text-3`. |
| — | Allergy badge | `.allergy-badge.high` / `.caution` | High: solid vermilion. Caution: amber outline. Both are buttons with a 44 pt hit area that open the allergy card (HANDOFF §8.1). |
| 4 | **Hotel card (in-app)** | `.hotel` | A faint city light in the bottom-right corner (9%), away from the eyebrow. "Tonight" eyebrow, EN name in Avenir Next 600, JA name, check-in, check-out and breakfast. **Show in Japanese** opens the staff hotel card. **Route home** is added after 6 PM JST only. |
| 5 | **Budget meter** | `.budget[data-state=ok/close/over]` | Big "left today" number (Avenir Next, tabular), ≈ USD, meter (`--fill`), spent vs allowance, trip left. Over gets a stripe; negative amounts use a true minus sign (−). |
| 6 | **Checklist row** | `.checks` > `.check(.is-done)` | Whole row toggles; the ring is a 44 pt button with `aria-pressed`. Done: mint fill and tick, label struck through. Meta: owner · due. Overdue in amber. Grouped under `.bag-head` (bag pictogram + name + count). Bag names follow HANDOFF §5. |
| 7 | **Idea card** | `.idea` | Category pictogram tile, name EN and JA, distance (walk minutes at 80 m/min, then meters), category chip, why, hours/notes, allergy note with badge (food places), and Directions, Add to a day, Done, Skip (HANDOFF §8.5). |
| — | Quick searches | `.quick` > `.quick-btn(.caution)` | Pictogram tiles opening Google Maps searches: Ramen, Sushi, Café, Convenience store, ATM, Pharmacy, Coin lockers, Restroom (§8.5 wording). 4 across at default Text Size, 3 across at larger sizes; labels wrap inside the tile. **Sushi** has an amber (Caution) edge and shows an allergy-card reminder before opening Maps. |
| 8 | **Allergy card (staff)** | `.staff-card` | **Two states.** *Not set up* (`.is-unset`): dashed border, no band, no Japanese sentence. It says the card appears once the verified text is in the sheet, points to the printed card and the photo in Favorites, and still shows the allergen words from HANDOFF §8.6. *Verified*: vermilion band, the professional text at 34 pt, allergen words at 44 pt. Requests a screen wake lock; otherwise says to turn brightness up. Unverified text never renders (AC-C2). The band's Japanese heading also comes from the professional card, so it reads in English until then. |
| — | Hotel / taxi card (staff) | `.staff-card` with `.ja-xl` + `.ja-addr` | "Please take me to this hotel" in Japanese, name and **address at 34 pt (floor 32, AC-T3)**, and phone. The same layout serves the taxi card for any place. |
| — | Booking-ref card (staff) | `.staff-card` with `.ref` | The confirmation number at 44 pt, tabular, **grouped in fours** by the app so long hotel numbers break between groups and are easy to read aloud. Shows what it's for and the dates (§8.1 "Show booking ref"). |
| 9 | **Sync status** | `.sync[data-state]` | `synced` filled dot · `waiting` ring · `offline` dashed ring · `problem` "!" (13 pt) with brighter text. All neutral. |
| 10 | **Banner** | `.banner` + `.staging-ribbon` | Neutral raised surface, bold title, one action. Used for Sheet problem and Update available (never auto-applied). Staging shows a striped STAGING ribbon. |

---

**Across components (0.5):**
- **Top light:** a faint 14% light in today's city color from the top right, or 5% `--text` on screens without a city.
- **Cards** (hotel, legs, ideas, budget, settings groups, info rows, lists, day rows, quick searches, banners) are flat `--surface-1` with a 1 px `--line` hairline and no shadow.
- **Day line:** `--text-2`, led by a 10 px square in the line color.
- **Section titles:** a 4 px vertical bar in the line color at the left of the heading.
- **Trip day rows:** the station mark carries the color; the city name is in the line color with its Japanese name (大阪 / 京都 / 東京) beside it. Today's row adds a neutral outline.
- **Sync pill:** a hairline chip, neutral (principle 5).
- **Staff cards:** unchanged (paper-white, principle 4).

## 7. Pictograms

Drawn for Brillo: 24 × 24 inline SVG `<symbol>`s as solid silhouettes in the JIS Z8210 manner (`fill: currentColor`, with knocked-out details). A few use bold strokes for thin parts: the budget tab icon, the sun's rays, and the handles, steam and legs on the café, bag, train and backpack. In the app the sprite lives in `index.html`, so icons work offline with no extra requests. They are decorative (`aria-hidden`) because a text label always sits beside them.

**Color rule:** on itinerary stops, Now/Next titles and travel legs, the pictogram is drawn in `--on-fill` on a 1.5 rem tile in the city color (3:1 checked); a done stop's tile turns neutral. `.pict-tile` is always neutral (`--text`), even inside a `.city-*` screen, so an idea tile on Today stays neutral. Pictograms never use a reserved meaning color, except the Sushi quick search's amber edge, which is the Caution meaning.

| Symbol | Means | Driven by (sheet field, HANDOFF §5) |
|---|---|---|
| `p-food` | Food, ramen | Ideas Category = Food · Expenses Category = Food · quick search Ramen |
| `p-sushi` | Sushi | quick search Sushi |
| `p-cafe` | Café | Ideas = Café · quick search |
| `p-lantern` | Bar / izakaya | Ideas = Bar |
| `p-store` | Market, konbini | Ideas = Market · quick search Konbini |
| `p-bag` | Shopping | Ideas = Shopping · Expenses = Shopping |
| `p-temple` | Temple | Itinerary Kind = Temple |
| `p-shrine` | Shrine (torii) | Itinerary Kind = Shrine |
| `p-camera` | Sight | Ideas = Sight |
| `p-tree` | Nature (tree) | Itinerary Kind = Nature |
| `p-ticket` | Tickets, activities, parks | Expenses = Activities, Tickets |
| `p-train` | Train, bus, transit | Transportation Type = Train or Bus (one icon for both in v1) · Expenses = Transit · Kind = Transit |
| `p-plane` | Flight | Transportation Type = Flight |
| `p-bed` | Hotel, check-in/out | Hotels tab · Expenses = Lodging |
| `p-yen` | Cash, ATM, tax refund | Expenses = ATM withdrawal, Tax refund · quick search ATM |
| `p-pill` | Pharmacy | quick search |
| `p-locker` | Coin lockers | quick search |
| `p-restroom` | Restroom | quick search |
| `p-suitcase` / `p-backpack` | Bags | Checklists Bag |
| `p-other` | Other / default | any blank or "Other" |

**Itinerary items** use the optional `Kind` column (HANDOFF §5, added Oct 13). If it's blank, they show `p-other`, except check-in, check-out and Transportation rows, whose icon is known. Mapping in §10, item 5.

---

## 8. Motion

Still minimal. Everything here is off under `prefers-reduced-motion`.
- The cards sheet slides up (≤ 200 ms), and buttons have press states.
- **Screen entrance (0.4, kept):** the header and content rise 6 px and fade in over 320 ms when the route changes. It's keyed to a `data-enter` attribute that `app.js` sets on a route change only, so the once-a-minute Today refresh and sync re-renders don't replay it.
- No element animates continuously; the 0.4 breathing Now glow is gone.

---

## 9. Home-screen icon

An ink-navy square with the trip drawn as a three-station line: Osaka pink → Kyoto matcha → Tokyo lavender, rising left to right. **Open (0.5):** redraw it on charcoal in the rail-line colors so it matches the app. There's no text in the icon; the home-screen label is "Brillo". It needs 180 (apple-touch-icon), 192, 512 and maskable PNGs (HANDOFF §7). These get exported from the SVG in Phase 1 after approval.

---

## 10. Open questions for the Phase 0 gate

1. **Budget thresholds (not in the spec):** proposed *on track* while at least 25% of today's allowance is left, *getting close* from 25% down to 0, and *over* below 0.
2. ~~**Fraunces font files**~~ Approved Oct 15, then **removed in 0.5** (Avenir Next, §4).
3. ~~**City colors**~~ **Decided Oct 15 (Jordan):** rail-line colors (§2, HANDOFF §9).
4. ~~**Day badge codes**~~ **Decided Oct 15 (Jordan):** the city's initial (O / K / T) in a Metro station mark (§6).
5. ~~Itinerary "Kind" column~~ **Approved Oct 13** and added to HANDOFF §5. Mapping: Food → `p-food`, Temple → `p-temple`, Shrine → `p-shrine`, Sight → `p-camera`, Nature → `p-tree`, Shopping → `p-bag`, Activity → `p-ticket`, Transit → `p-train`, Hotel → `p-bed`, Other or blank → `p-other`.
6. **Shared amber:** budget "getting close", checklist "overdue" and allergy Caution all use `--close` as a single "needs attention" color. Keep it shared, or split it?
7. ~~Not-set-up allergy card~~ **Decided Oct 13 (Jordan):** it keeps showing the allergen words HANDOFF §8.6 lists at 44 pt. Only the full sentence waits for the verified professional text.
