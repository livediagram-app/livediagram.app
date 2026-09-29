# Power user mode

Status: shipped

## What

**Power user mode** is a user preference for people who already know the editor. Switching it on applies a **preset**
of recommended settings once, and unlocks settings that only make sense for someone who no longer needs the interface
explained, the first being **Minimal chrome**.

It is a preference like any other ([User preferences](user-preferences.md)): stored in the synced preferences blob,
flipped from its row in Settings, and it follows the account across devices.

## The preset

Switching the mode **on** writes these values, once:

| Setting              | Preference key       | Value     |
| -------------------- | -------------------- | --------- |
| Panel layout         | `panelLayout`        | `toolbar` |
| Alignment guides     | `alignmentGuides`    | on        |
| Auto-attach arrows   | `autoRebindArrows`   | on        |
| Welcome tour         | `tourSeen`           | seen      |
| AI suggested prompts | `aiSuggestedPrompts` | off       |
| Minimal chrome       | `minimalChrome`      | on        |

Panel opacity is not part of the preset. Motion is not part of the mode: every transition is snappy for everyone
([Motion](../004-interface-design/motion.md)).

- **A preset, not a lock.** After switching on, the user may change any of these settings, and the mode stays on.
  Nothing re-applies the preset while the mode is on.
- **Switching off restores what the user did not touch.** For each preset setting, if its value is still the one the
  preset wrote, it goes back to the value it had before the mode was switched on (including "never set", which clears
  the key). A setting the user changed while the mode was on keeps their change.
