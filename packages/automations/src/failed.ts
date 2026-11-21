// Automations: a step that cannot be done (liveworkspace/docs/specs/018-automations/automations.md "Steps every app
// has": a failed step stops the run). Thrown where a step is planned or written and caught by the run, which fails
// there with why; `gone` is what the reason names that the item lacks. Pure.

import type { AutomationGone } from './types';

export class Failed<Gone = AutomationGone> extends Error {
  readonly gone: Gone | undefined;
  constructor(reason: string, gone?: Gone) {
    super(reason);
    this.gone = gone;
  }
}
export const fail = <Gone = AutomationGone>(reason: string, gone?: Gone): never => {
  throw new Failed(reason, gone);
};

/** The person a text names: by id (the builder's pick) or by name, any case (an agent's). */
export const personNamed = <P extends { id: string; name: string }>(
  people: readonly P[],
  text: string,
): P | undefined =>
  people.find((x) => x.id === text || x.name.toLowerCase() === text.toLowerCase());

// Every condition, in order, each held by the app's own check: all hold, and their lines.
export function allHold<Condition, Line extends { ok: boolean }>(
  conditions: readonly Condition[],
  holds: (c: Condition) => Line,
): { ok: boolean; lines: Line[] } {
  const lines = conditions.map(holds);
  return { ok: lines.every((l) => l.ok), lines };
}
