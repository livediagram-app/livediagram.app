// The New mark on a response's card (docs/specs/030-forms/forms.md "Hearing about responses"): a brand dot, named for
// a screen reader.
export function NewResponseMark() {
  return (
    <span
      role="img"
      aria-label="New response"
      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-2 ring-brand-500/25"
    />
  );
}