- **What is stored.** Switching on records, per preset setting, the value before and the value written
  (`powerUserBaseline`). "Did the user change it?" is answered by comparing the current value with the value written,
  so it holds whichever surface made the change (Settings, the tour's layout picker, another device). A setting changed
  and then changed back to the preset's value counts as untouched.
- **One setting can span several keys.** The panel layout writes `panelLayout` and its legacy mirror `minimalPanels`
  together ([Toolbar layout](toolbar-layout.md)); they are compared and restored together, so the two never disagree.
- **Switching on while already on does nothing**, and switching off while off does nothing. Switching on again after
  switching off records a fresh baseline.

## Power-user-only settings

Settings that exist only for the mode are **visible only while the mode is on**: in Settings their rows are absent,
not disabled, and settings search does not find them. While the mode is off they have no effect, whatever their
stored value.

### In Settings

The mode's row sits in Editor, under a **Power User** heading. While the mode is on, its **children** follow it
directly, indented beneath it as one group named "Power User Mode settings":

1. The power-user-only settings: **Minimal Chrome**.
2. **Set By Power User Mode**: a readout of the preset, one line per preset setting other than Minimal chrome (Panel
   Layout, Alignment Guides, Auto-Attach Arrows, Show Welcome Tour, Suggested Prompts), each with its current value
   and the category it lives in. Each is still changed in its own row, and a **Change** button on the line goes to
   that row, ringed. A line whose value the user has changed since switching on says so ("Changed: kept when you
   switch off"); the others read "Restored when you switch off". With no baseline to restore from (the mode was switched on by a client that recorded none), the lines make no promise
   about switching off. A setting whose row is not offered here (Suggested
   Prompts without AI) shows its value without the button.

With the mode off the group is absent. Keyboard order follows the visual order: the mode's switch, then the group.
While searching, a child that matches shows on its own, like any other row.

### Minimal chrome

On by default when the mode switches on (the preset writes it). Minimal chrome removes words and hints that teach
the interface, and leaves the controls:

- **Selection kind chip.** The caption above the selection toolbar ("Selected Arrow", "Selected Square", "Selected
  Elements (3)") is hidden.
- **Palette tile captions.** Palette tiles show their icon only.
- **Status bar text.** The bottom bar's Search, Settings and appearance controls show their icons only.
- **The "Tabs" label** before the tab pills is hidden.
- **Panel titles and help buttons.** Floating panels (Explorer, Palette, Map, Layers, Activity, ...) hide their
  header title and their `?` help button. A panel with a `⋯` menu gains a **Help** row there, opening the same
  article. The Explorer is the one panel with a `⋯` menu today. A panel without one simply drops its `?`: no menu is
  added to hold it, and the help centre stays one click away in the header's **Editor** menu.
- **Onboarding notices and hints.** The modifier-key hint banner, the Explorer's sign-in / "saved to this browser"
  notice, and the match-theme nudge are not shown.
- **The bin** (Delete) in the selection toolbars, on desktop. Touch devices keep it: they have no Delete key.
- **The role pill** leaves the title bar ([Live app](live-app.md#role-pill)) and becomes an icon, **first** in the
  bottom-left of the status bar: a pencil while editing, an eye while viewing. Its Tooltip reads "Editing" or
  "Viewing (read-only)". Whoever may toggle the pill may toggle the icon, the same way.

Kept as they are:

- Keyboard shortcut hints inside hover cards and tooltips.
- Every control. Minimal chrome hides words, not abilities.
- The empty-canvas banner ("Tab 1 is empty"): it holds actions (Help, Quick Start), so it is a control, not a hint.

#### Accessibility of hidden labels

Minimal chrome meets WCAG 2.2 AA:

- **Controls keep their accessible names.** A hidden caption was never the only name: each control keeps its
  `aria-label` or equivalent.
- **The words come back on hover and focus.** A control whose visible label is hidden shows it through its hint: its
  hover card where it already has one (the hover card's title is the name), otherwise a Tooltip (1 s hover, instant on
  keyboard focus, long press on touch), per [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md).
  Palette tiles use a Tooltip.
- **Non-interactive labels stay in the document.** A panel title keeps its text as visually hidden text; the selection
  toolbar names itself with the kind (`role="toolbar"`, `aria-label` "Selected Square"); the "Tabs" label was never
  announced (the tab strip carries its own names).
- **No layout shift.** Hiding happens at render, from the preference, never after paint: nothing moves on its own.
  Flipping the setting re-lays the chrome once, as the direct result of the click.

#### One flag, many consumers

Minimal chrome is exposed as **one flag** that any chrome surface reads (`useMinimalChrome()`), true only while the mode
is on and Minimal chrome is on. A surface decides for itself what it hides, within the rule above: words and hints go,
controls stay.

Other consumers:

- The **quick style panel** ([Quick style panel](../008-canvas/quick-style-panel.md)) drops its docked header (whose
  title and help button Minimal chrome would hide) but **keeps its section titles**: they name what each row changes,
  and two rows of coloured squares are otherwise indistinguishable at a glance. Words that teach go; words that name
  what a control changes stay.

## Discovery: the offer

The mode is offered **once**, ever, to people whose use suggests they would want it.

- **When.** After **20 editing sessions on separate days**, or after **50 keyboard shortcuts** used, whichever comes
  first. An editing session is opening a document you can edit; a day is a local calendar day, and a day counts once
  however many documents are opened on it. A keyboard shortcut is a key press the editor's shortcut handler acts on
  (Delete, V, Cmd-Z, ...).
- **Where the counting lives.** The counts are device-local and never synced: they describe how this device is used,
  and syncing a keystroke counter would cost a write per shortcut. Whether the offer has been made is synced, so it is
  made once per account, not once per device.
- **What.** A toast, in the editor's toast stack: "Try power user mode" and "No thanks", with a short line saying what
  it does. It stays until answered: it does not time out.
- **Never again, either way.** The offer is marked as made the moment it shows. Accepting switches the mode on (the
  preset applies). "No thanks", and closing it, change nothing else.
- **Not offered** when the mode is already on, in a view-only or embedded session, in Zen mode, or when in-editor
  notifications are off ([User preferences](user-preferences.md)): the offer is an in-editor notification, and "a
  quieter editor" includes it.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md):

| Moment                                 | Event                                      |
| -------------------------------------- | ------------------------------------------ |
| Mode switched on / off (any surface)   | `UI` / `Toggled` / `PowerUserModeOn`/`Off` |
| Minimal chrome switched on / off       | `UI` / `Toggled` / `MinimalChromeOn`/`Off` |
| Offer shown                            | `UI` / `Opened` / `PowerUserOffer`         |
| Offer accepted                         | `UI` / `Used` / `PowerUserOffer`           |
| Offer dismissed ("No thanks" or close) | `UI` / `Declined` / `PowerUserOffer`       |

Accepting the offer also emits `PowerUserModeOn`, so the mode's series counts every switch-on and the offer's series is
the funnel.

## Help

The help centre explains the mode and Minimal chrome in **Power user mode** under User Interface, linked from the
Settings row.
