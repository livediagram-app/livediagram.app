# Appearance (light / dark / system), site-wide

**Appearance** is the reader's own choice of light or dark chrome. It is one setting for the whole origin: the editor (`apps/live`), the marketing site (`apps/marketing`), the help centre (`apps/help`) and the telemetry dashboard (`apps/telemetry`) all read and write the same value, so a pick made anywhere holds everywhere. It is distinct from a diagram's **theme**, which recolours canvas content and is stored in the diagram ([Live app](../007-editor/live-app.md#appearance-light--dark--system) covers the editor-specific parts: the Default theme following it, the match nudge).

## The setting

- Three settings: **Light**, **Dark**, **System**. System resolves through `(prefers-color-scheme: dark)` and is watched, so an OS that turns dark at sunset takes every open page with it without a reload.
- **System is the default** on every surface. Only an explicit Light or Dark pick overrides the device, and it keeps overriding it until the reader picks again.
- Stored per browser in `localStorage` under `livediagram:v2:ui-mode` (`'light'` / `'dark'` / `'system'`; anything else reads as System). The key keeps its historical name because it is stored data. Every app is served from one origin by the router, so they share it. A pick made in another open tab applies on the next page load there.
- Painted as a `dark` class on `<html>`; the shared Tailwind theme maps `dark:` to that class and swaps in the Steel dark palette ([Colour scheme](color-scheme.md)). The document's CSS `color-scheme` follows the class, so form controls and native scrollbars match the painted appearance rather than the OS.

## No flash

Every app's root layout inlines the same tiny script, before first paint, that applies the stored setting (System consulting the OS). A first-time visitor on a dark machine therefore lands dark on their very first load. The script never throws (storage denied, no `matchMedia`); it degrades to light.

## The control

- One button that **cycles Light → Dark → System**, showing the CURRENT setting (sun / moon / monitor); its accessible name says where the next click goes.
- In the editor it sits in the tab bar's controls ([Live app](../007-editor/live-app.md)).
- On the public sites it sits in the shared `SiteHeader`, icon-only, just left of the header's call-to-action buttons, on every page of marketing, help and the dashboard. It is quiet (a ghost icon button), so the header keeps its simplicity.
- The public-site control emits **no telemetry**: those sites report page views only ([Page view telemetry](../017-telemetry/page-view-telemetry.md)). The editor's control keeps its `UI / Toggled / <setting>` event.

## What goes dark

Everything a reader sees on those four apps, including the landing page's illustrations. The editor mock-ups on the marketing site (the hero's windows and the feature art) render **the editor as it looks in dark**: dark chrome, the dark half of the Default theme on the canvas, and themed canvases keeping their own colours as they do in the real editor. Template previews use the shared `preview-art-tile` re-lighting.
