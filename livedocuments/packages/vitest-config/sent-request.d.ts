/** The string body a request was sent with; throws on no body or any other kind. See sent-request.js. */
export declare function sentText(init: RequestInit | undefined): string;
/** The JSON body a request was sent with; throws on no body or a body that is not a string. */
export declare function sentJson(init: RequestInit | undefined): unknown;
/** The form a request was sent with: URLSearchParams, or a string in its encoding. */
export declare function sentForm(init: RequestInit | undefined): URLSearchParams;
/** The URL a request was sent to, from a string, a URL or a Request. */
export declare function sentUrl(input: RequestInfo | URL): string;
