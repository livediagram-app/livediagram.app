// Plain text with its line breaks kept and its web addresses made into links (docs/specs/030-forms/forms.md "The form
// card": a form's description). Never HTML: what was typed is shown as typed.
const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

export function LinkedText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <p className={`whitespace-pre-line break-words ${className}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[var(--form-accent)] underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}
