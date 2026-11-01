// A resync's fetched tab with this editor's unsaved edits put back on top (docs/specs/012-collaboration/
// resync-without-reload.md "Fault 2"). A resync re-reads a tab because ops were missed, but what was edited
// here and not yet saved (offline, or inside the debounce) is not on the server: overwriting with the fetched
// copy threw it away. Each element changed, added or deleted here since the last save (judged against the save
// baseline, by content, since a peer's op makes new objects on both sides) is applied to the fetched elements; so
// is each tab field changed here. The baseline then moves to the fetched copy, so the next save sends exactly
// these edits. Pure.
import type { Element, Tab } from '@livediagram/document';

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function rebaseLocalEdits(fetched: Tab, screen: Tab, baseline: Tab | undefined): Tab {
  if (!baseline) return fetched;
  const baseById = new Map(baseline.elements.map((e) => [e.id, e] as const));
  const screenIds = new Set(screen.elements.map((e) => e.id));
  const changed = new Map<string, Element>();
  const added: Element[] = [];
  for (const el of screen.elements) {
    const was = baseById.get(el.id);
    if (!was) added.push(el);
    else if (!same(was, el)) changed.set(el.id, el);
  }
  const deleted = new Set(baseline.elements.filter((e) => !screenIds.has(e.id)).map((e) => e.id));
  const fields: Partial<Tab> = {};
  // A field cleared here is a field the screen no longer has (a tab look reset deletes its font, an
  // ended vote or timer is dropped), so the keys come from both sides: one only the baseline holds
  // is an edit too, and the fetched copy must lose it.
  const cleared: (keyof Tab)[] = [];
  const keys = new Set([...Object.keys(screen), ...Object.keys(baseline)] as (keyof Tab)[]);
  for (const key of keys) {
    if (key === 'elements') continue;
    if (same(screen[key], baseline[key])) continue;
    if (key in screen) Object.assign(fields, { [key]: screen[key] });
    else cleared.push(key);
  }
  if (
    changed.size === 0 &&
    added.length === 0 &&
    deleted.size === 0 &&
    Object.keys(fields).length === 0 &&
    cleared.length === 0
  )
    return fetched;
  const fetchedIds = new Set(fetched.elements.map((e) => e.id));
  const elements = [
    ...fetched.elements.filter((e) => !deleted.has(e.id)).map((e) => changed.get(e.id) ?? e),
    ...added.filter((e) => !fetchedIds.has(e.id)),
  ];
  const out: Tab = { ...fetched, ...fields, elements };
  for (const key of cleared) delete out[key];
  return out;
}
