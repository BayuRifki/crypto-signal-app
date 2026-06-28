---
name: Terminal Neutral
description: Professional dark crypto terminal. Dense data, high legibility, neutral blue-grey surfaces with green/red reserved for signal direction.
colors:
  primary: "#0B0E11"
  secondary: "#151A21"
  tertiary: "#6366F1"
  tertiary-container: "#1E1B2E"
  on-tertiary: "#EAECEF"
  accent-sell: "#F6465D"
  neutral: "#EAECEF"
  surface: "#151A21"
  surface-elevated: "#1E2329"
  surface-panel: "#262B32"
  line: "#2B3139"
  line-strong: "#3E454D"
  fg: "#EAECEF"
  fg-muted: "#848E9C"
  fg-dim: "#5E6673"
  buy: "#0ECB81"
  buy-soft: "rgba(14, 203, 129, 0.12)"
  sell: "#F6465D"
  sell-soft: "rgba(246, 70, 93, 0.12)"
  hold: "#848E9C"
  hold-soft: "rgba(132, 142, 156, 0.12)"
  warn: "#F0B90B"
  warn-soft: "rgba(240, 185, 11, 0.12)"
  info: "#3B82F6"
  info-soft: "rgba(59, 130, 246, 0.12)"
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 1.75rem
    fontWeight: 700
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: 600
    letterSpacing: -0.01em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    lineHeight: 1.4
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 0.75rem
    lineHeight: 1.35
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 0.6875rem
    fontWeight: 600
    letterSpacing: 0.12em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: 500
    fontFeature: "'tnum', 'cv11'"
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 1.125rem
    fontWeight: 700
    fontFeature: "'tnum', 'cv11'"
rounded:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  '2xl': 48px
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  card-elevated:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 10px
  button-primary-hover:
    backgroundColor: "#818CF8"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    padding: 8px
  button-ghost-hover:
    backgroundColor: "{colors.line}"
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "{colors.accent-sell}"
    textColor: "#0B0E11"
    rounded: "{rounded.md}"
  badge-buy:
    backgroundColor: "{colors.buy-soft}"
    textColor: "{colors.buy}"
    rounded: "{rounded.full}"
  badge-sell:
    backgroundColor: "{colors.sell-soft}"
    textColor: "{colors.sell}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  kpi-label:
    typography: "{typography.label-caps}"
    textColor: "{colors.fg-dim}"
  kpi-value:
    typography: "{typography.data-mono-lg}"
    textColor: "{colors.fg}"
---

## Overview

Terminal Neutral is a Binance/Bybit-style professional trading terminal for crypto signal analysis. Dense, data-first, and built for high legibility under continuous use. Green and red are reserved exclusively for signal direction (buy/sell); all other UI accents use indigo, blue, or amber to avoid ambiguity.

## Colors

The palette is built on a near-black base with indigo for active UI and green/red strictly for signal states.

- **Primary (#0B0E11):** Near-black — the anchor everything sits on.
- **Secondary (#151A21):** First lift of surface, darker than panels.
- **Tertiary (#6366F1):** Indigo accent — used for active UI states and primary buttons (buy-action affordances use green).
- **Signal red (#F6465D):** Reserved for sell-action affordances only.
- **Neutral (#EAECEF):** Near-white for high-emphasis text.

Semantic rule: green (#0ECB81) and red (#F6465D) are directionally locked to signals. Never use them decoratively. Use indigo/blue/amber for general active states.

## Typography

Two-voice system: a humanist-geometric sans for prose (Space Grotesk) and a tabular monospace for all numbers, prices, and timestamps (JetBrains Mono). The split enforces the idea that *data is distinct from commentary* in this interface.

Headlines use negative tracking for a sharper, more editorial character. Body is 14px at a roomy 1.4 line-height to preserve scanability in dense panels.

Labels run in all-caps with wide tracking — a nod to instrument panels. They must not exceed one line.

## Layout

Grid is 12-column at desktop, collapses to a single rail on mobile. Dense panels should breathe with `lg` (24px) gutters. Sticky header is `surface-elevated` with a hairline.

## Elevation & Depth

Elevation is expressed primarily through surface brightness (lighter tones indicate higher elevation). Three surface levels: base (#151A21) → panel (#262B32) → elevated (#1E2329). No drop shadows in the base system — only 1px hairlines at `line`. For floating panels (modals, dropdowns), subtle shadows are acceptable in terminal style: `0 4px 16px rgba(0,0,0,0.4)`. An indigo glow variant (`0 0 20px rgba(99, 102, 241, 0.35)`) is reserved for the currently-active signal state.

## Shapes

Corner radii are small and geometric (4–20px). The 20px radius is reserved for modals and floating overlays only. Chips and badges are fully pill-shaped (`full`).

## Components

- **Cards:** Matte surface with 1px hairline, never shadow. Hover lifts the border one step stronger, never adds glow except for signal states.
- **Buttons:** Primary is solid indigo on near-black. Ghost is outline + muted text. Danger is solid red.
- **Badges:** Buy badge is green-soft background with green text. Sell badge is red-soft. Hold badge is neutral-mute on near-black.
- **KPI blocks:** Label in all-caps Space Grotesk, value in large tabular JetBrains Mono. Never mix fonts.

## Do's and Don'ts

**Do:** Use monospace for every number. Use green for only-buy, red for only-sell. Use indigo/blue/amber for active states. Keep labels uppercase and tracked. Keep surfaces matte — subtle shadows only for floating panels.

**Don't:** Use gradients as backgrounds. Use rounded buttons (stay geometric). Add decorative icons without function. Use green/red for anything other than signal direction.