# Appearance (light / dark / system): blueprint

Derived from [Appearance](../../004-interface-design/appearance.md) (the origin-wide setting, its boot script and the
public-site toggle) and [Live app, Appearance](../live-app.md#appearance-light--dark--system) (the editor's parts), with the dark-mode token rules from
[Colour scheme](../../004-interface-design/color-scheme.md) and the Default scheme's per-viewer halves from
[Canvas and palette](../../008-canvas/canvas-and-palette.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                       | Role                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/ui/src/appearance/appearance-storage.ts`         | Storage key, media query, `APPEARANCE_BOOT_SCRIPT`; a plain module           |
| `packages/ui/src/appearance/appearance-store.ts`           | Setting, resolution, OS watch, write, the `.dark` class; no React            |
| `packages/ui/src/appearance/appearance-cycle.ts`           | The cycle, the labels, the control's accessible name                         |
| `packages/ui/src/appearance/useAppearance.ts`              | The subscription (`useSyncExternalStore`) and the cycle; optional `onSet`    |
| `packages/ui/src/appearance/AppearanceIcon.tsx`            | Sun / moon / monitor glyph for the current setting                           |
| `packages/ui/src/appearance/SiteAppearanceToggle.tsx`      | The public sites' control, in `SiteHeader`; no telemetry                     |
| `packages/ui/src/site.ts`                                  | `PUBLIC_VIEWPORT` (`colorScheme: 'light dark'`) and `DARK_READER_LOCK`       |
| `apps/*/app/layout.tsx` (live, marketing, help, telemetry) | Inline the boot script; declare the lock meta; dark body                     |
| `apps/live/hooks/ui/useAppearance.ts`                      | The shared hook plus the editor's telemetry                                  |
| `apps/live/components/chrome/AppearanceToggle.tsx`         | The three-state control on the TabBar                                        |
| `apps/live/components/chrome/ThemeModeBanner.tsx`          | The match nudge                                                              |
| `apps/live/components/canvas/CanvasSurfaceContext.tsx`     | Carries the `CanvasSurface` past `React.memo` element views                  |
| `packages/document/src/colors.ts`                          | `CanvasSurface`, `canvasSurface`, `isLightColor`, the `default*Color` inks   |
| `packages/document/src/canvas-colors.ts`                   | The Default scheme's light and dark canvas colours                           |
| `packages/tailwind-config/theme.css`                       | The `dark:` class variant, the brand / slate tokens, `color-scheme`          |
| `packages/template-previews/src/preview-art-tile.css`      | Re-lights light-canvas preview art onto the dark canvas colour under `.dark` |

## Domain and naming

One term, one identifier. The left column is the only spelling used in code, tests and logs.

| Term               | Identifier                                            | Meaning                                                          |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| Appearance setting | `AppearanceSetting` (`'light' \| 'dark' \| 'system'`) | What the user picked; what a control renders                     |
| Appearance         | `Appearance` (`'light' \| 'dark'`)                    | What the chrome is painted as; what a colour decision reads      |
| Default setting    | `DEFAULT_APPEARANCE_SETTING` (`'system'`)             | The setting of a visitor who never touched the control           |
| Resolution         | `resolveAppearance(setting)`                          | Setting to appearance; only `system` asks the OS                 |
| Dark class         | `dark` on `document.documentElement`                  | The single switch every `dark:` utility keys on                  |
| Boot script        | `APPEARANCE_BOOT_SCRIPT`                              | The inline script that sets the dark class before first paint    |
| Canvas surface     | `CanvasSurface` (`'light' \| 'dark'`)                 | The paper a canvas colour amounts to, from `canvasSurface(bg)`   |
| Match nudge        | `ThemeModeBanner`                                     | Offer to switch appearance when a tab's scheme disagrees with it |
| Dark Reader lock   | `<meta name="darkreader-lock">`                       | The extension's opt-out, declared through `metadata.other`       |

Banned synonyms: "UI mode" and "dark mode toggle" in code and copy (the stored key `livediagram:v2:ui-mode` keeps its
name as data on the wire); "theme" for the appearance, since a theme is the document's.

## Behaviour and state

### States and transitions

The setting is a three-state cycle driven by `nextAppearanceSetting`: `light → dark → system → light`.

- **T1 (click):** `setAppearance(next)` writes the setting, attaches the OS watch, applies the resolved appearance to the
  dark class, and notifies every subscriber, in that order.
- **T2 (OS flips):** the `change` listener on the `DARK_MEDIA_QUERY` list repaints and notifies only while the setting is
  `system`. Under an explicit `light` / `dark` it returns early.
- **T3 (first read):** `getAppearanceSetting` seeds lazily from storage on the first client read and never writes.

### Boot, in order

1. The server renders `<html>` with no `dark` class (`getServerAppearance()` is `'light'`, and a control renders the
   default setting, `getServerAppearanceSetting()`); `suppressHydrationWarning` is scoped to `<html>` alone.
2. `APPEARANCE_BOOT_SCRIPT` runs in `<body>` before any content paints. It adds `dark` when the stored value is `'dark'`,
   or when it is anything other than `'light'` and the media query matches.
3. React hydrates. `useAppearance`'s mount effect re-applies the resolved appearance, so an embed or test without the root
   layout still lands right.

### Invariants

- **I1:** the boot script and `resolveAppearance` agree on every stored value: `'dark'` is dark, `'light'` is light, and
  anything else (including `'system'`, missing and unknown) follows the device.
- **I2:** an explicit `light` / `dark` never reads the media query.
- **I3:** changing the appearance never writes to the document; the Default scheme resolves per viewer at render time.
- **I4:** the dark class is the only DOM state; nothing else in the chrome decides light or dark on its own.
- **I5:** Dark Reader never recolours the editor while the lock meta is in the served `<head>`.

## Interfaces and contracts

```ts
export type Appearance = 'light' | 'dark';
export type AppearanceSetting = Appearance | 'system';
export const DEFAULT_APPEARANCE_SETTING: AppearanceSetting = 'system';
export function readAppearanceSetting(): AppearanceSetting;
export function resolveAppearance(setting: AppearanceSetting): Appearance;
export function applyAppearance(appearance: Appearance): void;
export function setAppearance(next: AppearanceSetting): void;
export function useAppearance(onSet?: (next: AppearanceSetting) => void): {
  setting: AppearanceSetting;
  appearance: Appearance;
  set: (next: AppearanceSetting) => void;
  cycle: () => void;
};
export type CanvasSurface = 'light' | 'dark';
export function canvasSurface(backgroundColor: string | undefined | null): CanvasSurface;
```

Validation: `readAppearanceSetting` accepts exactly the three literals. Every other stored value is rejected by
falling back to `DEFAULT_APPEARANCE_SETTING`; there is no error path, because a wrong preference must never block the
editor.

## Data and persistence

| Field                    | Store                             | Class             | Notes                                       |
| ------------------------ | --------------------------------- | ----------------- | ------------------------------------------- |
| `livediagram:v2:ui-mode` | `localStorage`, this browser only | Device preference | Values `'light'` / `'dark'` / `'system'`    |
| Dismissed nudge key      | `ThemeModeBanner` component state | Ephemeral         | `${themeId}:${target}`; resets per mismatch |

Nothing is synced to the api or written into a document. Migration: none; older builds wrote `'light'` / `'dark'`, which
read back unchanged, and anything older reads as the default.

## Errors and edge cases

| Case                                      | Handling                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `localStorage` throws (private mode)      | Boot script: `try/catch`, page stays light. Store: guarded read / write |
| No `matchMedia`                           | `system` resolves light; the boot script checks `typeof matchMedia`     |
| Server render                             | `applyAppearance` is a no-op without `document`                         |
| Unknown stored value                      | Reads as `system` (I1)                                                  |
| Route that never mounts the hook (`/new`) | The boot script alone paints it                                         |
| Dark Reader installed                     | Lock meta; the extension leaves the page untouched (I5)                 |
| Empty meta content                        | Next drops it from the head, so the content is `'true'` (D2)            |

## Security and trust

The setting is device-local and never leaves the browser except as a preset telemetry label. The boot script
interpolates `APPEARANCE_STORAGE_KEY` into a single-quoted string, so the key must hold no quote, backslash or newline;
`appearance-boot.test.ts` asserts it on the value. The script modules carry no `'use client'` boundary, so the server
layout inlines the real string rather than a client-reference stub.

## Performance and limits

- The boot script is one `localStorage` read and at most one `matchMedia` call, before paint.
- One `MediaQueryList` per page, created lazily and never detached (D1).
- A toggle is one class flip on `<html>`; every `dark:` utility restyles through the cascade with no React re-render
  beyond the subscribers.

## Presentation and UX

- The control shows the CURRENT setting (sun / moon / monitor); its tooltip and `aria-label` name where the next click goes.
- Surfaces covered: body backdrop, TabBar, EditorHeader, TemplatePicker, the `/new` backdrop, `DocumentLoading`, and the
  `MovablePanel` frame. Panel contents gain `dark:` variants one panel at a time.
- Preview tiles re-light through `.preview-art-tile`; colour-scheme swatches are excluded.
- The match nudge sits bottom-centre, yields to the sign-in banner, hides in zen and embed, and never shows for Default.

## Accessibility

- The control is a real `<button>` with an `aria-label` that states current and next setting.
- Dark tokens, the Steel ramp and the solid-fill rule are the [dark palette blueprint](../../004-interface-design/blueprints/dark-palette.md);
  its contrast audit covers dark mode.
- Light mode's brand-on-white contrast is the light half of [#74](https://github.com/livediagram-app/livediagram.app/issues/74),
  owned by Thomas; unresolved, so this category is not yet covered.

## Web Experience

- **CLS:** zero from appearance; the class is applied before first paint, so nothing reflows after hydration.
- **LCP:** the boot script is synchronous but tiny; it adds no network request.
- **INP:** a toggle is a class flip and a subscriber notify; no layout-heavy work on the interaction.

## Observability

- An editor toggle emits `track('UI', 'Toggled', 'Light' | 'Dark' | 'System')` through the shared hook's `onSet`.
- The public-site toggle emits nothing: those sites report page views only.
- Not yet covered: the boot script's `catch` and the storage fallbacks are silent, and an OS-driven repaint (T2) emits
  nothing. Tracked as an open question.

## Testing

| Rule                                                | Test                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| System is the default; unknown reads as System      | `appearance-store.test.ts`, `readAppearanceSetting`                    |
| Explicit pick outranks the device (I2)              | `appearance-store.test.ts`, `resolveAppearance`                        |
| OS flip repaints only under System (T2)             | `appearance-store.test.ts`, "the OS changing under a System setting"   |
| Boot script agrees with the store (I1)              | `appearance-boot.test.ts`, "the appearance boot script"                |
| Key survives quoting; no client boundary            | `appearance-boot.test.ts`, "the inlined storage key"                   |
| Every app inlines the script, dark body             | `appearance-boot.test.ts`, "the <app> root layout"                     |
| Public toggle cycles, paints, persists              | `SiteAppearanceToggle.test.tsx`                                        |
| SiteHeader carries the toggle                       | `SiteAppearanceToggle.test.tsx`, "SiteHeader"                          |
| No light full-screen surface without a dark variant | `dark-mode-coverage.test.ts`                                           |
| Preview tiles re-lit by one rule                    | `dark-mode-coverage.test.ts`, "tiles of light-canvas illustration art" |
| Cycle, canvas and element ink follow (I3)           | `e2e/appearance.spec.ts`, "opens on the device setting, then cycles"   |
| Appearance never writes to the document (I3)        | `e2e/appearance.spec.ts`, "changing the appearance never writes"       |
| Setting survives reload before first paint          | `e2e/appearance.spec.ts`, "remembers the setting across a reload"      |
| Lock meta declared (I5)                             | `dark-reader-lock.test.ts`                                             |
| Lock meta reaches the served head (I5)              | `e2e/appearance.spec.ts`, "tells Dark Reader to stand down"            |

## Constants and configuration

| Constant                       | Value                            | Provenance                              | Safe range                            |
| ------------------------------ | -------------------------------- | --------------------------------------- | ------------------------------------- |
| `APPEARANCE_STORAGE_KEY`       | `'livediagram:v2:ui-mode'`       | Stored data; renaming resets every user | Fixed; no quote, backslash or newline |
| `DARK_MEDIA_QUERY`             | `'(prefers-color-scheme: dark)'` | CSS Media Queries Level 5               | Fixed                                 |
| `DEFAULT_APPEARANCE_SETTING`   | `'system'`                       | Spec: System is the default             | One of the three literals             |
| `DEFAULT_BACKGROUND_COLOR`     | `#ffffff`                        | Colour scheme: canvas is pure white     | Light (`isLightColor` true)           |
| `DARK_CANVAS_BACKGROUND_COLOR` | `#0d121a`                        | Default scheme's dark half (blue-slate) | Dark (`isLightColor` false)           |
| `DARK_CANVAS_PATTERN_COLOR`    | `#1c2735`                        | `#2e4057` at 45 % over the backdrop     | Visible against `#0d121a`             |
| `darkreader-lock` content      | `'true'`                         | D2                                      | Any non-empty string                  |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D1 and D2.

## Open questions

Resolved in the spec first, then here. Until then these stay out of the blueprint:

- Observability for the silent paths (boot script `catch`, storage fallbacks, OS-driven repaint).
