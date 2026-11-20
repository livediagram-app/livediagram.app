# Toasts

Status: shipped

## What

A toast is a short, floating notice that says what just happened or what went wrong, and offers at most a couple of
answers to it. It is the one notification surface of every editor (livediagram, liveplanner, livedocuments, livedesign,
livehuddle), the Explorer (liveworkspace.app/explorer and the Explorer panel inside an editor) and the Settings panel:
one look, one stack and one list of what was said, from one component (`packages/ui/src/toast`). A failure that would
otherwise be silent, a consequential action that would otherwise go unconfirmed ("“Roadmap” moved to the Trash", with
Undo), an offer, or something about the page that holds until it is dealt with (a new version to reload into, an
account that is not answering).

It never says what is already visible on screen (an element appearing, a copy button turning into "Copied"), and
autosave has its own pill. Inline notices that belong to a surface (a dialog's error line, a panel's empty state) are
not toasts, and neither are the editor's top-centre pills and palette trays (offline, a tool's mode, a held key,
example content): those are part of the editor's chrome.

Each product keeps its own copy rules for naming what a toast acted on (its `docs/specs/004-interface-design/toasts.md`).

## One line by default

A toast reads as one line: **icon, message, actions, close**, left to right. A short message with its action
("“Roadmap” moved to the Trash", Undo) is a single row, never a card with its button stacked underneath. It wraps only
when the words genuinely do not fit: the message wraps first, keeping its buttons beside it while it has at least 10rem
to wrap in (a phone's toast is two lines of text with its button beside them, not a line with the button stranded
under it), and only then do the actions drop to a row of their own under it, aligned to the toast's end. The close button stays in the top row's corner, whatever wraps.

**Every toast keeps one width.** A message that has to sit on one line is written short enough for it, never given a
wider card (the owner, 2026-11-20, of the guest sign-in toast).

The copy is written to fit. A message is one short sentence, or two very short ones: what happened, then what to do
("Couldn't duplicate that canvas. Try again."). Aim for about 50 characters, so it sits on one line on a laptop with
its actions; never over 90. Filler ("Please", "so your recent changes", a restated reason) is cut first.

- **Messages are sentence case**, ending with a full stop when they are a sentence with advice, and without one when
  they are a bare confirmation ("“Roadmap” deleted", "“Roadmap” moved to “Plans”").
- **Action labels are Title Case** and one or two words ("Undo", "Show", "Reload", "Try Again"). A label that needs
  more context for a screen reader carries an `ariaLabel` ("Undo: restore “Roadmap”").

## Tones

Four tones, each with its own icon in its own colour. The surface itself stays neutral, so a stack of mixed tones
reads as one family; the icon says the tone at a glance, and an error or warning also tints the border.

| Tone      | Icon                | For                                                                        | Times out | Announced as        |
| --------- | ------------------- | -------------------------------------------------------------------------- | --------- | ------------------- |
| `info`    | Info circle, brand  | A neutral note, an offer or an action toast                                | 4 s       | `status` (polite)   |
| `success` | Check circle, green | A consequential action confirmed                                           | 4 s       | `status` (polite)   |
| `warning` | Triangle, amber     | It worked, but not fully, or only here ("Showing this browser only")       | 6 s       | `status` (polite)   |
| `error`   | Alert circle, rose  | Something failed and nothing changed, or changes are at risk of not saving | 6 s       | `alert` (assertive) |

## Every toast can be closed, and may carry an action

- **Every toast has a close button** (and Escape, with the focus inside it). Closing an offer is its decline.
  **Closing is dismissing**: the toast fades where it is and leaves the notification list too, so what the person
  sent away does not come back as a row (the owner, 2026-11-19).
- **A toast may carry a primary action** when there is a follow-on step ("Undo" after a move to the Trash, "Reload"
  for a new version, "Try Again" when the account does not answer). Pressing a plain toast's action closes it.
- **An action toast** (`toast.action`) carries a message and one or two buttons and is upserted in place by its `key`,
  so a burst updates one toast rather than stacking ("Webber changed 3 elements", Show and Undo). One replaced with no
  buttons ("Undone") is a plain toast from then on and times out by its tone.
- **An offer** (`toast.offer`) asks a question with a confirm and a decline. Timing out is neither answer.

The last button is the primary one (the brand-coloured answer: Undo, Reload); any before it are secondary.

## Timing

