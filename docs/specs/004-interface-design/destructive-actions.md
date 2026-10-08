# Destructive actions

A delete, a trash or a remove is never painted red (or yellow). It looks like any other action in its place:
the same row, tile, icon button or button as its neighbours.

- **Why**: red on every delete made the app look alarmed at its own controls, drew the eye to the one thing the
  person least often wants, and taught that a red control is routine. Most deletes have a way back (the Trash,
  Undo), and the ones that do not ask first.
- **Buttons**: the shared `Button` has no red or yellow variant (`primary`, `secondary`, `ghost` only). A
  confirmation's Delete is the dialog's primary button (`ConfirmDialog`, `ConfirmPopover`, `useConfirm`).
- **Menus**: a Delete or Trash row (`MenuActionRow`), tile (`MenuTile`) or tool button (`MenuToolButton`) is styled
  as the rest of its menu; there is no `danger` flag. It is placed last, after a separator, so it is found on
  purpose (the card panel's ⋯ menu ends in Trash).
- **Toolbars and panels**: the element toolbars' Delete, a row's remove cross, a Trash drop target and the Trash
  count badge use the neutral or brand tones their neighbours use (the Plan Trash badge is grey).
- **Still red**: errors and validation (an invalid field, a failed import, an expired stamp) and states that mean
  something went wrong or is refused (a refused drop); never a control because it deletes.
