// An Illustrate request read from the wire (docs/specs/024-agents/blueprints/illustrate-for-agents.md
// "Interfaces and contracts"): strictly, so a misspelt field is refused by name rather than ignored.
// Answers the request, or the refusal that says what was wrong and where.
import {
  ILLUSTRATE_REF_MAX,
  PAGE_CHANGES_MAX,
  PAGE_CHANGE_OPS,
  type ArticleWrite,
  type IllustrateRefusal,
  type IllustrateRequest,
  type PageBackgroundInput,
  type PageChange,
} from '@livediagram/api-schema';
import {
  ARTICLE_LOOK_IDS,
  ARTICLE_MARKDOWN_MAX,
  isArticleHex,
  PAGE_NAME_MAX,
  PAGE_ORIENTATIONS,
  PAGE_PATTERNS,
  PAGE_SIZE_IDS,
} from '@livediagram/document';

const PAGE_KINDS = ['infographic', 'article', 'slide', 'logo'] as const;

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

class Refused extends Error {
  readonly code: IllustrateRefusal['code'];
  readonly change: number | undefined;
  constructor(code: IllustrateRefusal['code'], message: string, change?: number) {
    super(message);
    this.code = code;
    this.change = change;
  }
}

const bad = (message: string, change?: number): never => {
  throw new Refused('invalid_value', message, change);
};

function onlyKeys(raw: Raw, allowed: readonly string[], where: string, change?: number): void {
  for (const key of Object.keys(raw))
    if (!allowed.includes(key))
      bad(`${where} takes no "${key}" (it takes ${allowed.join(', ')}).`, change);
}

const oneOf = <T extends string>(
  list: readonly T[],
  v: unknown,
  field: string,
  change?: number,
): T => {
  if (typeof v === 'string' && list.includes(v as T)) return v as T;
  return bad(`"${field}" is one of ${list.join(', ')}.`, change);
};

const text = (v: unknown, field: string, max: number, change?: number): string => {
  if (typeof v !== 'string') bad(`"${field}" is text.`, change);
  if ((v as string).length > max) bad(`"${field}" is at most ${max} characters.`, change);
  return v as string;
};

const place = (v: unknown, field: string, change?: number): number => {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v;
  return bad(`"${field}" is a page place: a whole number from 1.`, change);
};

function pageRef(v: unknown, change: number): string | number {
  if (typeof v === 'number') return place(v, 'page', change);
  if (typeof v === 'string' && v.trim() && v.length <= ILLUSTRATE_REF_MAX) return v;
  return bad(
    `"page" names a page: its id, its place (1 is the first) or its name, up to ${ILLUSTRATE_REF_MAX} characters.`,
    change,
  );
}

const hex = (v: unknown, field: string, change?: number): string => {
  if (isArticleHex(v)) return v;
  return bad(`"${field}" is a hex colour such as #0f172a.`, change);
};

function background(v: unknown, change: number): PageBackgroundInput {
  if (!isRecord(v)) return bad('"background" is an object.', change);
  onlyKeys(v, ['color', 'gradient', 'angle', 'pattern', 'paper'], '"background"', change);
  const out: PageBackgroundInput = {};
  const fills = ['color', 'gradient', 'paper'].filter((k) => v[k] !== undefined);
  if (fills.length > 1) bad('"background" takes one of color, gradient or paper.', change);
  if (v.color !== undefined) out.color = hex(v.color, 'background.color', change);
  if (v.gradient !== undefined) {
    if (!Array.isArray(v.gradient) || v.gradient.length !== 2)
      bad('"background.gradient" is two hex colours, from and to.', change);
    const [from, to] = v.gradient as unknown[];
    out.gradient = [
      hex(from, 'background.gradient', change),
      hex(to, 'background.gradient', change),
    ];
  }
  if (v.angle !== undefined) {
    if (typeof v.angle !== 'number' || !Number.isFinite(v.angle) || v.gradient === undefined)
      bad('"background.angle" is a number of degrees, beside a gradient.', change);
    out.angle = (((Math.round(v.angle as number) % 360) + 360) % 360) as number;
  }
  if (v.pattern !== undefined)
    out.pattern = oneOf(
      [...PAGE_PATTERNS, 'none'] as const,
      v.pattern,
      'background.pattern',
      change,
    );
  if (v.paper !== undefined) {
    if (v.paper !== true) bad('"background.paper" is true, for the plain paper.', change);
    out.paper = true;
  }
  if (Object.keys(out).length === 0)
    bad('"background" sets a color, gradient, pattern or paper.', change);
  return out;
}