- A plain toast times out after its tone's time (above). One with buttons stays up for 10 seconds
  (`TOAST_ANSWER_TIMEOUT_MS`), long enough to reach for Undo, and then leaves. What its button offered is still
  reachable elsewhere (a deleted canvas waits in the Trash, an agent's change in the history).
- **A standing toast** (`sticky`) says something that stays true until it is dealt with: a new version of the editor
  is ready, the account is not answering, nothing on the tab is in view, a board shows a template's example cards, a
  guest has been editing a while without an account. It
  does not time out: it leaves when it is closed, when its action is
  taken, or when what it says stops being true (the account answers).
- **Nothing in view** (every editor): while everything on the tab has scrolled off screen, a standing info toast says
  **"Nothing in view"** with **Show All**, which fits the tab to the screen as Fit does (the owner, 2026-11-19: a
  toast, not a callout over the zoom cluster). It leaves when something is back in view; closed, it stays away until
  the tab next scrolls out of view.
- **Sign in** (every editor, never the Explorer): about five minutes into a guest's session, a standing, highlighted toast
  says, on one line, "Sign in to get Teams, AI & even more powerful features." with **Sign In**, which goes to the sign-in page and back (the owner, 2026-11-20: the sign-in banner
  became this toast, without its Learn More). Closed, it stays away in that browser; it leaves when the guest signs
  in or zen mode starts. Each product's `docs/specs/014-identity/sign-in-encouragement.md` has the rest.
- **Hovering or focusing a toast pauses its timer**, and leaving it resumes with the time it had left, never a fresh
  start. A hidden page (another browser tab) pauses it too.
- The same message in the same tone, while one is still up, is not shown twice.
- **At most three toasts** are up at once, so a burst never covers the screen. A fourth retires the oldest one without
  buttons, then the oldest that is not standing, then the oldest of all.

## Notifications off

The In-Editor Notifications setting (each product's `docs/specs/007-editor/user-preferences.md`) quiets the chatter,
never a problem and never the record:

- With it off, an `info` or `success` toast, an offer and an action toast do not pop up. Warnings, errors, standing
  toasts and an action toast marked `important` (it explains why something the person did had no effect) still do.
- **A toast that does not pop up still goes into the notification list**, as one the person has not seen, so the
  footer's dot (below) says something arrived.
- The Explorer inside an editor follows the editor's setting. liveworkspace.app's own Explorer has no such setting and
  always shows its toasts.

## The notification list

A toast is easy to miss. Every one is also written to a list the person can open from the footer and read back.

### The footer button

- **A bell icon, with no label**, in the bottom bar, right of Settings: the editor's tab bar (every product) and the
  Explorer's bottom bar on liveworkspace.app. Its accessible name and hover card say "Notifications".
- **A dot on the bell** (brand colour, 8px, top right) when the list holds a toast the person has not seen: one that
  timed out, one retired from a full stack, or one that never popped up because notifications are off. A toast whose
  action the person took counts as seen; one they closed is not in the list at all. Opening the list marks everything in it seen and clears
  the dot. The dot is announced in the button's name ("Notifications, new").

### Collapsing into the bell

- When a toast leaves (timed out, answered, retired from a full stack), it **collapses into the bell**: it
  shrinks and slides towards the bell's centre and fades as it arrives, over `long` (250ms) on the ease-in-out curve,
  so the eye follows where it went. The bell then gives one small pulse (it grows to 115% and back over `short`).
- **A closed toast does not collapse into the bell**: it fades and drops 4px over `micro` where it is, as it is gone
  from the list.
- Where there is no bell on screen (a page without the bottom bar, a presentation, the bar scrolled or hidden), a
  toast leaves as before: it fades and drops 4px over `micro`.
- **Under reduced motion** (the system setting or the app's Reduce Motion), a toast fades out where it is and the bell
  does not pulse.

### The popover

- Pressing the bell opens a popover above it (on a phone, a sheet from the bottom edge), 360px wide, headed
  "Notifications", with **Clear** at the header's end.
- **Every toast received**, newest first: its tone icon, its message as it last read (an action toast updated in place
  is listed once, in its final words), and how long ago ("2 min ago"). The list scrolls past about seven rows.
- **The list is read-only.** It is a record of what was said, not a second place to act: no Undo, Reload or other
  button in it. What a toast offered is reachable from its feature (the Trash, the history, a reload).
- **Empty**, it says "No notifications yet" and "Toasts you receive here are kept in this list.".
- Opening it sends every toast still on screen into the bell, as seen: each is already a row in the list, and on a
  phone the sheet would sit beneath them. A standing toast stays, its action still live, and so does an offer, which
  waits on an answer.
- Escape or a press outside closes it and hands the focus back to the bell.

### What is kept

- **Kept in this browser, per document**: each editor document has its own list, the Explorer one of its own (all its
  pages share it). It survives a reload and a closed tab; it never leaves the browser and is not synced to the
  account.
- **The last 50 toasts** per list; older ones drop off. At most 20 lists are kept; opening a 21st forgets the one used
  least recently.
- **Clear** empties the current list and closes the popover, focus back on the bell.

## Placement

- **Bottom centre.** The newest sits nearest the bottom edge, older ones above it, 8px apart.
- **Desktop and tablet** (from 640px): each toast is as wide as its content, at most 36rem (576px).
- **Phone** (under 640px): each toast spans the screen, 16px in from each side, or clear of a landscape notch where
  that is wider.
- **Clear of the bottom chrome, and of banners.** The stack sits 16px above the bottom edge (clear of the home
  indicator), and above anything that occupies the bottom of the screen beneath it: the editor's tab bar, its
  bottom-right cluster and the whiteboard dock, and the Explorer's bottom bar. It lifts 8px clear
  of the highest of those that overlaps its column, measured as they move or resize. A popover opened up from that
  chrome (the Session strip's Timer and Vote, Layers) is a floor too while it is open, so a standing toast never covers
  the tool just opened (a phone's example cards toast sat over the Timer's Start).
  A template start's foot row (its Save switch) is a floor on a phone only, where the start is a bottom sheet; from
  640px the start is a centred dialog, and standing on its foot row lifted the toast onto the dialog, off the Undo
  row (the owner, 2026-11-20).
- **On the bottom-right cluster's line on desktop.** From 640px the stack's bottom is level with the canvas's
  bottom-right cluster (Undo, Redo, Tidy, Layers, Style, Zoom), so a toast and Undo read as one row (the owner,
  2026-11-20: a centred toast 8px lower looked out of line). Where the cluster would sit beneath the centred stack, the
  stack's right edge stands 8px left of Undo, the toasts aligned to that edge; where it leaves the centre clear, the
  stack stays centred. On a phone the cluster is a floor like the
  rest.
- **Stacking order.** Toasts sit at the top of the stacking ladder (`--z-toast`), over dialogs, so a failure shows even
  while a dialog is open.
- **One stack per page.** A page has one toast stack and one list: the Explorer panel inside an editor raises its
  toasts into the editor's stack, never a second one.

## Look

- A white card (slate-900 in dark), a 1px border (slate-200, slate-700 in dark; tinted rose for an error, amber for a
  warning), 12px corners and a soft shadow, a touch deeper in dark so the card lifts off a dark canvas.
- The message is 14px on a 20px line, at least 44px tall in all.
- Action buttons are compact text buttons (32px tall, 44px to tap on a touch screen): the primary in the brand colour,
  a secondary in slate.
- The close is a 32px icon button, 44px to tap on a touch screen.

**Highlight** (`highlight`, an action toast's option): a solid emerald card (emerald-700, emerald-800 in dark
mode) with white text, a sparkle in place of the tone's icon, a white primary button and a light close. It is for
the rare toast that has to be noticed, today only the guest sign-in toast (the owner, 2026-11-20: "color it so
people notice it, maybe green"). White reads at 5.5:1 on emerald-700 and 7.7:1 on emerald-800, and the primary's
emerald-800 label at 7.7:1 on white. In forced colours the fill drops and the border stays.

## Motion

Toasts follow each product's Motion spec (`docs/specs/004-interface-design/motion.md`): chrome, within the ceiling.

- **Entering**, a toast rises 8px and fades in from 98% scale over `short` (200ms) (`toast-in`).
- **Entering a full stack**, a toast that retires an older one pops in instead, from 90% with a little overshoot over
  `long` (250ms; `toast-in-full`).
- **Leaving**, it collapses into the bell (above), or fades and drops 4px over `micro` where there is none.

## Keyboard and screen readers

- The stack is a labelled region ("Notifications"), always mounted, so a toast added to it is announced: an error as an
  `alert`, everything else as a polite `status`. A toast never takes the focus.
- Every button is a real button in the tab order. **Escape**, with the focus inside a toast, closes it without
  reaching anything behind it.
- The bell is a button with `aria-haspopup="dialog"` and `aria-expanded`; the popover is a labelled dialog, its list a
  plain list.

## Share roles

Toasts belong to the person who caused them, on their own screen, so they read the same for an Editor, a Participant
and a Viewer. What a toast offers follows the feature behind it: a Viewer never sees an Undo for a change they could
not make, because the feature never raises one for them.

## Out of scope

- The paste notice (livediagram's board scenes) keeps its own surface beside the pasted content.
- The canvas's screen-reader announcements are a separate, unconditional live region; a toast is not a substitute.
- The editor's top-centre pills and palette trays, as above.
