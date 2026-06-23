// The X glyph used by every dialog / popover / toast dismiss button.
// It had been hand-inlined ~11 times with slightly different sizes; this
// is the single source. `size` sets the rendered px (the viewBox is fixed
// so the stroke scales with it); `strokeWidth` is in viewBox units. Colour
// comes from the parent via `currentColor`.
export function CloseIcon({
  size = 14,
  strokeWidth = 1.5,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}
