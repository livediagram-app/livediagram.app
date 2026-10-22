// What a stubbed `fetch` was sent. The code under test writes a JSON body as a string and a form as
// URLSearchParams, so a body of any other kind (a Blob, FormData) is a different request, and
// reading it as text would hide that.

/** @param {unknown} body */
const kindOf = (body) => Object.prototype.toString.call(body);

/**
 * The string body a request was sent with.
 *
 * @param {RequestInit | undefined} init
 * @returns {string}
 */
export function sentText(init) {
  const body = init?.body;
  if (body === undefined || body === null) throw new Error('the request was sent with no body');
  if (typeof body !== 'string') throw new Error(`expected a string body, got ${kindOf(body)}`);
  return body;
}

/**
 * The JSON body a request was sent with.
 *
 * @param {RequestInit | undefined} init
 * @returns {unknown}
 */
export function sentJson(init) {
  return JSON.parse(sentText(init));
}

/**
 * The form a request was sent with: URLSearchParams, or a string in its encoding.
 *
 * @param {RequestInit | undefined} init
 * @returns {URLSearchParams}
 */
export function sentForm(init) {
  const body = init?.body;
  return body instanceof URLSearchParams ? body : new URLSearchParams(sentText(init));
}

/**
 * The URL a request was sent to: `fetch` takes a string, a URL or a Request.
 *
 * @param {RequestInfo | URL} input
 * @returns {string}
 */
export function sentUrl(input) {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}
