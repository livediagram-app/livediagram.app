// Keeps one DOM subtree a copy of another by editing it in place (each product's canvas-performance.md "Typing in a
// long label stays light"). A text box's hug measurer lays out a copy of the live editor on every keystroke; a fresh
// copy is laid out from nothing (8 ms for 100,000 characters, 36 ms with the CPU slowed four times), while the same copy edited
// where the text changed lets the browser keep what it already shaped.

/**
 * Make `target`'s children a copy of `source`'s. When both hold the same nodes (the same elements with the same
 * attributes, the same text nodes), only the changed middle of each changed text is replaced; otherwise the
 * children are replaced with fresh clones. Either way `target` ends up a deep copy of `source`'s children.
 */
export function mirrorChildren(target: Element, source: Node): void {
  if (patchChildren(target, source)) return;
  target.replaceChildren(...Array.from(source.childNodes, (child) => child.cloneNode(true)));
}

// Patch `target`'s children toward `source`'s; false at the first node that is not the same kind of node, which
// leaves the rest for mirrorChildren to replace.
function patchChildren(target: Node, source: Node): boolean {
  const have = target.childNodes;
  const want = source.childNodes;
  if (have.length !== want.length) return false;
  for (let i = 0; i < want.length; i++) {
    const a = have[i]!;
    const b = want[i]!;
    if (a.nodeType === Node.TEXT_NODE && b.nodeType === Node.TEXT_NODE) {
      patchText(a as Text, (b as Text).data);
    } else if (
      !(a instanceof Element && b instanceof Element) ||
      !sameElement(a, b) ||
      !patchChildren(a, b)
    ) {
      return false;
    }
  }
  return true;
}

function sameElement(a: Element, b: Element): boolean {
  if (a.tagName !== b.tagName || a.attributes.length !== b.attributes.length) return false;
  for (const attr of Array.from(b.attributes)) {
    if (a.getAttribute(attr.name) !== attr.value) return false;
  }
  return true;
}

// Replace only the part of `node`'s text that differs from `next`: the run between their common start and end.
function patchText(node: Text, next: string): void {
  const prev = node.data;
  if (prev === next) return;
  const shorter = Math.min(prev.length, next.length);
  let start = 0;
  while (start < shorter && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let end = 0;
  while (
    end < shorter - start &&
    prev.charCodeAt(prev.length - 1 - end) === next.charCodeAt(next.length - 1 - end)
  ) {
    end++;
  }
  node.replaceData(start, prev.length - start - end, next.slice(start, next.length - end));
}
