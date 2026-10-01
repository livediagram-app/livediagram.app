// The creator + licence credit an image picked from Image search carries
// (docs/specs/009-elements/image-search.md "Credit on the element").

export type ImageCredit = {
  // “"<title>" by <creator>, <licence label>”, parts left out when unknown.
  text: string;
  // The picture's page at its source.
  sourceUrl: string;
  // The licence deed, when known.
  licenseUrl?: string;
};

// A credit line, not prose.
export const IMAGE_CREDIT_TEXT_MAX = 300;
// The common URL ceiling.
export const IMAGE_CREDIT_URL_MAX = 2048;

const HTTP_URL = /^https?:\/\//i;

export function isCreditUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= IMAGE_CREDIT_URL_MAX && HTTP_URL.test(v);
}

// Structural check for a stored credit. Only http(s) links pass, so a crafted
// document can't plant a `javascript:` link behind the Source / Licence links.
export function isImageCredit(v: unknown): v is ImageCredit {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.text === 'string' &&
    c.text.length > 0 &&
    c.text.length <= IMAGE_CREDIT_TEXT_MAX &&
    isCreditUrl(c.sourceUrl) &&
    (c.licenseUrl === undefined || isCreditUrl(c.licenseUrl))
  );
}
