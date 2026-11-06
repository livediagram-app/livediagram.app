# Power user mode

Status: retired (4 November 2026, Work Tracker #500)

## What it was

**Power user mode** was a preference for people who already knew the editor. Switching it on wrote a preset of
recommended settings once (alignment guides, auto-attach arrows, every tour marked seen, Minimal chrome) and unlocked
settings for someone who no longer needed the interface explained:

- **Minimal chrome**, which hid captions, panel titles, help buttons, onboarding hints and the desktop bin, and moved
  the [role pill](editor-app.md#role-pill) to an icon in the status bar.
- **The quick appearance switch**: the status bar's Appearance control flipped Light and Dark on a click, with System
  on a right-click.
- **No More button on desktop**: the selection toolbars dropped `⋯`, leaving right-click as the way to the element menu.

It had a Settings row under a **Power User** heading in Editor, with Minimal Chrome and a "Set By Power User Mode"
readout nested beneath it, and a one-time offer (a toast after 20 editing days or 50 keyboard shortcuts).

## Why it went

The editor's interface has since been simplified for everyone, so a second, quieter version of it is no longer worth
its weight: two ways for every chrome surface to look, a preset to keep in step with Settings, and an offer to make.
Everyone now gets the same interface, today's default.

## What happens to stored preferences

- **Everything the preset wrote stays.** A person who had the mode on keeps their alignment guides, auto-attach
  arrows and tours seen, exactly as they are now. Nothing is reverted, and the element tours' seen flag
  (`elementToursSeen`) counts every Show Me tour as answered whoever wrote it ([Element tours](element-tours.md)).
- **Minimal chrome turns off.** Nothing reads it any more.
- **The mode's keys are retired.** `powerUserMode`, `powerUserBaseline`, `minimalChrome` and `powerUserOfferShown` are
  dropped on read, so the next write stores the synced blob without them ([User preferences](user-preferences.md)
  "Retired keys"). A blob that still carries them loads cleanly, its other settings intact. The offer's device-local
  counters (`livediagram:power-user-offer:v1` in `localStorage`) are left in place and never read.
- **Every app shares two of them.** `powerUserMode` and `minimalChrome` lived in the `all` scope every app reads.
  `@liveworkspace/settings` lists them as retired keys (`RETIRED_ALL_SETTING_KEYS`): no app shows them, and the next
  write any app makes clears them from that scope, with nothing written on load.
- **Telemetry.** `PowerUserModeOn`/`Off`, `MinimalChromeOn`/`Off` and the `PowerUserOffer` events are no longer sent,
  and the public dashboard no longer charts them ([Telemetry](../017-telemetry/telemetry.md)).

## Help

The help article (User Interface › Power user mode) is retired: its address lands on Settings (the router's
`LEGACY_HELP_ARTICLES` and a moved stub in the help app, `powerUserModeMoved` in help-site), and the Settings, Quick
Controls, Title Bar, Toolbar, Dark Mode, Explorer panel, Multi-select and Search panel articles no longer mention the
mode.

## Shared code

The mode is gone from every editor (livediagram, liveplanner, livedesign, livedocuments, then livehuddle), so the
shared pieces went with the last of them (Work Tracker #500 part 5): `MinimalChromeProvider` and `useMinimalChrome`
(workbench), the `powerUser` rows and the preset readout (settings-ui), the quick switch's helpers (ui), the
Explorer's last Minimal chrome reads, and the help site's Settings illustration's Power User row.
