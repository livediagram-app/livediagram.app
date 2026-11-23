# Toasts

## What

A toast is a short, floating notice that says what just happened or what went wrong. Every editor, the Explorer and
Settings share one toast, its footer bell and its notification list:
[Toasts](../../../../liveworkspace/docs/specs/016-notifications/toasts.md) is the spec for its look, tones, timing, the
close and the one action every toast may carry, standing toasts, the In-Editor Notifications setting and the list. In
the editor it is `useToast` (`apps/editor/hooks/ui/useToast.tsx`, the workbench's provider).

This page keeps livedocuments's own copy rules.

## Naming what it acted on

A toast about a document, a folder or a tab names it, so someone who acted on one of several, or on a row that has
scrolled away, can tell which one it was: "“Roadmap” deleted", "“Roadmap” moved to “Plans”", "Could not rename
“Plans”. Try again.", "“Slides” added to “Roadmap”".

- **The name is in curly quotes**, its whitespace collapsed to single spaces.
- **It is cut to 30 characters**, the last one an ellipsis (`TOAST_NAME_MAX`, `../packages/workbench/src/lib/toast-name.ts`), cut
  between characters so an emoji is never split. Two cut names and the words round them stay under the 90-character
  ceiling; where they would not, the advice is dropped first ("Could not add “Slides” to “Roadmap”.").
- **A blank or unknown name falls back to the generic word**: "Document deleted", "Could not move the document. Try
  again.", "moved to the team library". The surface never shows empty quotes.
- **A page is named too**: its own name in quotes, else where it stands ("Split Page 2 into 3 pages. Undo puts it
  back.", "“Cover” is locked. Unlock it to change its background.").
- **Every toast says what it was about**, because the notification list shows it later with no screen round it:
  "Couldn’t save “Roadmap”. Check your connection.", never "Couldn’t save."; with no name in reach it names the kind
  of thing ("this document", "the tab").
- **Where it went is named too**: the folder, or My Work. A team is named when the surface knows it, else "the
  team library".
- The wording lives in one place per family, so every surface says the same: `apps/editor/lib/write-failure-copy.ts`
  (a failed document write). The Explorer's toasts (delete, restore, move, duplicate, a failed folder write) are the
  shared Explorer's (`@liveworkspace/explorer`).
