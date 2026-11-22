// An inert HTML element's content as Markdown (docs/specs/020-import-export/blueprints/knowledgebase-import.md
// "HTML to Markdown"), for Confluence's pages: headings, lists, tables, links, pictures, code macros as fenced code,
// info, note, warning and tip macros as quotes with a bold first word, user mentions as plain names. Anything else
// is its text. Scripts, styles and frames contribute nothing, and no attribute but an address or an alt is read.

const IGNORED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED']);
const CONTAINERS = new Set([
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'NAV',
  'FIGURE',
  'FIGCAPTION',
  'DETAILS',
  'SUMMARY',
  'FORM',
  'FIELDSET',
  'DL',
  'DT',
  'DD',
]);
const BLOCKS = new Set(['P', 'PRE', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'HR']);
const MARKS: Record<string, string> = {
  STRONG: '**',
  B: '**',
  EM: '*',
  I: '*',
  DEL: '~~',
  S: '~~',
};
const MACRO_WORDS: [suffix: string, word: string][] = [
  ['information', 'Info'],
  ['note', 'Note'],
  ['warning', 'Warning'],
  ['tip', 'Tip'],
];

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** An address as a Markdown link target: nothing in it can end the target early. */
const encodeTarget = (address: string): string =>
  address
    .trim()
    .replace(
      /[ \t\n()<>]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
    );

const isElement = (node: Node): node is Element => node.nodeType === 1;

function inline(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue!.replace(/\s+/g, ' ');
  if (!isElement(node) || IGNORED.has(node.tagName)) return '';
  const tag = node.tagName;
  const inner = (): string => [...node.childNodes].map(inline).join('');
  if (tag === 'BR') return ' ';
  if (tag === 'IMG') {
    const alt = squash(node.getAttribute('alt') ?? '');
    const address = node.getAttribute('src');
    // An emoticon is a glyph of Confluence's own, not a picture of the page's.
    if (!address || node.classList.contains('emoticon')) return alt;
    return `![${alt.replace(/[[\]]/g, '')}](${encodeTarget(address)})`;
  }
  if (tag === 'A') {
    const text = squash(inner()).replace(/[[\]]/g, '');
    const address = node.getAttribute('href');
    const mention =
      node.classList.contains('user-mention') || node.classList.contains('confluence-userlink');
    if (!address || mention || text === '') return text;
    return `[${text}](${encodeTarget(address)})`;
  }
  if (tag === 'CODE' || tag === 'TT') return `\`${squash(node.textContent)}\``;
  const mark = MARKS[tag];
  if (mark) {
    const text = squash(inner());
    return text === '' ? '' : `${mark}${text}${mark}`;
  }
  // A block inside a line (a paragraph in a list item or a table cell): its text, set apart.
  return tag === 'P' || tag === 'LI' || CONTAINERS.has(tag) ? ` ${inner()} ` : inner();
}

function fence(pre: Element): string {
  const params = pre.getAttribute('data-syntaxhighlighter-params') ?? '';
  const language =
    /brush:\s*([\w#+-]+)/.exec(params)?.[1] ??
    /(?:^|\s)language-([\w#+-]+)/.exec(
      `${pre.className} ${pre.firstElementChild?.className ?? ''}`,
    )?.[1] ??
    '';
  const code = pre.textContent.replace(/\n+$/, '');
  const ticks = code.includes('```') ? '````' : '```';
  return `${ticks}${language}\n${code}\n${ticks}`;
}

function list(el: Element, depth: number): string[] {
  const lines: string[] = [];
  let number = 0;
  for (const item of el.children) {
    if (item.tagName !== 'LI') continue;
    number++;
    const nested: Element[] = [];
    let text = '';
    for (const child of item.childNodes) {
      if (isElement(child) && (child.tagName === 'UL' || child.tagName === 'OL'))
        nested.push(child);
      else text += inline(child);
    }
    lines.push(
      `${'    '.repeat(depth)}${el.tagName === 'OL' ? `${number}.` : '-'} ${squash(text)}`,
    );
    for (const below of nested) lines.push(...list(below, depth + 1));
  }
  return lines;
}

function table(el: Element): string {
  const rows = [...el.querySelectorAll('tr')]
    .filter((row) => row.closest('table') === el)
    .map((row) => [...row.children].map((cell) => squash(inline(cell)).replace(/[\\|]/g, '\\$&')));
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (width === 0) return '';
  const line = (row: string[]): string =>
    `| ${Array.from({ length: width }, (_, column) => row[column] ?? '').join(' | ')} |`;
  const [header, ...body] = rows;
  return [line(header!), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join(
    '\n',
  );
}

const quote = (blocks: string[]): string =>
  blocks.length === 0
    ? ''
    : blocks
        .join('\n\n')
        .split('\n')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n');

/** An info, note, warning or tip macro: a quote that opens with its kind in bold. */
function macro(el: Element, word: string): string {
  const blocks = blocksOf(el);
  const first = blocks[0];
  // Plain words join the bold word on its line; a list, a table, code or a heading starts under it.
  if (first !== undefined && /^[^#>|`\-\d]/.test(first)) blocks[0] = `**${word}** ${first}`;
  else blocks.unshift(`**${word}**`);
  return quote(blocks);
}

function macroWord(el: Element): string | null {
  if (!el.classList.contains('confluence-information-macro')) return null;
  const found = MACRO_WORDS.find(([suffix]) =>
    el.classList.contains(`confluence-information-macro-${suffix}`),
  );
  return found ? found[1] : 'Note';
}

function blocksOf(el: Element): string[] {
  const blocks: string[] = [];
  let run = '';
  const push = (block: string): void => {
    if (block !== '') blocks.push(block);
  };
  const flush = (): void => {
    push(squash(run));
    run = '';
  };
  for (const child of el.childNodes) {
    if (!isElement(child)) {
      run += inline(child);
      continue;
    }
    const tag = child.tagName;
    if (IGNORED.has(tag)) continue;
    const heading = /^H([1-6])$/.exec(tag);
    const word = macroWord(child);
    if (!heading && !BLOCKS.has(tag) && !CONTAINERS.has(tag)) {
      run += inline(child);
      continue;
    }
    flush();
    if (heading) {
      const text = squash([...child.childNodes].map(inline).join(''));
      push(text === '' ? '' : `${'#'.repeat(Number(heading[1]))} ${text}`);
    } else if (tag === 'P') push(squash([...child.childNodes].map(inline).join('')));
    else if (tag === 'PRE') push(fence(child));
    else if (tag === 'UL' || tag === 'OL') push(list(child, 0).join('\n'));
    else if (tag === 'TABLE') push(table(child));
    else if (tag === 'BLOCKQUOTE') push(quote(blocksOf(child)));
    else if (tag === 'HR') push('---');
    else if (word) push(macro(child, word));
    else blocks.push(...blocksOf(child));
  }
  flush();
  return blocks;
}

export function htmlToMarkdown(root: Element): string {
  return blocksOf(root).join('\n\n');
}
