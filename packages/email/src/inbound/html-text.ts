// An HTML-only message as plain text (liveworkspace/docs/specs/003-accounts/inbound-email.md "The reader"): one pass,
// tags dropped, block ends as line breaks, script and style content dropped, entities decoded. Never markup out: the
// result is text, and whoever shows it shows it as text.

const BLOCKS = new Set([
  'br',
  'p',
  'div',
  'li',
  'tr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'table',
  'ul',
  'ol',
  'hr',
]);
const SKIPPED = new Set(['script', 'style', 'head', 'title']);

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
};

// The longest entity read: past this an `&` is plain text.
const ENTITY_MAX = 10;

function entityAt(html: string, at: number): { text: string; end: number } | null {
  // A bounded look ahead, so a run of `&` with no `;` stays linear.
  const semi = html.slice(at, at + ENTITY_MAX + 1).indexOf(';') + at;
  if (semi < at) return null;
  const name = html.slice(at + 1, semi);
  if (name.startsWith('#')) {
    const hex = name[1] === 'x' || name[1] === 'X';
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
    return { text: String.fromCodePoint(code), end: semi + 1 };
  }
  const named = NAMED[name.toLowerCase()];
  return named === undefined ? null : { text: named, end: semi + 1 };
}

// The tag's name, lower-cased (without a leading `/`), from the text after `<`.
function tagName(tag: string): string {
  let i = tag[0] === '/' ? 1 : 0;
  let name = '';
  while (i < tag.length) {
    const c = tag.charCodeAt(i);
    const letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
    if (!letter) break;
    name += tag[i];
    i++;
  }
  return name.toLowerCase();
}

/** The HTML's text: one pass, linear in its length. */
export function htmlToText(html: string): string {
  const lower = html.toLowerCase();
  let out = '';
  let at = 0;
  while (at < html.length) {
    const c = html[at]!;
    if (c === '<') {
      const close = html.indexOf('>', at);
      if (close < 0) break;
      const opening = html[at + 1] !== '/' && html[close - 1] !== '/';
      const name = tagName(html.slice(at + 1, Math.min(close, at + 20)));
      at = close + 1;
      if (opening && SKIPPED.has(name)) {
        const end = lower.indexOf(`</${name}`, at);
        if (end < 0) break;
        const endClose = html.indexOf('>', end);
        at = endClose < 0 ? html.length : endClose + 1;
        continue;
      }
      // One break between blocks, however many tags end and start there.
      if (BLOCKS.has(name) && !out.endsWith('\n')) out += '\n';
      continue;
    }
    if (c === '&') {
      const entity = entityAt(html, at);
      if (entity) {
        out += entity.text;
        at = entity.end;
        continue;
      }
    }
    out += c === '\r' || c === '\n' || c === '\t' ? ' ' : c;
    at++;
  }
  return tidyLines(out);
}

/** Lines with their runs of spaces collapsed and ends trimmed, and no more than one empty line in a row. */
export function tidyLines(text: string): string {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    let line = '';
    let space = false;
    for (const c of raw) {
      if (c === ' ' || c === ' ') space = true;
      else {
        if (space && line) line += ' ';
        space = false;
        line += c;
      }
    }
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
