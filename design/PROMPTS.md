# Design prompts

Paste these into Claude Code from the root of this repo, in order. Replace anything in [brackets].

## 1. Write the product brief

```
Interview me to write PRODUCT.md for this interface, using design/templates/PRODUCT.template.md as the outline.
Ask one question at a time: who uses it, where and on what screen, what it must do, what it must never look like.
Then write PRODUCT.md at the repo root. Keep it under one page.
```

## 2. Write the design system

```
Read my brand guidelines at [path to PDF or folder], this reference I love at [path or URL], and PRODUCT.md.
Write a DESIGN.md at the repo root using design/templates/DESIGN.template.md as the outline:
colors as tokens (light and dark), type scale, layout frame, surfaces and radii, components, motion, content rules and a checklist.
Every rule must be specific enough that you could check a screen against it.
Then redesign every screen in public/ to follow it, and fold away anything a first-time viewer would not understand.
```

## 3. Review as a first-time viewer

```
Open http://localhost:4747 and screenshot every view at 1600x1000 and at 400px wide.
For each screen, tell me what a first-time viewer would not understand in five seconds, and anything that breaks DESIGN.md.
Don't fix anything yet. List the problems, worst first.
```

## 4. Name the problem, then make it a rule

```
This screen looks like AI made it: [what you see, e.g. "too many colored chips", "every row is a card", "the numbers all look the same weight"].
Fix it, then add a rule to DESIGN.md that would have prevented it, in the section it belongs to.
Show me the new rule.
```

## 5. Check before you share

```
Run the checklist in DESIGN.md section 11 against every screen. For each item, say pass or fail with the screen and the reason.
Then check that nothing private is visible: no .env values, tokens, invoices, personal photos or private links.
```

## Changing the look

```
Change the accent from cyan to [color]. Update --blue, --blue-ink (at least 4.5:1 on the ground) and --blue-wash in public/app.css,
the dot field in .ground::before, and the token table in DESIGN.md. Screenshot Home, Four Cs and Brain in light and dark mode to confirm.
```

```
Change the typeface to [family] from Google Fonts. Update the link in public/index.html, the --sans, --display and --mono variables,
and section 3 of DESIGN.md. Keep the same weights and the type scale.
```
