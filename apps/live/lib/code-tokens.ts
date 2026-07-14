import type { CodeLanguage } from '@livediagram/diagram';

// Hand-rolled tokenizer for the code block's syntax highlighting (spec/82).
// One generic scanner driven by a per-language config: comments, strings,
// numbers, and a keyword set. Deliberately tiny and dependency-free — the
// output feeds fixed colour classes on a dark card, not an editor — and
// loaded as an async chunk via code-highlight-registry so first paints
// without a code block never pay for it.

export type CodeTokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number';
export type CodeToken = { kind: CodeTokenKind; text: string };

type LanguageConfig = {
  lineComment?: string;
  blockComment?: [string, string];
  // String delimiters (each a single char; backslash escapes inside).
  stringQuotes: string[];
  keywords: ReadonlySet<string>;
  // SQL keywords match regardless of case.
  caseInsensitive?: boolean;
  // HTML-style tag highlighting: an identifier straight after `<` / `</`
  // reads as a keyword even though it isn't in the set.
  tagNames?: boolean;
};

const JS_KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'yield',
]);

const CONFIGS: Record<Exclude<CodeLanguage, 'plain'>, LanguageConfig> = {
  ts: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
    stringQuotes: ["'", '"', '`'],
    keywords: JS_KEYWORDS,
  },
  js: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
    stringQuotes: ["'", '"', '`'],
    keywords: JS_KEYWORDS,
  },
  python: {
    lineComment: '#',
    stringQuotes: ["'", '"'],
    keywords: new Set([
      'and',
      'as',
      'assert',
      'async',
      'await',
      'break',
      'class',
      'continue',
      'def',
      'del',
      'elif',
      'else',
      'except',
      'False',
      'finally',
      'for',
      'from',
      'global',
      'if',
      'import',
      'in',
      'is',
      'lambda',
      'None',
      'not',
      'or',
      'pass',
      'raise',
      'return',
      'True',
      'try',
      'while',
      'with',
      'yield',
    ]),
  },
  json: {
    stringQuotes: ['"'],
    keywords: new Set(['true', 'false', 'null']),
  },
  bash: {
    lineComment: '#',
    stringQuotes: ["'", '"'],
    keywords: new Set([
      'case',
      'do',
      'done',
      'echo',
      'elif',
      'else',
      'esac',
      'exit',
      'export',
      'fi',
      'for',
      'function',
      'if',
      'in',
      'local',
      'return',
      'set',
      'then',
      'while',
    ]),
  },
  sql: {
    lineComment: '--',
    blockComment: ['/*', '*/'],
    stringQuotes: ["'"],
    caseInsensitive: true,
    keywords: new Set([
      'alter',
      'and',
      'as',
      'asc',
      'between',
      'by',
      'case',
      'create',
      'delete',
      'desc',
      'distinct',
      'drop',
      'else',
      'end',
      'exists',
      'from',
      'group',
      'having',
      'in',
      'index',
      'inner',
      'insert',
      'into',
      'is',
      'join',
      'left',
      'like',
      'limit',
      'not',
      'null',
      'on',
      'or',
      'order',
      'outer',
      'primary',
      'right',
      'select',
      'set',
      'table',
      'then',
      'union',
      'update',
      'values',
      'when',
      'where',
    ]),
  },
  html: {
    blockComment: ['<!--', '-->'],
    stringQuotes: ['"', "'"],
    keywords: new Set(['DOCTYPE', 'doctype']),
    tagNames: true,
  },
  css: {
    blockComment: ['/*', '*/'],
    stringQuotes: ['"', "'"],
    keywords: new Set(['important', 'media', 'supports', 'keyframes', 'import', 'font-face']),
  },
  yaml: {
    lineComment: '#',
    stringQuotes: ['"', "'"],
    keywords: new Set(['true', 'false', 'null', 'yes', 'no']),
  },
};

const isWordChar = (ch: string) => /[A-Za-z0-9_$-]/.test(ch);
const isDigit = (ch: string) => ch >= '0' && ch <= '9';

// Tokenize a snippet into one token array per line. Block comments and
// (template) strings carry across lines; every other state resets at the
// newline, which is how the languages here behave in practice.
export function tokenizeCode(code: string, language: CodeLanguage): CodeToken[][] {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  if (language === 'plain') return lines.map((l) => (l ? [{ kind: 'plain', text: l }] : []));
  const cfg = CONFIGS[language];
  // Cross-line scanner state: inside a block comment, or inside a
  // multi-line-capable string (backticks); single-line strings reset.
  let inBlockComment = false;
  let inTemplateString = false;
  return lines.map((line) => {
    const tokens: CodeToken[] = [];
    const push = (kind: CodeTokenKind, text: string) => {
      if (!text) return;
      const last = tokens[tokens.length - 1];
      if (last && last.kind === kind) last.text += text;
      else tokens.push({ kind, text });
    };
    let i = 0;
    while (i < line.length) {
      if (inBlockComment) {
        const end = line.indexOf(cfg.blockComment![1], i);
        if (end === -1) {
          push('comment', line.slice(i));
          i = line.length;
        } else {
          push('comment', line.slice(i, end + cfg.blockComment![1].length));
          i = end + cfg.blockComment![1].length;
          inBlockComment = false;
        }
        continue;
      }
      if (inTemplateString) {
        const end = scanStringEnd(line, i, '`');
        push('string', line.slice(i, end.index));
        i = end.index;
        if (end.closed) inTemplateString = false;
        continue;
      }
      const rest = line.slice(i);
      if (cfg.blockComment && rest.startsWith(cfg.blockComment[0])) {
        inBlockComment = true;
        push('comment', cfg.blockComment[0]);
        i += cfg.blockComment[0].length;
        continue;
      }
      if (cfg.lineComment && rest.startsWith(cfg.lineComment)) {
        push('comment', rest);
        i = line.length;
        continue;
      }
      const ch = line[i]!;
      if (cfg.stringQuotes.includes(ch)) {
        const end = scanStringEnd(line, i + 1, ch);
        push('string', line.slice(i, end.index));
        i = end.index;
        // An unterminated backtick string continues onto the next line.
        if (ch === '`' && !end.closed) inTemplateString = true;
        continue;
      }
      if (isDigit(ch) || (ch === '.' && isDigit(line[i + 1] ?? ''))) {
        let j = i + 1;
        while (j < line.length && /[0-9a-fA-FxX_.]/.test(line[j]!)) j++;
        push('number', line.slice(i, j));
        i = j;
        continue;
      }
      if (isWordChar(ch) && !isDigit(ch)) {
        let j = i + 1;
        while (j < line.length && isWordChar(line[j]!)) j++;
        const word = line.slice(i, j);
        const match = cfg.caseInsensitive ? word.toLowerCase() : word;
        const isTag = cfg.tagNames && (line[i - 1] === '<' || line.slice(i - 2, i) === '</');
        push(cfg.keywords.has(match) || isTag ? 'keyword' : 'plain', word);
        i = j;
        continue;
      }
      push('plain', ch);
      i++;
    }
    return tokens;
  });
}

// Scan forward from `from` for the closing quote, honouring backslash
// escapes. Returns the index just past the close (or end of line).
function scanStringEnd(
  line: string,
  from: number,
  quote: string,
): { index: number; closed: boolean } {
  let i = from;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === quote) return { index: i + 1, closed: true };
    i++;
  }
  return { index: line.length, closed: false };
}
