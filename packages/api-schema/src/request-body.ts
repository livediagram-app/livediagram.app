// A request body whose every field is optional, as the api and MCP workers read one: the parsed JSON when it is a
// plain object, otherwise `{}`. `null`, a string or an array parse as JSON too, and reading a field off them threw
// (a 500, where an absent body is the documented default).
export function objectOrEmpty(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}
