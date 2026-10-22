# Toasts

Status: shipped

## What

A toast is a short, floating notice that says what just happened or what went wrong, and offers at most a couple of
answers to it. It is the editor and Explorer's one notification surface (`useToast`, `apps/live/hooks/ui/useToast.tsx`):
a failure that would otherwise be silent, a consequential action that would otherwise go unconfirmed ("“Roadmap”
deleted", with Undo), or an offer (power user mode). It never says what is already visible on screen (an element
appearing, a copy button turning into "Copied"), and autosave has its own header pill.

Inline notices that belong to a surface (a dialog's error line, a panel's empty state) are not toasts.

## One line by default

A toast reads as one line: **icon, message, actions, close**, left to right. A short message with its actions
("“Roadmap” deleted", Undo) is a single row, never a card with its button stacked underneath. It wraps only when the
words genuinely do not fit: the message wraps first, and the actions then drop to a row of their own under it, aligned
to the toast's end. The close button stays in the top row's corner, whatever wraps.

The copy is written to fit. A message is one short sentence, or two very short ones: what happened, then what to do
("Couldn't duplicate that document. Try again."). Aim for about 50 characters, so it sits on one line on a laptop with
its actions; never over 90. Filler ("Please", "so your recent changes", a restated reason) is cut first.

- **Messages are sentence case**, ending with a full stop when they are a sentence with advice, and without one when
  they are a bare confirmation ("“Roadmap” deleted", "“Roadmap” moved to “Plans”").
- **Action labels are Title Case** and one or two words ("Undo", "Show", "Try It", "No Thanks"). A label that needs
  more context for a screen reader carries an `ariaLabel` ("Undo: restore “Roadmap”").

## Naming what it acted on

A toast about a document, a folder or a tab names it, so someone who acted on one of several, or on a row that has
scrolled away, can tell which one it was: "“Roadmap” deleted", "“Roadmap” moved to “Plans”", "Could not rename
“Plans”. Try again.", "“Sheet 1” added to “Roadmap”".

- **The name is in curly quotes**, its whitespace collapsed to single spaces.
- **It is cut to 30 characters**, the last one an ellipsis (`TOAST_NAME_MAX`, `apps/live/lib/toast-name.ts`), cut
  between characters so an emoji is never split. Two cut names and the words round them stay under the 90-character
  ceiling; where they would not, the advice is dropped first ("Could not add “Sheet 1” to “Roadmap”.").
- **A blank or unknown name falls back to the generic word**: "Document deleted", "Could not move the document. Try
  again.", "moved to the team library". The surface never shows empty quotes.
- **Where it went is named too**: the folder, or My Documents. A team is named when the surface knows it, else "the
  team library".
- The wording lives in one place per family, so every surface says the same: `apps/live/lib/document-toast-copy.ts`
  (delete, restore, move, duplicate) and `apps/live/lib/write-failure-copy.ts` (a failed folder or document write).

## Tones

Four tones, each with its own icon in its own colour. The surface itself stays neutral, so a stack of mixed tones
reads as one family; the icon says the tone at a glance, and an error or warning also tints the border.

| Tone      | Icon                | For                                                                        | Times out | Announced as        | In-Editor Notifications off |
| --------- | ------------------- | -------------------------------------------------------------------------- | --------- | ------------------- | --------------------------- |
| `info`    | Info circle, brand  | A neutral note, an offer or an action toast                                | 4 s       | `status` (polite)   | Hidden                      |
| `success` | Check circle, green | A consequential action confirmed                                           | 4 s       | `status` (polite)   | Hidden                      |
| `warning` | Triangle, amber     | It worked, but not fully, or only here ("Showing this browser only")       | 6 s       | `status` (polite)   | Still shown                 |
| `error`   | Alert circle, rose  | Something failed and nothing changed, or changes are at risk of not saving | 6 s       | `alert` (assertive) | Still shown                 |

The [In-Editor Notifications](../007-editor/user-preferences.md) setting (`notificationsEnabled`) quiets the chatter, never a problem: warnings
and errors always show.

## Kinds of toast

- **A plain toast** (`toast.info`, `toast.success`, `toast.warning`, `toast.error`) carries a message and times out.
- **An action toast** (`toast.action`) carries a message and one or two buttons, is upserted in place by its `key`
  (so a burst updates one toast rather than stacking), and stays up for the longer answer time (below). An action
  toast replaced with no buttons ("Undone") is a plain info toast from then on and times out by its tone.
- **An offer** (`toast.offer`) asks a question with a confirm and a decline, and stays up for the answer time.
  Closing it is the decline; timing out is neither answer.

