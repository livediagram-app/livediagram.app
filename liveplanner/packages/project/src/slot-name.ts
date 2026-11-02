// A Dashboard slot's own name (docs/specs/026-plan/plan-tabs.md "A slot's name"): set on a slot whose heading is made
// for it (a plan view element, a figure from a Sheet, a Form figure), in place of that generated heading. Stored on
// the slot's content, so it travels with what the slot shows and goes when the slot is cleared or refilled.

export const DASHBOARD_SLOT_NAME_MAX = 80;

// The content kinds that may carry a name. An element slot's is offered only for a plan view (slotNameable, in the
// editor); a Board or Sheet element keeps any stored name unread.
const NAMED_TYPES: readonly string[] = ['element', 'sheet-metric', 'form-metric'];

export const isNamedSlotType = (type: string): boolean => NAMED_TYPES.includes(type);

// A name as stored or typed: trimmed, capped, nothing when empty or not a string.
export function readSlotName(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const name = v.trim().slice(0, DASHBOARD_SLOT_NAME_MAX).trim();
  return name || undefined;
}

// The slot's own name, when its content has one.
export function slotNameOf(
  content: { type: string; name?: string } | undefined,
): string | undefined {
  return content && isNamedSlotType(content.type) ? readSlotName(content.name) : undefined;
}

// The content with `name` set (read as stored names are) or, for an empty one, cleared: the slot's generated heading
// again. The same content when nothing changes, and for a kind that takes no name.
export function withSlotName<C extends { type: string; name?: string }>(
  content: C,
  name: string,
): C {
  if (!isNamedSlotType(content.type)) return content;
  const next = readSlotName(name);
  if (next === content.name) return content;
  if (next === undefined) {
    const { name: _gone, ...rest } = content;
    return rest as C;
  }
  return { ...content, name: next };
}
