# Power user mode

Status: retired (5 November 2026, Work Tracker #500)

## What it was

**Power user mode** was a preference for people who already knew the editor. Switching it on wrote a preset of
recommended settings once (alignment guides, auto-attach arrows, the Pages tour and every element tour marked seen,
Minimal chrome) and unlocked settings for someone who no longer needed the interface explained:

- **Minimal chrome**, which hid captions, panel titles, help buttons, onboarding hints and the desktop bin, and moved
  the [role pill](live-app.md#role-pill) to an icon in the status bar.
- **The quick appearance switch**: the status bar's Appearance control flipped Light and Dark on a click, with System
  on a right-click.
- **No More button on desktop**: the selection toolbars dropped `⋯`, leaving right-click as the way to the element menu.

It had a Settings row under a **Power User** heading in Editor, with Minimal Chrome and a "Set By Power User Mode"
readout nested beneath it, and a one-time offer (a toast after 20 editing days or 50 keyboard shortcuts).

## Why it went

The editor's interface has since been simplified for everyone, so a second, quieter version of it is no longer worth
its weight: two ways for every chrome surface to look, a preset to keep in step with Settings, and an offer to make.
Everyone now gets the same interface, today's default: labelled status bar controls, the role pill in the title bar,
the three-step Appearance control, and More plus the bin in every selection toolbar.

## What happens to stored preferences

- **Everything the preset wrote stays.** A person who had the mode on keeps their alignment guides, auto-attach
  arrows and tours seen, exactly as they are now. Nothing is reverted. The element tours' seen flag
  (`elementToursSeen`) counts every Show Me tour as answered whoever wrote it ([Element tours](element-tours.md)).
  The Pages tour's single flag (`pagesTourSeen`) counted every kind only while the mode was on, and counts none on its
  own (an answer from before the tour split stands for no kind), so for a blob that had the mode on, every page kind
  joins `pagesTourKinds` as it is read ([Pages tour](pages-tour.md)).
- **Minimal chrome turns off.** Nothing reads it any more.
- **The mode's keys are retired.** `powerUserMode`, `powerUserBaseline`, `minimalChrome` and `powerUserOfferShown` are
  dropped on read by `upgradeLegacyPreferences` (`packages/api-schema/src/legacy-preferences.ts`), from the browser's
  copy and the server's alike, so the next write stores the synced blob without them
  ([User preferences](user-preferences.md) "Retired keys"). Nothing is written on load. A blob that still carries them
  loads cleanly, its other settings intact. The offer's device-local counters (`livedesign:power-user-offer:v1` in
  `localStorage`) are left in place and never read.
- **Every app shares two of them.** `powerUserMode` and `minimalChrome` live in the `all` scope every app reads, so the
  write that drops them here drops them for the other apps too: an app that still offers the mode shows it off, with
  every setting as it was.
- **Telemetry.** `PowerUserModeOn`/`Off`, `MinimalChromeOn`/`Off` and the `PowerUserOffer` events are no longer sent,
  and the public dashboard no longer charts them ([Telemetry](../017-telemetry/telemetry.md)).

## Where it is still to go

livediagram and liveplanner have dropped it too; livehuddle and livedocuments follow. Until the last has gone, the
shared pieces stay in `packages/` (`MinimalChromeProvider` in workbench, the `powerUser` rows and preset readout in
settings-ui, the quick switch's helpers in ui), and the Explorer's last Minimal chrome reads
(`components/panels/Explorer.tsx`, `ExplorerHeaderMenu.tsx`, [Explorer structure](../013-workspace/explorer-structure.md))
stay with them: nothing provides the flag any more, so they always read it off. The help article
(User Interface › Power user mode) is retired with a redirect in a later change.
