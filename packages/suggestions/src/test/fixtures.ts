// A toy element union and model for the package's tests: an id, a type and a position.
import type { SuggestionModel } from '../plan';
import type { CanvasSuggestion, SuggestionOp } from '../suggestion';

export type El = { id: string; type: string; x?: number; text?: string };

export const el = (id: string, x = 0, extra: Partial<El> = {}): El => ({
  id,
  type: 'box',
  x,
  ...extra,
});

export function applyOps(elements: El[], ops: SuggestionOp<El>[]): El[] {
  let next = [...elements];
  for (const op of ops) {
    if (op.kind === 'remove') next = next.filter((e) => e.id !== op.id);
    else if (op.kind === 'update')
      next = next.map((e) => (e.id === op.element.id ? op.element : e));
    else next.splice(Math.min(op.at, next.length), 0, op.element);
  }
  return next;
}

export const model: SuggestionModel<El> = {
  fingerprint: (e) => JSON.stringify(e),
  apply: applyOps,
};

export const parseEl = (v: unknown): El | null => {
  const e = v as El | null;
  return e && typeof e === 'object' && typeof e.id === 'string' && e.type === 'box' ? e : null;
};

export const author = { key: 'k_ana', name: 'Ana', color: '#ff0000' };

export function suggestion(
  id: string,
  ops: SuggestionOp<El>[],
  base: Record<string, string | null>,
  extra: Partial<CanvasSuggestion<El>> = {},
): CanvasSuggestion<El> {
  return { id, tabId: 't1', author, createdAt: 1, ops, base, ...extra };
}
