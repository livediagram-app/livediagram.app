// Test helpers for a PagedCarousel (PagedCarousel.tsx): it mounts only the page on show and its neighbours, so a test
// that reads every tile visits the pages through their dots. Pass the test library's click (fireEvent.click), so a
// click is wrapped as the test's renderer expects.

type Click = (el: Element) => unknown;

/** The carousel's page dots, in order ("<label> page N of M"); none for a single page. */
function dots(label: string, root: ParentNode): Element[] {
  const name = new RegExp(`^${label} page \\d+ of \\d+$`);
  return [...root.querySelectorAll('button[aria-label]')].filter((b) =>
    name.test(b.getAttribute('aria-label') ?? ''),
  );
}

/** Everything `read` finds across every page, in page order, each once. */
export function acrossPages<T>(
  label: string,
  read: () => readonly T[],
  click: Click,
  root: ParentNode = document,
): T[] {
  const seen: T[] = [];
  const add = (items: readonly T[]) => {
    for (const item of items) if (!seen.includes(item)) seen.push(item);
  };
  const count = dots(label, root).length;
  if (count === 0) add(read());
  for (let i = 0; i < count; i++) {
    click(dots(label, root)[i]!);
    add(read());
  }
  return seen;
}

/** The first thing `find` returns on any page, paging through the dots until it shows; null when no page holds it. */
export function onAnyPage<T>(
  label: string,
  find: () => T | null,
  click: Click,
  root: ParentNode = document,
): T | null {
  const here = find();
  if (here !== null) return here;
  const count = dots(label, root).length;
  for (let i = 0; i < count; i++) {
    click(dots(label, root)[i]!);
    const found = find();
    if (found !== null) return found;
  }
  return null;
}