The last button is the primary one (the brand-coloured answer: Undo, Try It); any before it are secondary. An offer
lists its decline before its confirm.

## Timing

- A plain toast times out after its tone's time (above).
- **Every toast times out; none stays for good.** One with buttons (an action toast, an offer) stays up for 10 seconds
  (`TOAST_ANSWER_TIMEOUT_MS`), long enough to reach for Undo, and then leaves. What its button offered is still
  reachable elsewhere (a deleted document waits in the Trash, an agent's change in the document's history), so a
  toast that has gone loses nothing. The pause below is how someone who needs longer keeps it (WCAG 2.2.1).
- **Hovering or focusing a toast pauses its timer**, and leaving it resumes with the time it had left, never a fresh
  start, so a toast someone is reading never disappears under them. A hidden page (another browser tab) pauses it too.
- The same message in the same tone, while one is still up, is not shown twice: the toast already up stays.
- **At most three toasts** are up at once, so a burst (a run of deletes, each with its Undo) never covers the
  screen. A fourth retires the oldest one without buttons, or the oldest of all when every one has them.

## Placement

- **Bottom centre.** The newest sits nearest the bottom edge, older ones above it, 8px apart.
- **Desktop and tablet** (from 640px): each toast is as wide as its content, at most 36rem (576px).
- **Phone** (under 640px): each toast spans the screen, 16px in from each side, or clear of a landscape notch
  where that is wider, so it is easy to read and to tap.
- **Clear of the bottom chrome, and of banners.** The stack sits 16px above the bottom edge (clear of the home
  indicator), and above anything that occupies the bottom of the screen beneath it: the editor's tab bar, its
  bottom-right cluster (Undo, Layers, Zoom), the Explorer's bottom bar, and the
  [sign-in banner](../014-identity/sign-in-encouragement.md). It lifts 8px clear of the highest of those that
  overlaps its column, measured as they move or resize, so a toast never lands on a button or on a banner's words.
  Chrome off to the side of the column (the cluster on a wide desktop) does not lift it.
- **Stacking order.** Toasts sit at the top of the stacking ladder (`--z-toast`), over dialogs, so a failure shows
  even while a dialog is open. A banner is a peer of the page, never of the toasts: the toasts stand on the banner,
  and the banner never covers a toast.

## Look

- A white card (slate-900 in dark), a 1px border (slate-200, slate-700 in dark; tinted rose for an error, amber for
  a warning), 12px corners and a soft shadow, a touch deeper in dark so the card lifts off a dark canvas.
- The message is 14px on a 20px line, at least 44px tall in all, so one line of text, a button and the close all
  centre on one line.
- Action buttons are compact text buttons (32px tall, 44px to tap on a touch screen): the primary in the brand
  colour, a secondary in slate, both with a tinted hover.
- The close is a 28px icon button, 44px to tap on a touch screen.

## Motion

Toasts follow [Motion](motion.md): chrome, within the ceiling.

- **Entering**, a toast rises 8px and fades in from 98% scale over `short` (200ms), on the ease-out curve
  `cubic-bezier(0.16, 1, 0.3, 1)` (`toast-in`).
- **Entering a full stack**, a toast that retires an older one pops in instead: it rises 12px and grows from 90%
  with a little overshoot over `long` (250ms, the ceiling; `toast-in-full`), so a new notice on a busy stack is
  plainly new rather than looking like the stack just shuffled.
- **Leaving** (timed out, closed, answered), it fades out and drops 4px over `micro` (150ms, `toast-out`), and is
  removed once that has played (an exit hold, belonging to the animation).
- **Under reduced motion** both collapse to instant, as all motion does.

## Keyboard and screen readers

- The stack is a labelled region ("Notifications"), always mounted, so a toast added to it is announced: an error as
  an `alert`, everything else as a polite `status`. A toast never takes the focus.
- Every button is a real button in the tab order. **Escape**, with the focus inside a toast, closes it (the decline,
  for an offer) without reaching anything behind it.
- The timers pause while a toast holds the focus (above).

## Share roles

Toasts belong to the person who caused them, on their own screen, so they read the same for an Editor, a Participant
and a Viewer. What a toast offers follows the feature behind it: a Viewer never sees an Undo for a change they could
not make, because the feature never raises one for them (each feature's own spec, gated on the session's `can`).

## Out of scope

- The new-version prompt ([New version prompt](../016-platform/new-version-prompt.md)) is its own surface, with its
  own placement. It shares the toast's look (card, border, shadow, corners), not its stack.
- The canvas's screen-reader announcements ([Canvas accessibility](canvas-accessibility.md)) are a separate,
  unconditional live region; a toast is not a substitute for one.
