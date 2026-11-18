// The Editing Mode button's modes (liveworkspace/docs/specs/004-index/footer-tools-menu.md "The Editing Mode button"):
// the share roles a person may preview, from their real role down, in one order every app keeps.

/** A session's access level, as each app's api-schema names it. */
export type EditingModeRole = 'edit' | 'participate' | 'view';

/** Every mode, widest first: Editor, Participant, Viewer. */
export const EDITING_MODES: readonly EditingModeRole[] = ['edit', 'participate', 'view'];

/** The modes someone whose real role is `real` may preview: the app's `offered` ones from `real` down, widest first.
 *  A role the app does not offer (a legacy Viewer in livehuddle) has its own mode alone. */
export function editingModes<R extends EditingModeRole>(
  real: R,
  offered: readonly R[] = EDITING_MODES as readonly R[],
): R[] {
  const from = EDITING_MODES.indexOf(real);
  const modes = offered.filter((m) => EDITING_MODES.indexOf(m) >= from);
  return modes.includes(real) ? modes : [real];
}

/** The mode a press moves to: the next in `modes`, wrapping round to the first; null with nothing to switch to. A
 *  mode outside `modes` steps to the first. */
export function nextEditingMode<R extends EditingModeRole>(mode: R, modes: readonly R[]): R | null {
  if (modes.length < 2) return null;
  const at = modes.indexOf(mode);
  return modes[(at + 1) % modes.length] as R;
}
