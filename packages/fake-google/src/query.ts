// The subset of Drive's `q` search syntax the mirror uses, clauses joined by
// `and`: `trashed = false`, `'<id>' in parents`, `mimeType = '<type>'`,
// `mimeType != '<type>'`, `appProperties has { key='k' and value='v' }`.
// Anything else throws, so a query the fake does not understand fails loudly
// instead of matching everything.

export type QueryFile = {
  parents: string[];
  trashed: boolean;
  mimeType: string;
  appProperties: Record<string, string>;
};

type Clause = (f: QueryFile) => boolean;

const unquote = (s: string) => s.replace(/\\'/g, "'");

function splitAnd(q: string): string[] {
  // `and` inside `{ ... }` belongs to an appProperties clause.
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  const tokens = q.split(/(\{|\}|\s+and\s+)/i);
  for (const t of tokens) {
    if (t === '{') depth++;
    if (t === '}') depth--;
    if (depth === 0 && /^\s+and\s+$/i.test(t)) {
      parts.push(current.trim());
      current = '';
    } else {
      current += t;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function clause(text: string): Clause {
  let m = /^trashed\s*=\s*(true|false)$/i.exec(text);
  if (m) {
    const want = m[1]!.toLowerCase() === 'true';
    return (f) => f.trashed === want;
  }
  m = /^'((?:[^'\\]|\\.)*)'\s+in\s+parents$/i.exec(text);
  if (m) {
    const id = unquote(m[1]!);
    return (f) => f.parents.includes(id);
  }
  m = /^mimeType\s*(=|!=)\s*'((?:[^'\\]|\\.)*)'$/i.exec(text);
  if (m) {
    const [op, type] = [m[1]!, unquote(m[2]!)];
    return (f) => (op === '=' ? f.mimeType === type : f.mimeType !== type);
  }
  m =
    /^appProperties\s+has\s*\{\s*key\s*=\s*'((?:[^'\\]|\\.)*)'\s+and\s+value\s*=\s*'((?:[^'\\]|\\.)*)'\s*\}$/i.exec(
      text,
    );
  if (m) {
    const [key, value] = [unquote(m[1]!), unquote(m[2]!)];
    return (f) => f.appProperties[key] === value;
  }
  throw new Error(`fake-google: unsupported q clause: ${text}`);
}

export function compileQuery(q: string | null): Clause {
  if (!q || !q.trim()) return () => true;
  const clauses = splitAnd(q).map(clause);
  return (f) => clauses.every((c) => c(f));
}
