# [Name] Design System

Version 1.0 · [date]

[One sentence: what this interface is.] This file is the design authority for it. Claude reads it before any design work. Explicit instructions from [owner] win over this file.

## 1. Identity

[Three or four words for the feel.]

- **[Rule]:** [what leads, e.g. "Typography leads. Large headlines carry the message."]
- **[Rule]:** [the accent, e.g. "One signal color. It marks what is live or selected."]
- **[Rule]:** [the data, e.g. "Every number is real or labeled sample."]
- **The five-second test:** a first-time viewer should understand any screen in five seconds.

## 2. Color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ground` | | | Page canvas |
| `--ink` | | | Headings and body. Never pure black |
| `--ink-2` | | | Secondary copy |
| `--muted` | | | Metadata, labels |
| `--line` | | | Dividers |
| `--accent` | | | The one signal color |
| `--accent-ink` | | | Accent text, at least 4.5:1 on the ground |

Rules:
- [Where the accent is allowed, and where it is not.]
- [What red, green and amber mean, if anything.]

## 3. Typography

- **[Family]** for everything. [Weights and what each is for.]
- **[Mono family]** for numbers, timestamps and labels.

| Role | Size / leading | Weight / tracking |
| --- | --- | --- |
| Page title | | |
| Section head | | |
| Lede | | |
| Body | | |
| Stat number | | |
| Label | | |

[Case rules, e.g. sentence case everywhere.]

## 4. Layout

- **Shell:** [top bar, rail, content]
- **Page frame:** [max width, side padding, shared left edge]
- **Spacing:** [rhythm, gaps between related items and between groups]
- **Grids:** [when two, three or four columns]
- **Phone width:** [single column, gutters, no horizontal scroll]

## 5. Surfaces

[Card, panel and glass rules. When something is a card and when it is a row.]

| Element | Radius |
| --- | --- |
| Panels | |
| Cards | |
| Controls | |

## 6. Components

- **[Component]:** [what it looks like and when to use it]

## 7. Motion

- [Entrance, duration, easing. What never animates. Reduced-motion behavior.]

## 8. Content

- [Naming, tone, banned words, what must never be shown.]

## 9. Logo

- [Which file, minimum size, clear space, what never to do to it.]

## 10. Checklist before shipping a screen

1. Does it read in five seconds for someone who has never seen it?
2. Is the accent the only accent?
3. Does every page start on the same left edge, and fit at 400px?
4. Is every number real, or labeled sample?
5. Does it work with reduced motion and in dark mode?
6. Is nothing private visible?
