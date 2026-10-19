# AIOS Design System

Version 1.0 · Agent-ready reference

AIOS is a local, read-only window into an AI operating system: every project, agent, connection and routine in one place. This file is the design authority for its interface and anything made from it (screens, slides, exports). Claude reads it before any design work. Explicit instructions from the owner win over this file.

Make it yours: keep the structure, change the tokens. Section 12 shows how to swap the accent, the typeface or the whole palette without breaking the rules.

## 1. Identity

Calm, specific, alive. The page should feel like an operating system that is quietly running, never like a marketing site.

- **Typography leads.** Large upright DM Sans headlines carry the message; everything else steps back.
- **One signal color.** Cyan marks what is live, selected or important. Nothing else competes with it.
- **Real data first.** Every number on screen comes from disk, logs or a connected tool. Anything sample or simulated says so in the UI.
- **Read-only by design.** The interface never implies it can change a file, task or message. The only things AIOS writes are its own `data/overrides.json` and `wiki/`.
- **A first-time viewer should understand any screen in five seconds.** If they would not, cut, do not explain.

## 2. Color tokens

Light is the default. Dark is supported through the same tokens (see `public/app.css`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ground` | `#F3F5F8` | `#08111F` | Page canvas (cool soft white) |
| `--ink` | `#0B1A30` | `#EAF1FA` | Headings, body, primary controls. Never pure black |
| `--ink-2` | `#4A5871` | `#AAB8CC` | Secondary copy, ledes |
| `--muted` | `#8391A6` | `#71819A` | Metadata, labels, timestamps |
| `--line` | `rgba(11,26,48,.08)` | `rgba(234,241,250,.08)` | Dividers, row rules |
| `--blue` | `#37BDF8` | `#37BDF8` | The signal: fills, bars, edges, selection, live state |
| `--blue-ink` | `#0A72B5` | `#5CCBFA` | Blue text, links, primary buttons (AA on white) |
| `--blue-wash` | `rgba(55,189,248,.12)` | same | Tinted chips and soft highlights |
| `--live` | `#FF3B30` | `#FF3B30` | The live dot in the top bar, and missed runs |

Rules:
- Never put small text in `--blue` on white; use `--blue-ink`.
- Red is the live dot and a missed routine. Errors and "past due" use a muted red (`#DC2626`) in text only, always with a word, never color alone.
- **Space colors** (each project's swatch) identify a space in the rail, Brain and lists. They never become UI accents, buttons or backgrounds.
- **Connector colors** in agent views (Gmail red, Drive green, ClickUp purple and so on) appear only as small dots and chips.
- Semantic green (`#22C55E`) means "used this week / healthy" and nothing else.

## 3. Typography

- **DM Sans** for everything. 500 for headings and names, 400 for body, 600 sparingly for controls and table headings.
- **DM Mono** for indices, timestamps, counts, paths and eyebrows.
- Both load from Google Fonts in `public/index.html`.

| Role | Size / leading | Weight / tracking |
| --- | --- | --- |
| Page title (h1) | clamp(40px, 4.4vw, 60px) / 1.04 | 500 / -0.035em |
| Group title | 26px / 1.2 | 500 / -0.025em |
| Lede | 19px / 1.5, max 64ch | 400 |
| Section head (h2) | 14px | 600 / -0.005em |
| Body / rows | 13.5–14px / 1.5 | 400 |
| Stat number | 30px (page) to 96px (slides) | 500 / -0.03em, tabular-nums |
| Eyebrow / meta | 11–12.5px DM Mono | 400–500 |

Sentence case everywhere. Headlines may end in a period. Use `text-wrap: balance` on headings and `tabular-nums` wherever digits line up.

## 4. Layout

- **Shell:** top bar, then a 252px rail and one content column. No side panels; content gets the full width.
- **Page frame:** every page shares one frame: max-width 1240px, centered, 40px side padding. All pages start at the same left edge. This is checked, not assumed.
- **Rail:** names only. No counts, no indexes. Grouped by the Four Cs (Context, Connections, Capabilities, Cadence), then Spaces by group. A 6px blue dot marks a space updated today.
- **Spacing:** 4/8px rhythm. Related items 12–24px apart, groups 44px apart.
- **Grids:** two columns for paired content, three or four for cards. Let content set heights; never stretch a card over empty space.
- **Secondary detail is folded away.** Files, sources and raw lists live in a collapsed "Files and sources" section at the bottom of a page.
- **Phone width (~400px):** single column, 16px gutters, no horizontal scroll.

## 5. Surfaces

**Glass** is for chrome and a few content sheets, never nested:
`background: rgba(255,255,255,.58)` · `backdrop-filter: blur(28px) saturate(170%)` · 1px white rim · inset top highlight · one broad soft navy shadow.

| Element | Radius |
| --- | --- |
| Panels, sections, glass sheets | 22px |
| Cards, rows that act as buttons | 12–16px |
| Controls, inputs, chips | 8–12px |
| Pills (status badges) | fully rounded |

- A card is used only when an item is a separate object (a space, a tool, an agent). Lists of facts are hairline rows, not cards.
- Shadows stay soft and single. No colored glows anywhere.
- The ground carries a faint cyan dot field (28px pitch, about 6% opacity) and two very pale blue light fields. They sit behind content and never move fast enough to notice.

## 6. Components

- **Top bar:** brand at left, breadcrumbs, then live status pill ("Live · 1,204 files" with the red dot), search (⌘K), Edit, Appearance, clock.
- **Layer cards (Home):** four cards for the Four Cs with a number chip, name, one-line meaning and one real stat in blue ink.
- **Space list:** two-column rows with swatch, name, tagline and a mono status; status turns blue ink when active.
- **Score rings (Four Cs):** one large ring for the total out of 100, four small rings out of 25, each in its own C color.
- **Rows:** time or index, title, meta, right-aligned value. 1px `--line` between rows.
- **Status pills:** mono, small, tinted background. `in progress` blue, `on hold` amber, late in red text with the number of days.
- **Diagrams (Brain, agent network):** SVG with thin edges in `--line-2` or the node's own color at low opacity. Small pulses travel along edges to show work moving. Hover or click focuses one node and dims everything else to 30%.
- **Routine timeline:** one lane per routine across 24 hours, a square tick per run, a cyan now-line with the time.

## 7. Motion

- **Headline reveal:** words rise 0.3em out of a 6px blur over 0.7s, 40ms apart, `cubic-bezier(.23,1,.32,1)`. Eyebrow at 0s, title at 0.12s, details at 0.48s.
- **Page entry:** sections rise 12–20px and fade in, staggered by 60ms, capped at 600ms.
- **Live motion is earned.** Pulses on edges, ticking counters and countdowns appear only where something is actually running.
- State changes 160–220ms. No bounce, no perpetual logo animation, no pulsing red dot.
- Everything respects `prefers-reduced-motion: reduce`: no movement, content fully visible.

## 8. Content

- Name things by what people recognize: "Connections", not "integrations config".
- Every number states its source in the UI (session logs, config, log files, the scan).
- No em dashes, no emoji, no hype words. Short, plain sentences.
- Never show private links, passwords, invoices, `.env` contents or personal photos. The server's deny list blocks them; the design never works around it.

## 9. Brand mark

The default mark is a small rounded ink square with a cyan square inside it (`.mark` in `public/app.css`), next to the title from `aios.config.json`. Swap it for your own logo file:

- Place the logo file in `public/`, never retype a wordmark in CSS.
- Keep it at 22–28px tall in the top bar, with clear space of half its height on every side.
- No glow, shadow, outline, gradient, stretching or recoloring.

## 10. Slides and exports

Presentations made from AIOS use a 1920×1080 grammar:
- Header: your mark (40px tall), a hairline divider, the talk title; the session label tracked uppercase at right.
- Eyebrow in link blue (`#197EA6`), tracked 0.14em uppercase.
- Two-line headline, about 104–124px, line one in ink and line two in link blue.
- One supporting element per slide: a glass card row, hairline rows, or one screenshot that may bleed off the right edge.
- Footer: a 2px hairline with a cyan progress segment and the event name at left.
- Brand, header and footer never move between slides.

## 11. Checklist before shipping a screen

1. Does it read in five seconds for someone who has never seen AIOS?
2. Is cyan the only accent, and red only the live dot or a missed run?
3. Does the page start on the shared left edge and fit at 400px?
4. Is every number real, or labeled sample?
5. Are secondary details folded away instead of listed?
6. Does it work with reduced motion and in dark mode?
7. Is nothing private visible?

## 12. Making it yours

Change tokens, not rules. Everything below lives in the `:root` block at the top of `public/app.css`.

- **Accent:** set `--blue` (the signal fill), `--blue-ink` (text-safe version, at least 4.5:1 on `--ground`) and `--blue-wash` (the signal at 12% opacity). Update the dot field color in `.ground::before` to match. The Appearance panel also offers six preset accents.
- **Ink and ground:** keep the ink tinted toward your accent's hue instead of pure black, and the ground a few points off white.
- **Typeface:** change the Google Fonts link in `public/index.html` and the `--sans`, `--display` and `--mono` variables. Keep one family for everything and one mono.
- **Then update this file:** the token table, the typography table and the checklist. Claude designs from DESIGN.md, so a token that only lives in CSS will drift.

## Files

- `public/app.css`: tokens, shell, rail, glass, shared components.
- `public/ext/*.css`: per-view styles (Four Cs, routines).
- `PRODUCT.md`: who AIOS is for and what it must do.
- `design/`: how this system was made, the prompts, and a blank template for your own.
