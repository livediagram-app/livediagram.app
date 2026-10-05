// One field's validation message in the publish dialog, directly under the field it is about. The field
// points at it with `aria-describedby` and carries `aria-invalid`, so a screen reader reads the message
// when focus lands there.
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-300"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="mt-px h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75v3.75M8 11.25h.01" />
      </svg>
      {message}
    </p>
  );
}
