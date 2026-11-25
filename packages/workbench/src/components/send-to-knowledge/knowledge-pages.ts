// The picker's pure parts (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker"): a knowledgebase's
// pages as the tree reads, a search over them, and the section's Markdown as the preview draws it. Linear, no regular
// expression over anyone's words.

/** A page as liveknowledge's door lists it. */
export type KnowledgePage = { id: string; name: string; parent: string | null };
/** A page in tree order, with how deep it sits (0 at the top level). */
export type TreePage = { id: string; name: string; depth: number };

/** The pages in tree order: each page, then the pages under it, siblings in the order given. A page whose parent is
 *  not listed sits at the top level; a loop is broken where it is found. */
export function pageTree(pages: readonly KnowledgePage[]): TreePage[] {
  const known = new Set(pages.map((p) => p.id));
  const children = new Map<string | null, KnowledgePage[]>();
  for (const p of pages) {
    const parent = p.parent && known.has(p.parent) && p.parent !== p.id ? p.parent : null;
    const list = children.get(parent);
    if (list) list.push(p);
    else children.set(parent, [p]);
  }
  const out: TreePage[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const p of children.get(parent) ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, name: p.name, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  // Pages in a loop never reached from the top: listed at the top level, so none is lost.
  for (const p of pages)
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push({ id: p.id, name: p.name, depth: 0 });
      walk(p.id, 1);
    }
  return out;
}

/** The pages whose title holds every word of the search, case aside; all of them for an empty search. */
export function searchPages(pages: readonly TreePage[], query: string): TreePage[] {
  const words = query.toLowerCase().split(' ').filter(Boolean);
  if (words.length === 0) return [...pages];
  return pages.filter((p) => {
    const name = p.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

/** One block of the preview. */
export type PreviewBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'item'; text: string; depth: number }
  | { kind: 'code'; text: string };

/** A Markdown line's words as read: backslash escapes taken, emphasis and code marks dropped, a link read as its words. */
export function plainLine(line: string): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (ch === '\\' && i + 1 < line.length) {
      out += line[i + 1];
      i += 2;
      continue;
    }
    if (ch === '*' || ch === '_' || ch === '`') {
      i += 1;
      continue;
    }
    if (ch === '[') {
      const close = line.indexOf('](', i + 1);
      const end = close > 0 ? line.indexOf(')', close + 2) : -1;
      if (close > 0 && end > 0) {
        out += plainLine(line.slice(i + 1, close));
        i = end + 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

const leading = (line: string) => {
  let n = 0;
  while (n < line.length && line[n] === ' ') n += 1;
  return n;
};

/** The section's Markdown as the preview draws it: headings, paragraphs (lines joined), list items and code. */
export function previewBlocks(markdown: string): PreviewBlock[] {
  const out: PreviewBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  const flush = () => {
    if (paragraph.length > 0) out.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of markdown.replaceAll('\r\n', '\n').split('\n')) {
    if (raw.trimStart().startsWith('```')) {
      if (code) {
        out.push({ kind: 'code', text: code.join('\n') });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    const indent = leading(raw);
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('#')) {
      let n = 0;
      while (line[n] === '#') n += 1;
      if (line[n] === ' ') {
        flush();
        out.push({ kind: 'heading', text: plainLine(line.slice(n + 1).trim()) });
        continue;
      }
    }
    const bullet = line.startsWith('- ') || line.startsWith('* ');
    let numbered = 0;
    while (numbered < line.length && line[numbered]! >= '0' && line[numbered]! <= '9')
      numbered += 1;
    if (bullet || (numbered > 0 && line.startsWith('. ', numbered))) {
      flush();
      const text = bullet ? line.slice(2) : line.slice(numbered + 2);
      out.push({ kind: 'item', text: plainLine(text.trim()), depth: Math.floor(indent / 2) });
      continue;
    }
    paragraph.push(plainLine(line));
  }
  if (code) out.push({ kind: 'code', text: code.join('\n') });
  flush();
  return out;
}

/** How much a selection holds, in words: "6 items, 4 arrows". */
export function selectionWords(items: number, links: number): string {
  const it = `${items} item${items === 1 ? '' : 's'}`;
  return links > 0 ? `${it}, ${links} arrow${links === 1 ? '' : 's'}` : it;
}
