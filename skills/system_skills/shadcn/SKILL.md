---
name: shadcn-ui
description: >
  Guidelines for using shadcn/ui components and CLI. Use ONLY when the user
  requests shadcn or shadcn/ui. Covers initialization, adding components,
  community registries, and theming.
---

# shadcn CLI Usage (If Using shadcn)

Initialize shadcn (if not already done). **Always use `--defaults` (or `-d`) to
skip interactive prompts** — the bare `init` command launches a TUI selection
menu that will no respond in this environment.

```bash
npx shadcn@latest init --defaults
```

If the user wants specific options, pass them as flags instead of relying on the
interactive prompts:

```bash
npx shadcn@latest init --base-color zinc --css-variables
```

Add components as needed:

```bash
npx shadcn add button card dialog sheet
```

### Community Registries (If Using shadcn)

Beyond core components, install from community registries:

| Registry             | Description              | Example                    |
| -------------------- | ------------------------ | -------------------------- |
| `@magicui`           | 150+ animated components | `npx shadcn add            |
|                      |                          | @magicui/globe`            |
| `@aceternity`        | Modern animated          | `npx shadcn add            |
|                      | components               | @aceternity/animated-beam` |
| `@assistant-ui`      | AI chat primitives       | `npx shadcn add            |
|                      |                          | @assistant-ui/thread`      |
| `@motion-primitives` | Motion-based components  | `npx shadcn add            |
|                      |                          | @motion-primitives/fade`   |
| `@glass-ui`          | Apple-style              | `npx shadcn add            |
|                      | glassmorphism            | @glass-ui/card`            |

# Theming (If Using shadcn)

shadcn uses CSS variables for theming:

-   Semantic classes: `bg-primary`, `text-foreground`, `bg-destructive`
-   Dark mode via `.dark` class on `<html>`
-   Customize via CSS variables in `index.css` (React) or `globals.css`
    (Next.js)

### Base Colors

Choose a base color that matches the app's personality:

Base Color | Vibe           | Good For
---------- | -------------- | -----------------------------
`neutral`  | Clean, minimal | Professional apps, dashboards
`slate`    | Cool, modern   | Tech products, SaaS
`zinc`     | Warm gray      | Creative apps, portfolios
`stone`    | Earthy, warm   | Organic brands, lifestyle

# Component Notes

-   For toast notifications, use `sonner` (`npx shadcn add sonner`)
-   Build `DatePicker` by combining `Popover` and `Calendar` components
