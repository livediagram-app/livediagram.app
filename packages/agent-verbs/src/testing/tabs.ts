// Plain tabs for the shared write suites: a product's tab cut down to what the read copies read.

export type TestElement = { id: string; type: 'shape'; label: string; x: number };
export type TestTab = { id: string; name: string; elements: TestElement[] };

export const box = (id: string, label: string, x = 0): TestElement => ({
  id,
  type: 'shape',
  label,
  x,
});

export const plainTab = (
  elements: TestElement[],
  id = 'tab-one-0000',
  name = 'Overview',
): TestTab => ({ id, name, elements });

// A fingerprint as a product's would be: the element's content, so a change shows.
export const fingerprint = (element: TestElement) => JSON.stringify(element);

// A tab read as the api answers it: the JSON body and its weak ETag.
export const tabAnswer = (tab: TestTab, rev: number) => () =>
  new Response(JSON.stringify({ tab }), { headers: { ETag: `W/"${rev}"` } });

// The api's reading of a weak ETag (each product's api-schema `revOfEtag`).
export function revOfEtag(etag: string | null): number | null {
  const digits = etag === null ? null : /^W\/"(\d{1,16})"$/.exec(etag)?.[1];
  return digits ? Number(digits) : null;
}
