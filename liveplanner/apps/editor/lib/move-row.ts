/** `list` with the item at `from` moved to `to`; the same list when `to` is out of range. Used wherever rows reorder
 *  (the web components' and concept graphics' row editors, the chevrons' on-canvas bar). */
export function moveRow<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
