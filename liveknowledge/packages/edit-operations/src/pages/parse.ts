// A Pages request read from the wire (docs/specs/024-agents/blueprints/pages-for-agents.md
// "Interfaces and contracts"): strictly, so a misspelt field is refused by name rather than ignored.
// Answers the request, or the refusal that says what was wrong and where.
import {
  type ArticleWrite,
  type ArticleWritePicture,
  type PagesRefusal,
  type PagesRequest,
} from '@liveknowledge/api-schema';
import { isRecord, ARTICLE_MARKDOWN_MAX, type TabCover } from '@liveknowledge/document';
import { parseAgentCover } from './cover';

type Raw = Record<string, unknown>;

class Refused extends Error {
  readonly code: PagesRefusal['code'];
  constructor(code: PagesRefusal['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const bad = (message: string): never => {
  throw new Refused('invalid_value', message);
};

function onlyKeys(raw: Raw, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(raw))
    if (!allowed.includes(key)) bad(`${where} takes no "${key}" (it takes ${allowed.join(', ')}).`);
}

const oneOf = <T extends string>(list: readonly T[], v: unknown, field: string): T => {
  if (typeof v === 'string' && list.includes(v as T)) return v as T;
  return bad(`"${field}" is one of ${list.join(', ')}.`);
};

const text = (v: unknown, field: string, max: number): string => {
  if (typeof v !== 'string') bad(`"${field}" is text.`);
  if ((v as string).length > max) bad(`"${field}" is at most ${max} characters.`);
  return v as string;
};

// What an article write once took and no longer does (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase
// Style"): a page has no look of its own. Named, so the refusal says where the setting lives now.
const RETIRED_STYLE_FIELDS = ['look', 'accent'] as const;
/** The refusal for a write that names a page's look: fixable, it says what to send instead. */
export const STYLE_IS_THE_KNOWLEDGEBASES = (field: string): string =>
  `"article" takes no "${field}": a page has no style of its own. The look is a knowledgebase setting, the same for every page. Leave "${field}" out, and set the style once with PUT /api/documents/<id> { "knowledgeStyle": { "theme", "headingFont", "bodyFont", "textSize", "lineSpacing", "headingStyle", "accent" } } (an Editor's token with the write scope), or in Knowledgebase Style in the editor.`;

function articleWrite(v: unknown): ArticleWrite {
  if (!isRecord(v)) return bad('"article" is an object with "markdown".');
  for (const field of RETIRED_STYLE_FIELDS)
    if (v[field] !== undefined) bad(STYLE_IS_THE_KNOWLEDGEBASES(field));
  onlyKeys(
    v,
    // No "new", "size", "orientation" or "pageNumbers": a page holds one article, on the continuous page.
    ['article', 'markdown', 'mode', 'as', 'after', 'picture'],
    '"article"',
  );
  if (typeof v.markdown !== 'string') bad('"markdown" is the article\'s text, in Markdown.');
  if ((v.markdown as string).length > ARTICLE_MARKDOWN_MAX)
    throw new Refused(
      'article_too_large',
      `The Markdown is ${(v.markdown as string).length.toLocaleString('en')} characters; one write takes at most ${ARTICLE_MARKDOWN_MAX.toLocaleString('en')}. Write the rest with mode "append".`,
    );
  const mode =
    v.mode === undefined ? undefined : oneOf(['replace', 'append'] as const, v.mode, 'mode');
  if ((v.after !== undefined || v.picture !== undefined) && mode !== 'append')
    bad('"after" and "picture" go with "mode": "append".');
  return {
    markdown: v.markdown as string,
    ...(v.article === undefined ? {} : { article: text(v.article, 'article', 200) }),
    ...(mode === undefined ? {} : { mode }),
    ...(v.after === undefined ? {} : { after: text(v.after, 'after', 200) }),
    ...(v.picture === undefined ? {} : { picture: pictureOf(v.picture) }),
  };
}

const PICTURE_SIDE_MAX = 8_192;

function pictureOf(v: unknown): ArticleWritePicture {
  if (!isRecord(v)) return bad('"picture" is an object with "imageId", "width" and "height".');
  onlyKeys(v, ['imageId', 'width', 'height', 'alt'], '"picture"');
  const side = (n: unknown, field: string): number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= PICTURE_SIDE_MAX
      ? n
      : bad(`"picture.${field}" is a whole number of pixels from 1 to ${PICTURE_SIDE_MAX}.`);
  const imageId = text(v.imageId, 'picture.imageId', 200);
  if (!imageId)
    bad('"picture.imageId" is an image of the knowledgebase (upload_image answers one).');
  return {
    imageId,
    width: side(v.width, 'width'),
    height: side(v.height, 'height'),
    ...(v.alt === undefined ? {} : { alt: text(v.alt, 'picture.alt', 300) }),
  };
}

function coverOf(raw: unknown): TabCover | null {
  const read = parseAgentCover(raw);
  if ('refusal' in read) throw new Refused(read.refusal.code, read.refusal.message);
  return read.cover;
}

/** The request, or why it was refused. */
export function parsePagesRequest(raw: unknown): PagesRequest | { refusal: PagesRefusal } {
  try {
    if (!isRecord(raw))
      throw new Refused('invalid_body', 'The body is an object with "pages" or "article".');
    // A cover (docs/specs/030-knowledgebase/page-surface.md "The cover") rides an article write or stands alone.
    const cover = raw.cover === undefined ? undefined : coverOf(raw.cover);
    const has = ['pages', 'article'].filter((k) => raw[k] !== undefined);
    if (has.length === 0 && cover !== undefined) {
      onlyKeys(raw, ['cover'], 'The body');
      return { cover };
    }
    if (has.length !== 1)
      throw new Refused(
        'invalid_body',
        'Send exactly one of "pages" (page changes) or "article" (a write), or "cover" alone.',
      );
    onlyKeys(raw, ['pages', 'article', 'cover'], 'The body');
    if (raw.article !== undefined)
      return { article: articleWrite(raw.article), ...(cover !== undefined ? { cover } : {}) };
    // A knowledgebase page is one article on one continuous page (docs/specs/030-knowledgebase/
    // knowledgebases-and-pages.md "The continuous page"): no page is added, laid out, sized, turned, moved, copied or
    // deleted, so page changes are refused whole.
    throw new Refused(
      'kind_not_offered',
      'A page here is one page of writing: it takes no page changes. Write it with "article" (write_article).',
    );
  } catch (err) {
    if (err instanceof Refused) return { refusal: { code: err.code, message: err.message } };
    throw err;
  }
}
