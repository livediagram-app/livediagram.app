# Busy buttons

A button that starts work it has to wait for (a request, an upload, a sign-in hand-off) shows that it is busy
without letting go of the keyboard. There is one way to do it, the shared `Button`'s `busy` flag, in every app,
every package and liveworkspace.app.

- **Why**: a focused button that turns `disabled` loses focus, and browsers drop it to the page body. The
  keyboard or screen reader user who pressed Save, Allow or Join is then at the top of the page (or outside the
  dialog altogether), and an error that appears beside the button is nowhere near them. A button unmounted while
  it works does the same.
- **While busy** the button stays in the tab order and keeps focus. It is `aria-disabled="true"` and
  `aria-busy="true"`, looks disabled (the same `cursor-not-allowed` and half opacity as `disabled`), and ignores
  a press: a click, Enter or Space does nothing, and a submit button does not submit its form (so Enter in a
  field cannot send it twice either). Its label may say what it is doing ("Saving…", "Joining…").
- **`disabled` is for a button that cannot run yet** because of what the form or page lacks (no events chosen,
  an empty name). Busy and not-ready are separate: `disabled={!ready} busy={saving}`, never
  `disabled={saving}`.
- **When the work ends** the button is pressable again where it stands. If the work replaces the button (Turn On
  Link becomes the link and Copy, a form becomes the secret it made), focus moves to what took its place rather
  than falling to the page.
- **Every look**: a button styled from the shared variants, or one whose look is its own class string (the
  site's round buttons, a dialog's custom footer), renders through `Button`; the latter passes `variant="none"`
  and keeps its classes.
- **Not this**: a control that is off because of a setting or a role (a Viewer's Edit, a toggle mid-save that is
  not the focused control) keeps whatever its own spec says. A button the page swaps for a status line on success
  (a sign-in form that becomes "Check your email") still uses `busy` for the wait.
