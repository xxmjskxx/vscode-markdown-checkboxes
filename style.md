# Style Centralization — Approval Sheet (Devvit)

Purpose: a per-change checklist you can approve **one item at a time** before any implementation. The goal is to make colors/states adjustable in one place (CSS vars/utilities in [devvit/src/client/index.css](devvit/src/client/index.css) + button behavior in [devvit/src/client/game/ui/Button.tsx](devvit/src/client/game/ui/Button.tsx)) **without accidental visual regressions**.

**Scope clarification:** Tailwind remains for layout, spacing, and typography utilities (`flex`, `gap-2`, `p-4`, `text-sm`). This work targets **palette-driven color classes only** (`bg-teal-600`, `text-white`, `bg-black/70`, etc.), replacing them with semantic classes backed by CSS variables.

## Scope

**In scope (this sheet):**
- Centralize palette-driven color usage into CSS variables + semantic utilities.
- Standardize `Button` / modal scrim usage so states and colors are easy to tune in one place.
- Remove **static** inline styles by moving them into CSS utilities/vars.

**Out of scope by default (track separately or mark explicitly as non-style):**
- Copy changes, “polish/redesign”, and layout reflows.
- Interaction/behavior changes (tooltips, streak rendering rules, etc.).

## Guardrails (agreed approach)

- Do **not** remove inline styles “just because”.
  - **Static/presentational inline styles** should move to CSS classes/vars.
  - **Dynamic layout styles** (e.g. a percentage bar width) are acceptable best-practice exceptions.
  - Inline `style` must not contain hardcoded colors (hex/rgb/hsl); it may set layout values (e.g. width) or a CSS variable for layout only.
- Replace Tailwind palette colors with **semantic utilities backed by CSS variables**.
- Preserve intentional variety (hint tiers, thread-solved color, warning vs danger).
- Prefer small, meaning-based tokens; avoid adding a token per one-off.
- Token taxonomy rule: only add a new CSS variable when it represents a distinct meaning used in 2+ places (e.g., accent, scrim, tooltip surface, thread-solved, hint tiers).
- Avoid monolithic files:
  - [devvit/src/client/index.css](devvit/src/client/index.css) should stay organized into short sections (Theme vars → Semantics → Utilities).
  - [devvit/src/client/game/ui/Button.tsx](devvit/src/client/game/ui/Button.tsx) should remain a small mapping from variant/state → semantic classes.

**Canonical color reference (current baseline to preserve unless explicitly approved):**
- Primary button currently uses `teal-600` with hover `teal-700` → migrate to `--app-accent` / `--app-accent-hover` while preserving the current look.

**Test notes:**
- [devvit/src/client/game/ui/Button.test.tsx](devvit/src/client/game/ui/Button.test.tsx) asserts `bg-teal-600` — update assertions when converting to `bg-accent`.

## Implementation guidance (non-binding)

### Suggested implementation order

1. **Phase 1 — Foundation tokens (Section C):** Add `--app-accent`, `--app-scrim`, `--app-tooltip-*`, `--app-thread-*` to index.css. No component changes yet.
2. **Phase 2 — Component updates:** Convert Button.tsx to use semantic classes; standardize scrim across modals.
3. **Phase 3 — Scattered palette cleanup:** Replace remaining `bg-teal-*`, `text-white`, hint tier colors with semantic tokens.

### PR boundary guidance

- **Scrim refactor** touches 10+ files — implement as a distinct PR, not bundled with other work.
- **Button.tsx conversion** should include test updates in the same PR.
- Group related color changes (e.g., all hint tier colors) into single PRs.

### Definition of done (per item)

✅ Token/class added → ✅ Component updated → ✅ Tests pass → ✅ Docs synced (THREAD_CODEBASE_GUIDE.md if patterns change)

## What “approval” means here

Each checkbox row below is an individually reviewable change request. If approved, the implementation will:
- keep existing conditionals/behavior unless the item explicitly requests behavior changes, and
- use centralized semantics rather than one-off styles.

---

## A) Items explicitly listed in ToDo_refine_ordered.todo

