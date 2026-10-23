// What the AI panel sends as context (docs/specs/007-editor/ai-assistance.md): the whole tab, so the model sees
// the selection in place. A tab over the api's element cap (AI_MAX_ELEMENTS) used to be refused outright, even
// for a small selection; the selection alone goes then, and only a selection that is itself too big is refused,
// with a message saying so rather than "Something went wrong".

import { AI_MAX_ELEMENTS } from '@livedesign/api-schema';
import type { Element } from '@livedesign/design';

type AiContext = { ok: true; elements: Element[] } | { ok: false; message: string };

export function aiContextElements(
  all: readonly Element[],
  focusIds: readonly string[],
  max = AI_MAX_ELEMENTS,
): AiContext {
  if (all.length <= max) return { ok: true, elements: [...all] };
  const focus = new Set(focusIds);
  const selected = all.filter((el) => focus.has(el.id));
  if (selected.length > 0 && selected.length <= max) return { ok: true, elements: selected };
  return {
    ok: false,
    message:
      selected.length > 0
        ? `The assistant works on up to ${max} elements at a time. Select fewer and try again.`
        : `This tab has more than ${max} elements. Select up to ${max} and try again.`,
  };
}
