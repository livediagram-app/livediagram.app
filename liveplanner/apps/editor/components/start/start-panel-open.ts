// When a start panel last left the screen (docs/specs/007-editor/start-panel.md): one mounting within SWAP_MS of it is
// the same panel arriving again, and turns in place rather than flying up again (StartPanel). The tours never wait
// on the panel: it shows only on an empty tab, where no tour has a subject (docs/specs/026-plan/plan-tour.md).
const SWAP_MS = 400;
let leftAt = -Infinity;

export function noteStartPanelLeft(): void {
  leftAt = performance.now();
}

export function startPanelJustLeft(): boolean {
  return performance.now() - leftAt < SWAP_MS;
}
