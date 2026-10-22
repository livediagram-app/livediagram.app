// A collaborator's pointer and name tag, as the apps draw other people's cursors. Decorative.
export function Cursor({
  name,
  colour,
  className = '',
}: {
  name: string;
  colour: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={`pointer-events-none flex items-start ${className}`}>
      <svg viewBox="0 0 16 16" className="size-4 drop-shadow-sm">
        <path
          d="M2 1.5 13.5 7 8 8.5 5.5 14z"
          fill={colour}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="mt-3 -ml-0.5 rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white shadow-sm"
        style={{ backgroundColor: colour }}
      >
        {name}
      </span>
    </span>
  );
}
