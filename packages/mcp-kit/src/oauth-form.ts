// A field of an OAuth request's form body as text. Every field the endpoints read is a string; an
// upload or a repeated field is no value, so it reads as empty and fails the request's own checks.
export function formText(form: Record<string, unknown>, key: string): string {
  const value = form[key];
  return typeof value === 'string' ? value : '';
}
