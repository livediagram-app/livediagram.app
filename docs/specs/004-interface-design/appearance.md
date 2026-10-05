# Appearance (light / dark / system), site-wide

**Appearance** is the reader's own choice of light or dark chrome. It is one setting for the whole origin: the editor (`apps/live`), the marketing site (`apps/marketing`), the help centre (`apps/help`) and the telemetry dashboard (`apps/telemetry`) all read and write the same value, so a pick made anywhere holds everywhere. It is distinct from a document's **theme**, which recolours canvas content and is stored in the document ([Live app](../007-editor/live-app.md#appearance-light--dark--system) covers the editor-specific parts: the Default theme following it, the match nudge).

## The setting

- Three settings: **Light**, **Dark**, **System**. System resolves through `(prefers-color-scheme: dark)` and is watched, so an OS that turns dark at sunset takes every open page with it without a reload.
- **System is the default** on every surface. Only an explicit Light or Dark pick overrides the device, and it keeps overriding it until the reader picks again.
- Stored per browser in `localStorage` under `livediagram:v2:ui-mode` (`'light'` / `'dark'` / `'system'`; anything else reads as System). The key keeps its historical name because it is stored data. Every app is served from one origin by the router, so they share it. A pick made in another open tab applies on the next page load there.
- Painted as a `dark` class on `<html>`; the shared Tailwind theme maps `dark:` to that class and swaps in the Steel dark palette ([Colour scheme](color-scheme.md)). The document's CSS `color-scheme` follows the class, so form controls and native scrollbars match the painted appearance rather than the OS.

## No flash

Every app's root layout inlines the same tiny script, before first paint, that applies the stored setting (System consulting the OS). A first-time visitor on a dark machine therefore lands dark on their very first load. The script never throws (storage denied, no `matchMedia`); it degrades to light.

## The control

- One button that **cycles Light → Dark → System**, showing the CURRENT setting (sun / moon / monitor); its accessible name says where the next click goes.
- In the editor it sits in the tab bar's controls ([Live app](../007-editor/live-app.md)). In [Power user mode](../007-editor/power-user-mode.md#quick-appearance-switch) a click switches between Light and Dark, and a right-click sets System. The public sites, the home page included, have no power user mode and always cycle.
- On the public sites the toggle is **never in the header**. It sits on **its own small rail at the right edge**, directly under the [share rail](../019-marketing/marketing-site.md#social-sharing) where that shows, an icon button in the rail's style, with the toolbar name "Appearance". The rail shows from `xl` up on every public site (a surface that turns sharing off, such as the help centre, keeps the Appearance card alone). Below `xl` there is no gutter for it, so it is left out and the appearance follows its saved choice or the device (System). It is quiet (a ghost icon button).
- The public-site control emits **no telemetry**: those sites report page views only ([Page view telemetry](../017-telemetry/page-view-telemetry.md)). The editor's control keeps its `UI / Toggled / <setting>` event.

## What goes dark

Everything a reader sees on those four apps, including the landing page's illustrations. The editor mock-ups on the marketing site (the hero's windows and the feature art) render **the editor as it looks in dark**: dark chrome around diagrams drawn exactly as the real editor draws them on the **Default theme** (its dark half: the dark canvas and the dark ink of unpainted elements), so the examples show the real thing rather than an illustrator's palette. The one exception is the hero's theme beat, which demonstrates switching theme and so switches to Pine, the dark counterpart of the light appearance's Forest. Elements whose colour is their identity in the real editor (sticky notes, link cards, cursors and avatars, highlights, selection) keep it, as does an element the example deliberately painted, since the editor keeps a user's paint on any theme, and art whose subject IS colour (the theme catalogue, the format painter, custom themes) shows those colours. In light appearance the same examples are drawn on the Default theme's light half. Template previews use the shared `preview-art-tile` re-lighting. The help centre's article illustrations and category banners do the same: in dark they show the editor's dark chrome, while a surface that is dark in both appearances (a code block, the presenter HUD, an embed snippet), the light half of a light/dark comparison and a theme's swatches keep their own colours.
