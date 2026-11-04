// Whether the bottom-right cluster shows the Walk button (docs/specs/008-canvas/avatar-mode.md "The Walk button"): to
// whoever has no palette strip, so no picker to reach Avatar mode from (a Viewer, read-only and without a
// Participant's palette), on a surface that walks (`offered`, off in an embed). An Editor and a Participant have the
// picker. Pure, so the role test reads the same rule CanvasChrome draws from.
export function walkButtonShown({
  offered,
  readOnly,
  participantPalette,
}: {
  offered: boolean;
  readOnly: boolean;
  participantPalette: boolean;
}): boolean {
  return offered && readOnly && !participantPalette;
}