### Theme / Final phase

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [x] | Layout/Copy | Final phase header/icons | Fix Final phase wording, icons | [devvit/src/client/game/game/ThemePhase.tsx](devvit/src/client/game/game/ThemePhase.tsx) | Standardize icon sizing/alignment and wording using shared typography/icon patterns | Med |
| [~] | Style-only | Theme phase controls | Give up button is ugly; hover state needs improvement | [devvit/src/client/game/game/ThemePhase.tsx](devvit/src/client/game/game/ThemePhase.tsx) | Convert to shared Button / variant so hover/active/disabled match app standards | Med |
| [x] | Style-only | Give Up modal CTA | “Reveal” button has no hover state; animations don’t match other buttons | [devvit/src/client/game/views/GiveUpModal.tsx](devvit/src/client/game/views/GiveUpModal.tsx) | Ensure CTA uses shared Button variant; align animation/hover with Button.tsx patterns | Low |
| [~] | Layout/UX | Theme guessing mode | Theme guessing phase appearance needs polish/redesign | [devvit/src/client/game/game/ThemeInput.tsx](devvit/src/client/game/game/ThemeInput.tsx) | Consolidate ad-hoc controls (shuffle/sort/give-up) into shared control primitives and consistent spacing | High |

### UI/UX — General

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [x] | Behavior/UX | Buttons (global) | Click states should also be used for tap states | (cross-cutting) | Ensure Button handles active/tap consistently for mobile | Med |
| [ ] | Behavior/UX | Buttons (global) | Hover states should also be used for long-press states | (cross-cutting) | Ensure long-press maps to hover affordance for touch | Med |

### Main Menu & Splash

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Layout | Main menu top buttons | Make calendar and streak buttons look more similar | [devvit/src/client/game/views/MainMenuView.tsx](devvit/src/client/game/views/MainMenuView.tsx) | Normalize shape/padding/hover via shared button primitive (IconButton/Button) | Med |
| [ ] | Style-only | Splash stats | “—” fallback for fastest should not use green font | [devvit/src/client/game/views/SplashView.tsx](devvit/src/client/game/views/SplashView.tsx) | Conditional styling: use neutral/muted when value missing | Low |
| [ ] | Behavior/UX | Splash streak | Streak should show even when 0; use unfilled + grey | [devvit/src/client/game/views/SplashView.tsx](devvit/src/client/game/views/SplashView.tsx) | Always render; change styling when 0 | Low |
| [ ] | Layout | Main menu status line | Trophy icon should be inline; flame still below text | [devvit/src/client/game/views/MainMenuView.tsx](devvit/src/client/game/views/MainMenuView.tsx) | Ensure icon+text rows are `flex items-center` with consistent baseline/size | Low |

### In-Game (Tiles, Selection, Hints)

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Difficulty tooltip | Tooltip should use same difficulty colors as badge | [devvit/src/client/game/game/DifficultyPill.tsx](devvit/src/client/game/game/DifficultyPill.tsx) | Bind tooltip colors to the same semantic difficulty tokens | Med |
| [ ] | Layout | Difficulty tooltip layout | Tooltip should be 2 lines; sometimes wraps to 3 | [devvit/src/client/game/game/DifficultyPill.tsx](devvit/src/client/game/game/DifficultyPill.tsx) | Constrain formatting/max-width so line breaks are stable | Low |
| [ ] | Behavior/UX | Hint tooltips behavior | Hint bar tooltips should only show on hover/long press, not click/tap | [devvit/src/client/game/ui/Tooltip.tsx](devvit/src/client/game/ui/Tooltip.tsx), [devvit/src/client/game/game/HintBar.tsx](devvit/src/client/game/game/HintBar.tsx) | Standardize tooltip interaction model; remove/avoid click-toggle where used in HintBar | Med |
| [ ] | Layout | Hint tooltip positioning | “Peek” tooltip too low/misaligned | [devvit/src/client/game/game/HintBar.tsx](devvit/src/client/game/game/HintBar.tsx) | Align offsets consistently (prefer shared tooltip positioning) | Low |

### Calendar

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Calendar month navigation | Nav buttons hover should match close button hover (teal) | [devvit/src/client/game/views/CalendarModal.tsx](devvit/src/client/game/views/CalendarModal.tsx), [devvit/src/client/game/views/Calendar.tsx](devvit/src/client/game/views/Calendar.tsx) | Use shared button/semantic hover token for nav controls | Low |

