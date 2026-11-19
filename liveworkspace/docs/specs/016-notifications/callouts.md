# Callouts

## What

A callout is a note or an error **in place**: inside a panel, a dialog, a form, a Settings row or a page, about
that place. Toasts ([Toasts](./toasts.md)) say that something just happened, anywhere on the page; a callout says
something about what you are looking at, and stays while it holds.

Every callout in every product, the Explorer, Settings and the site is the one shared component, so a refusal in a
livediagram dialog and one in Settings look the same. Before this, about a hundred boxes were each written by hand:
rose and red, at least eight ambers, borders, rings or none, text from 10px to 14px.

## Tones

The toast's four tones, with the same icons and inks:

| Tone        | Means                                                     | Surface                      |
| ----------- | --------------------------------------------------------- | ---------------------------- |
| **Info**    | Something worth knowing here (the Trash keeps 30 days)    | Slate tint, brand icon       |
| **Success** | It worked, said where it happened (a code was resent)     | Emerald tint and icon        |
| **Warning** | It may not do what you expect (a link has lapsed, locked) | Amber tint and icon          |
| **Error**   | It failed, or can't be done (couldn't reach the server)   | Rose tint and icon (not red) |

Each tone has a light and a dark surface, its border a shade of its tint, its text the tone's ink at AA contrast on
that surface in both themes.

## Shape

- A rounded rectangle (8px), a 1px border in the tone, the tone's icon at the start, the message beside it.
- **Two sizes, one scale.** Small (12px text, the default, for panels, dialogs and rows) and Medium (14px, for a page
  or a wide pane). No other sizes.
- **An optional title**, bold, above the message, for a callout with more to say.
- **An optional action**, one text button at the message's end in the tone's ink ("Try Again", "Split Onto a New
  Card"). A second action belongs in the UI around it, not in the callout.
- **Optionally closable**, with a × at the end, where the place lets it go (a paste notice). Most are not: they go
  when what they say stops being true.

## Floating callouts

(Nothing in view was one; it is now a standing toast, [Toasts](./toasts.md) "Timing".)

A few callouts are anchored on the canvas, to a control or an element, not laid in a panel. They keep their anchor
and take the callout's look, on an opaque surface with a shadow so they read over any canvas:

- **Too long for this card** (livedocuments flashcards): warning tone at the card's foot, with **Split Onto a New
  Card** for someone who may change the pages. It sits below the card's last line, not over it.
- **The paste notice** (livediagram): warning tone at the bottom of the canvas after a paste that changed or dropped
  anything, closable, never timing out.

## Where callouts are used

- Errors and notes in dialogs, panels, popovers and forms in every editor (image search, import and export, AI
  panels, calendar feeds, votes, form builders and the rest).
- Settings rows and panels (ErrorNote, webhooks, your data, API tokens).
- The Explorer (list failures, the Trash note, shared lists, approvals).
- The site's account pages.
- A page's locked note in livedocuments' page cog.

## Out of scope

- **Sign-in prompts** (the sign-in banner, the sidebar card, the Settings sign-in card, the site's sign-in page
  notices): they ask for a decision and are their own family.
- **Inline field errors** (a line of rose text under a field) and **Saved / Copied** flashes: not boxes.
- **Status that is not a notice**: a shape's live status badge, livedesign's component edit bar and photo busy pill,
  the empty-canvas card, the colour picker's readability row.
- **Toasts**, banners and state cards, each its own family.

## Keyboard and screen readers

- An error callout that appears in answer to something the person did is announced (`role="alert"`); one present
  from the start is not. Others are plain text, or `role="status"` where they arrive.
- The icon is decorative; the tone is said by the words, never by colour alone.
- Its action and close are ordinary buttons, in the tab order, with the shared focus ring.