const COMMON = ['op'];
function pageChange(v: unknown, i: number): PageChange {
  if (!isRecord(v)) return bad(`Change ${i + 1} is an object with an "op".`, i);
  const op = oneOf(PAGE_CHANGE_OPS, v.op, 'op', i);
  const name = () => (v.name === undefined ? {} : { name: text(v.name, 'name', PAGE_NAME_MAX, i) });
  const size = () =>
    v.size === undefined ? {} : { size: oneOf(PAGE_SIZE_IDS, v.size, 'size', i) };
  const orientation = () =>
    v.orientation === undefined
      ? {}
      : { orientation: oneOf(PAGE_ORIENTATIONS, v.orientation, 'orientation', i) };
  const bg = () => (v.background === undefined ? {} : { background: background(v.background, i) });
  const layout = (required: boolean) =>
    v.layout === undefined && !required
      ? {}
      : { layout: text(v.layout, 'layout', ILLUSTRATE_REF_MAX, i) };
  switch (op) {
    case 'add':
      onlyKeys(
        v,
        [...COMMON, 'kind', 'size', 'orientation', 'name', 'background', 'layout', 'at'],
        'add',
        i,
      );
      return {
        op,
        kind: oneOf(PAGE_KINDS, v.kind, 'kind', i),
        ...size(),
        ...orientation(),
        ...name(),
        ...bg(),
        ...layout(false),
        ...(v.at === undefined ? {} : { at: place(v.at, 'at', i) }),
      };
    case 'set': {
      onlyKeys(
        v,
        [...COMMON, 'page', 'name', 'size', 'orientation', 'background', 'locked'],
        'set',
        i,
      );
      if (v.locked !== undefined && typeof v.locked !== 'boolean')
        bad('"locked" is true or false.', i);
      const change: PageChange = {
        op,
        page: pageRef(v.page, i),
        ...name(),
        ...size(),
        ...orientation(),
        ...bg(),
        ...(v.locked === undefined ? {} : { locked: v.locked as boolean }),
      };
      if (Object.keys(change).length === 2)
        bad('"set" changes at least one of name, size, orientation, background or locked.', i);
      return change;
    }
    case 'layout':
      onlyKeys(v, [...COMMON, 'page', 'layout'], 'layout', i);
      return { op, page: pageRef(v.page, i), layout: layout(true).layout! };
    case 'move':
      onlyKeys(v, [...COMMON, 'page', 'to'], 'move', i);
      return { op, page: pageRef(v.page, i), to: place(v.to, 'to', i) };
    case 'duplicate':
    case 'delete':
      onlyKeys(v, [...COMMON, 'page'], op, i);
      return { op, page: pageRef(v.page, i) };
  }
}

function articleWrite(v: unknown): ArticleWrite {
  if (!isRecord(v)) return bad('"article" is an object with "markdown".');
  onlyKeys(
    v,
    ['article', 'new', 'markdown', 'mode', 'size', 'orientation', 'look', 'accent', 'pageNumbers'],
    '"article"',
  );
  if (typeof v.markdown !== 'string') bad('"markdown" is the article\'s text, in Markdown.');
  if ((v.markdown as string).length > ARTICLE_MARKDOWN_MAX)
    throw new Refused(
      'article_too_large',
      `The Markdown is ${(v.markdown as string).length.toLocaleString('en')} characters; one write takes at most ${ARTICLE_MARKDOWN_MAX.toLocaleString('en')}. Write the rest with mode "append".`,
    );
  if (v.new !== undefined && typeof v.new !== 'boolean') bad('"new" is true or false.');
  if (v.pageNumbers !== undefined && typeof v.pageNumbers !== 'boolean')
    bad('"pageNumbers" is true or false.');
  if (v.new === true && v.article !== undefined) bad('Give "article" or "new", not both.');
  return {
    markdown: v.markdown as string,
    ...(v.article === undefined ? {} : { article: text(v.article, 'article', 200) }),
    ...(v.new === true ? { new: true } : {}),
    ...(v.mode === undefined
      ? {}
      : { mode: oneOf(['replace', 'append'] as const, v.mode, 'mode') }),
    ...(v.size === undefined ? {} : { size: oneOf(PAGE_SIZE_IDS, v.size, 'size') }),
    ...(v.orientation === undefined
      ? {}
      : { orientation: oneOf(PAGE_ORIENTATIONS, v.orientation, 'orientation') }),
    ...(v.look === undefined ? {} : { look: oneOf(ARTICLE_LOOK_IDS, v.look, 'look') }),
    ...(v.accent === undefined ? {} : { accent: hex(v.accent, 'accent') }),
    ...(v.pageNumbers === undefined ? {} : { pageNumbers: v.pageNumbers as boolean }),
  };
}

/** The request, or why it was refused. */
export function parseIllustrateRequest(
  raw: unknown,
): IllustrateRequest | { refusal: IllustrateRefusal } {
  try {
    if (!isRecord(raw))
      throw new Refused('invalid_body', 'The body is an object with "pages" or "article".');
    const has = ['pages', 'article'].filter((k) => raw[k] !== undefined);
    if (has.length !== 1)
      throw new Refused(
        'invalid_body',
        'Send exactly one of "pages" (page changes) or "article" (a write).',
      );
    onlyKeys(raw, ['pages', 'article'], 'The body');
    if (raw.article !== undefined) return { article: articleWrite(raw.article) };
    const pages = raw.pages;
    if (!Array.isArray(pages) || pages.length === 0 || pages.length > PAGE_CHANGES_MAX)
      throw new Refused(
        'invalid_body',
        `"pages" is a list of 1 to ${PAGE_CHANGES_MAX} page changes.`,
      );
    return { pages: pages.map(pageChange) };
  } catch (err) {
    if (err instanceof Refused)
      return {
        refusal: {
          code: err.code,
          message: err.message,
          ...(err.change === undefined ? {} : { change: err.change }),
        },
      };
    throw err;
  }
}
