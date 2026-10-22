// A project, folder or tab named in a toast (docs/specs/004-interface-design/toasts.md "Naming what it acted on"):
// in curly quotes, its whitespace collapsed, and cut to TOAST_NAME_MAX characters with an ellipsis so the message
// still fits the toast's line budget. Cut by code point, so an emoji is never split in half.

/** The most characters of a name a toast shows; two names and the words round them stay under 90. */
export const TOAST_NAME_MAX = 30;

/** The name, quoted and cut to fit a toast, or null when it is blank (the caller says "the project" instead). */
export function toastName(name: string | null | undefined): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const chars = Array.from(clean);
  const shown =
    chars.length > TOAST_NAME_MAX
      ? `${chars
          .slice(0, TOAST_NAME_MAX - 1)
          .join('')
          .trimEnd()}…`
      : clean;
  return `“${shown}”`;
}
