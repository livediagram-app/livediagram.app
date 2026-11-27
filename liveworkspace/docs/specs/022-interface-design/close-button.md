# The close button

Every modal and every drawer in every app closes with one button: an X in a 44 px circle at the right of its header,
the one the phone's Apps drawer had first ([phone-apps-drawer.md](../011-workbench/phone-apps-drawer.md)). It is the
same size on a phone and a desktop (owner, Work Tracker 1511): it reads as a button at a glance, and a thumb or a
pointer finds it without aiming.

## What it looks like

- **The circle.** 44 x 44 px, fully round, an 18 px X in its middle. Its well is a faint ink, not a flat grey: on
  white it is the drawer's light slate, on a tinted band (the dialog hero header's, the start panel's) it takes the
  band's hue, and in dark mode it is a faint white. Hover deepens the well a step, a press a step more; a keyboard's
  focus draws the brand ring around it.
- **Over a dark bar** (a video's, livehuddle's Screen), the same circle in white on a faint white well.
- **Its name.** "Close", or what it closes where the header says more ("Close Version History", "Close navigation").
  Its tooltip says the same name, after the usual hover delay, never on touch.
- **Where it sits.** Last in the header's row, after the dialog's own controls (Help, a primary button). It centres
  on the title's line without making the header taller: a header's row pulls it up and down by the difference.
- **In a phone sheet** it closes the way a swipe does: the sheet slides out, then the dialog is gone.
- **Inside Tools** ([footer-tools-menu.md](../004-index/footer-tools-menu.md)) a dialog drawn in Tools' body shows no
  close of its own: Tools' band backs out of it.

## What wears it

Every modal (a dialog over a dimmed page or canvas, a full-screen panel like Version History) and every drawer (the
Apps drawer, the Explorer's phone sections, the help centre's article navigation) on a phone and a desktop:

- the dialog hero header ([dialog-hero-header.md](../004-index/dialog-hero-header.md)) and the plain dialog header;
- the Settings, Automations, Upgrade, Tools and Get Started headers;
- the start panel where it can be closed, beside its Help;
- the visitor name prompt, the reader (livehuddle), Assign an Action and Chart Data (liveknowledge), the telemetry
  site's stack modal.

## What keeps its own

These are not modals or drawers, and keep the small close that suits them:

- **Popovers** anchored to what opened them: a comment thread, an action, a presentation's element details, Page Info,
  Add a Widget, a page's Layouts. A popover is a light thing over its anchor; a 44 px circle would outweigh it.
- **Search fields' Esc key**: the command search's close is the key that closes it, inside the field's row.
- **Bars and cards in place**: find bars, the Side by Side seam, the prototype bar, the Cited by Ask bar, the
  empty-canvas card, the photo start card, toasts, callouts and notices (their **Dismiss**).
- **A dimmed backdrop**, which closes on a press but is not a button in the header.

A guard fails a file that draws a modal or a drawer and types its own close, so a new one wears this button.
