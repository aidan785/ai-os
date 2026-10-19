# How the design was made

Claude starts generic. Left alone, it builds dense, flat dashboards in a dozen colors. The AIOS look came from writing down what good looks like and handing it to Claude as files, then tightening those files every time a screen came out wrong.

This folder has everything you need to do the same for your own AIOS (or any interface you build with Claude).

| File | What it is |
| --- | --- |
| [`PROMPTS.md`](PROMPTS.md) | The prompts, in order, ready to paste |
| [`templates/PRODUCT.template.md`](templates/PRODUCT.template.md) | A blank product brief |
| [`templates/DESIGN.template.md`](templates/DESIGN.template.md) | A blank design system with every section Claude needs |
| [`../DESIGN.md`](../DESIGN.md) | The finished AIOS design system, as a worked example |
| [`../PRODUCT.md`](../PRODUCT.md) | The finished AIOS product brief |

## Taste lives in a file

Five inputs shaped the AIOS design. You need the first four; the fifth helps.

1. **Brand guidelines.** Your logo files, palette and clear-space rules. A PDF is fine; Claude reads it.
2. **A reference you love.** One existing page, deck or render that already has the feel you want. Point Claude at the file or repo.
3. **`PRODUCT.md`.** Who it is for, what it must do, and what it must never look like. Short, specific, and written by you.
4. **`DESIGN.md`.** The rules: tokens, type scale, layout frame, surfaces, components, motion, content rules and a checklist. Claude writes the first draft; you own it after that.
5. **A taste skill.** [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus is a Claude Code skill that knows the tells that make an interface look AI-made (default fonts, gradient text, nested cards, side stripes) and has commands like `critique`, `polish` and `distill`. Install it from its README. It reads `PRODUCT.md` and `DESIGN.md` from the project root, which is why they live there in this repo.

## The loop

1. **Ugly and true.** Get the data right first. Every number real, every link working, no styling. Design on top of fake data and you redesign twice.
2. **Show a reference.** Point Claude at your brand files and the one reference you love, and have it write `DESIGN.md` (prompt 2 in `PROMPTS.md`).
3. **Name the problem.** Look at each screen as a first-time viewer would. Say exactly what is wrong: "this looks like AI slop", "too many colors", "I can't tell what matters". Cut the chips, rainbow icons and fake terminals.
4. **Make it a rule.** Every fix becomes a line in `DESIGN.md`, so the next screen starts right instead of making the same mistake. This step is the one that compounds.

Repeat 3 and 4 until a new screen comes out right on the first try. Many of the rules in sections 4, 5 and 8 of `DESIGN.md` started as a complaint about one screen.

## Rules, not vibes

A rule Claude can check beats an adjective it has to interpret.

| Vibe | Rule |
| --- | --- |
| "Clean" | Every page shares one 1240px frame and one left edge. |
| "Not too colorful" | Cyan is the only accent. Space colors never become buttons or backgrounds. |
| "Premium" | DM Sans 500 for headings, 400 for body. Sentence case. No wide uppercase tracking. |
| "Easy to understand" | Would a first-time viewer get this screen in five seconds? If not, cut. |
| "Subtle animation" | Words rise 0.3em out of a 6px blur, 40ms apart. State changes 160–220ms. No bounce. |

## Before and after

On day one, Claude's default AIOS was dense, flat and used twelve colors. The finished version showed the same data. The difference is entirely `DESIGN.md`: one frame, one accent, one typeface, and secondary detail folded away.

## Three numbers to start with

If you only write three rules, write these:

- **1 accent color.** Pick it, give it a text-safe darker version, and ban every other accent.
- **1 typeface.** One family for everything, one mono for numbers and labels.
- **1 page frame.** One max width and one left edge for every page.