### Stats Modal

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Streak badge | Streak badge color looks muddy/brown (opacity issue) | [devvit/src/client/game/views/StatsView.tsx](devvit/src/client/game/views/StatsView.tsx) | Replace palette opacity colors with semantic streak token tuned for both themes | Low |
| [ ] | Layout | Clean solves tooltip | Tooltip shows single word per line | [devvit/src/client/game/views/StatsView.tsx](devvit/src/client/game/views/StatsView.tsx) | Reformat tooltip content + constrain width so it reads cleanly | Low |
| [ ] | Layout | Clean solves layout | Box too small; should align with row above | [devvit/src/client/game/views/StatsView.tsx](devvit/src/client/game/views/StatsView.tsx) | Normalize stat-tile sizing and ensure tooltip wrapper doesn’t shrink layout | Med |
| [ ] | Style-only | Share Stats modal | Modal not using shared buttons/styles | [devvit/src/client/game/views/ShareStatsView.tsx](devvit/src/client/game/views/ShareStatsView.tsx) | Convert CTAs to shared Button variants; consistent disabled/success/error/hover | Med |
| [ ] | Style-only | Share Stats modal CTAs | Buttons have no hover; remove old emojis mixed with icons | [devvit/src/client/game/views/ShareStatsView.tsx](devvit/src/client/game/views/ShareStatsView.tsx) | Remove emoji labels; use icons only; unify hover states | Med |

### How To Play modal

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Cooldown callout | “15 second cooldown…” text needs background | [devvit/src/client/game/views/TutorialModal.tsx](devvit/src/client/game/views/TutorialModal.tsx) | Ensure callout uses surfaced container matching modal style | Low |

### Branding & Logo

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Logo per theme | Dark and light themes might be using same logo in main menu | [devvit/src/client/game/views/MainMenuView.tsx](devvit/src/client/game/views/MainMenuView.tsx) | Ensure correct asset selection for theme: [devvit/assets/thread_logo_dark.svg](devvit/assets/thread_logo_dark.svg) / [devvit/assets/thread_logo_light.svg](devvit/assets/thread_logo_light.svg) | Med |

### Colors & Themes

| Approve | Change type | UI surface | Issue (from todo) | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Tile pool (dark mode) | Verify / adjust #27272a usage | [devvit/src/client/index.css](devvit/src/client/index.css) | Tune tile pool/slot vars for contrast without changing component code | High |
| [ ] | Style-only | Empty slots (dark mode) | Empty tile spaces in dark mode are #27272a (seems incorrect) | [devvit/src/client/index.css](devvit/src/client/index.css) | Tune empty-slot var for correct separation from background | High |
| [ ] | Style-only | Texture overlay | Verify texture overlay/vignette works | [devvit/src/client/game/game/AnimatedBackground.tsx](devvit/src/client/game/game/AnimatedBackground.tsx) | Ensure vignette uses semantic vars (no hardcoded RGBA) and looks right both themes | Med |
| [ ] | Style-only | Streak colors | Flame/text color should be orange (not pale yellow) in menus | [devvit/src/client/index.css](devvit/src/client/index.css) | Adjust semantic streak tokens to match desired palette | Med |
| [ ] | Style-only | Dark translucency | Some translucent colors too muddy in dark mode | [devvit/src/client/index.css](devvit/src/client/index.css) | Adjust alpha-based tokens centrally (scrim, hovers, soft fills) | Med |
| [ ] | Style-only | Dark hover standard | Standardize dark hover via a semantic hover token (not a palette literal); allow per-variant overrides (accent/danger) if needed | [devvit/src/client/index.css](devvit/src/client/index.css), [devvit/src/client/game/ui/Button.tsx](devvit/src/client/game/ui/Button.tsx) | Choose one hover token and enforce via semantic utilities | Med |
| [ ] | Style-only | Light mode | Light mode colors look poor; borders should be subtle | [devvit/src/client/index.css](devvit/src/client/index.css) | Revise light-mode vars; keep border tokens subtle | High |
| [ ] | Style-only | Button contrast | Some buttons lack contrast (hint buttons, calendar button) | [devvit/src/client/index.css](devvit/src/client/index.css) + related components | Prefer fixing via token tuning; add borders only if needed for readability/accessibility | High |

---

## B) Additional suspected style offenders (not in todo)

