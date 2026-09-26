# Tooltips, hover cards and popovers

Status: shipped

## What

Three kinds of floating content sit beside a control. Each has one name, and the name means one thing
in code, copy and specs.

| Concept        | Carries                                  | Opens                                                  | Interactive |
| -------------- | ---------------------------------------- | ------------------------------------------------------ | ----------- |
| **Tooltip**    | The control's name, and nothing else     | After a **1 s** hover; **instantly** on keyboard focus | No          |
| **Hover card** | A bold title over a one-line description | **Instantly** on hover and on keyboard focus           | No          |
| **Popover**    | Controls: menus, pickers, forms          | On click or tap                                        | Yes         |

Tooltips and hover cards are the two kinds of **hint**: content that appears because a control was
hovered or focused, and that goes away when it no longer is. A popover is not a hint. It opens because
someone asked for it, it takes clicks, and it stays until it is closed.

A hint never holds a control. Anything someone has to press lives in a popover or on the page.

## Which one

- **Tooltip** when the only thing to say is what the control is called. An icon button, a swatch, a
  palette tile whose caption is shortened or hidden, text cut short by an ellipsis. The tooltip says
  the name the control already carries for assistive technology.
- **Hover card** when the control needs explaining: what the action does, why it is disabled, what a
  badge means, a shortcut. The title names; the description explains.
- **Popover** when the floating content has anything to press.

A control has at most one hint. If a hover card is present, it carries the name too, as its title.

## Tooltip

- **Opens after a 1 s hover.** A pointer passing over a toolbar on its way somewhere else does not
  light it up. A pointer resting on a control is asking what it is.
- **Warm-up.** Once a tooltip has opened, the next one opens at once while the pointer moves along a
  row of controls, for as long as it arrives within **500 ms** of the last tooltip closing. Scanning a
  toolbar reads each name without paying the second each time.
- **Opens instantly on keyboard focus.** Focus that is not keyboard-visible (a click, a dialog
  focusing its first control) does not open it.
- **The name only**, on one line where it fits, in the interface's small text. It may wrap; it never
  truncates.
- **Inverse pill.** A dark pill with light text (slate 900 on light pages, slate 700 on dark), with a
  small pointer towards the control. It reads apart from the white hover card, so the two are never
  confused.
- **Never the only carrier of meaning.** The control keeps an accessible name, from its visible text
  or its `aria-label`, and the tooltip says the same words. On non-interactive text, such as a clipped
  name or a figure, the same words are in the document as visually hidden text.

## Hover card

- **Opens instantly** on hover and on keyboard-visible focus. It is chosen where the explanation is
  wanted at once: a control whose purpose is not obvious from its glyph.
- **A bold title over a one-line description.** The description may run to two or three short lines.
- **White card** on light pages, slate 800 on dark, with a border, a soft shadow and a pointer.
- Hover cards are not part of the tooltip warm-up; they have no delay to skip.

## Behaviour shared by both hints

These meet WCAG 2.2 AA, including 1.4.13 Content on Hover or Focus.

- **Dismissible.** Escape closes an open hint without moving the pointer or focus. The keypress is not
  consumed: a menu or dialog listening for Escape closes on the same press. A dismissed hint stays
  closed until the pointer leaves and returns, or focus leaves and returns.
- **Hoverable.** The pointer can move from the control onto the hint without it closing. A short grace
  period covers the gap between the two. Leaving both closes it.
- **Persistent.** A hint stays open while the pointer is over the control or the hint, or while the
  control has keyboard focus. It has no timeout.
- **Pressing closes it.** A press on the control closes its hint and cancels a pending one, so a click
  never leaves a name hanging over the menu it opened.
- **One at a time.** Opening a hint closes any other.
- **No layout shift.** A hint floats in a layer above the page. Showing it moves nothing.
- **Placement.** Above the control by preference; below, right or left when there is no room, kept
  inside the viewport. The pointer tracks the control's centre when the hint slides to stay on screen.
- **Motion.** A hint fades in as a small fade (see [Motion](./motion.md)), and not at all under reduced
  motion. The 1 s wait before a tooltip is an intent timer, not motion, and does not count against the
  motion budget.
- **Dark-aware.** Both follow the app's appearance, not the operating system's native tooltip style.

## Touch

Touch has no hover. A **long press** (500 ms, the editor's long-press length) on a control shows its
hint when **no other label is visible**: an icon button with no text, a palette tile whose caption is
hidden. A control that shows its own text needs no hint on touch, and its long press is left alone.

- The hint shows while the finger stays down and lingers **1.5 s** after it lifts.
- A long press that showed a hint does not also press the control.
- Moving the finger more than 10 px before the hint shows cancels it, so drags and scrolls are
  untouched.
- A tap never shows a hint.

## Native `title`

The browser's own `title` tooltip is not used for hints. It waits on the browser's own timer, never
appears on keyboard focus or touch, cannot be dismissed, and ignores dark mode. Every hint is a
Tooltip or a hover card.

`title` stays only where it is not a hint:

- `<iframe title>`: the frame's accessible name, required by WCAG 4.1.2.
- `<abbr title>`: the expansion of an abbreviation.
- SVG `<title>` inside exported or standalone SVG documents: the image's accessible name.

A lint rule rejects `title` on any other element, so the exceptions stay the exceptions.

## Telemetry

None. Hints change no one's workflow, and hovering is not an action worth counting.

## Where it lives

- `@livediagram/ui` owns `Tooltip` and `HoverCard`, used by every app.
- The shared lint config (`@livediagram/eslint-config`) holds the native-`title` rule.
- Popovers keep their own homes (`packages/ui` popover positioning, the editor's menus and pickers);
  this spec only fixes what the word means.
