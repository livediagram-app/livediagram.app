# Toasts blueprint

Derived from [Toasts](../toasts.md). Implementation detail only; the spec decides.

The toast, its queue, stack, card, timer, floor, motion, the footer's bell and the notification list are shared:
[the Toasts blueprint](../../../../../liveworkspace/docs/specs/016-notifications/blueprints/toasts.md)
(`../packages/ui/src/toast`). What stays here is livedesign's naming of what a toast acted on.

## Toast names

A document, folder or tab name as a toast shows it is `toastName(name)` in `../packages/workbench/src/lib/toast-name.ts`:
whitespace collapsed, trimmed, cut by code point to `TOAST_NAME_MAX` (30) with the last kept character an ellipsis,
wrapped in `“` `”`; `null` for a blank name, and the caller substitutes its generic word.

## Testing

| Rule                                                      | Test                               |
| --------------------------------------------------------- | ---------------------------------- |
| Names quoted, cut, fallen back; copy stays under 90 chars | `apps/live/lib/toast-name.test.ts` |