| Approve | Change type | UI surface | Suspected issue | Likely file(s) | Proposed correction (high-level) | Risk |
|---:|---|---|---|---|---|---|
| [ ] | Style-only | Splash primary CTA | “Play Now” uses custom palette classes, not shared Button | [devvit/src/client/game/views/SplashView.tsx](devvit/src/client/game/views/SplashView.tsx) | Convert to shared Button variant (no visual change unless approved) | Med |
| [ ] | Style-only | Modal scrims | Many overlays reimplement scrim with `bg-black/70` | [devvit/src/client/game/ui/Modal.tsx](devvit/src/client/game/ui/Modal.tsx) + various views | Centralize scrim via `--app-scrim` + `.bg-scrim` | High |
| [ ] | Style-only | Hint tier colors | HintBar/Help use Tailwind palette tokens for tier colors | [devvit/src/client/game/game/HintBar.tsx](devvit/src/client/game/game/HintBar.tsx), [devvit/src/client/game/views/HelpView.tsx](devvit/src/client/game/views/HelpView.tsx) | Move tier colors into CSS vars (tier-specific tokens), keep tooltips tier-colored | Med |
| [ ] | Style-only | Thread visuals | Thread overlay uses palette strokes/fills | [devvit/src/client/game/game/ThreadVisual.tsx](devvit/src/client/game/game/ThreadVisual.tsx) | Introduce `--app-thread-base` + `--app-thread-solved` and use semantic classes | Med |
| [ ] | Style-only | ThemeInput controls | Shuffle/sort controls are ad-hoc icon buttons | [devvit/src/client/game/game/ThemeInput.tsx](devvit/src/client/game/game/ThemeInput.tsx) | Convert to IconButton/shared control so hover/press is standardized | Low |
| [ ] | Style-only | DevTools panel | DevTools uses non-semantic palette colors (`bg-white`, etc.) | [devvit/src/client/game/views/DevToolsView.tsx](devvit/src/client/game/views/DevToolsView.tsx) | Normalize to semantic surfaces + shared buttons (optional scope) | Med |

---

## C) Foundation centralization changes (mechanical, enable one-place tuning)

| Approve | Change type | Change | File(s) | Intended effect | Risk |
|---:|---|---|---|---|---|
| [ ] | Style-only | Add semantic accent tokens (`--app-accent`, hover, on-accent) + utilities | [devvit/src/client/index.css](devvit/src/client/index.css) | Replace scattered `bg-teal-*` with semantic `.bg-accent` | Med |
| [ ] | Style-only | Add `--app-scrim` + `.bg-scrim` | [devvit/src/client/index.css](devvit/src/client/index.css) | One place to tune all modal backdrops | Low |
| [ ] | Style-only | Add tooltip surface tokens (`--app-tooltip-bg`, fg, arrow) | [devvit/src/client/index.css](devvit/src/client/index.css) | Fix tooltip readability across themes; enable tuning centrally | Med |
| [ ] | Style-only | Add thread tokens (`--app-thread-base`, `--app-thread-solved`) | [devvit/src/client/index.css](devvit/src/client/index.css) | Decouple solved-thread color from brand accent | Low |
| [ ] | Style-only | Make Button.tsx var-driven (no palette colors) | [devvit/src/client/game/ui/Button.tsx](devvit/src/client/game/ui/Button.tsx), [devvit/src/client/index.css](devvit/src/client/index.css) | Button look/states tunable centrally without per-screen edits | Med |

---

## D) Inline style exceptions (explicitly allowed best-practice cases)

| Approve | Change type | Case | Likely file(s) | Policy | Notes |
|---:|---|---|---|---|---|
| [ ] | Exception | Dynamic width bars (stats histograms) | [devvit/src/client/game/views/StatsView.tsx](devvit/src/client/game/views/StatsView.tsx), [devvit/src/client/game/views/ShareStatsView.tsx](devvit/src/client/game/views/ShareStatsView.tsx) | Keep dynamic width inline; centralize colors/typography only | Add comment explaining why inline width is best practice |
| [ ] | Exception | JS-only renderers needing concrete colors (confetti/canvas capture) | [devvit/src/client/game/views/VictoryView.tsx](devvit/src/client/game/views/VictoryView.tsx) | Centralize by reading CSS vars in JS (not by hardcoding hex) | Still yields one-place tuning |
