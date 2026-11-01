// The Isometric pattern's 28x20 preview for livediagram's pattern picker (./palette-patterns). Isometric is
// livediagram's alone, so its glyph lives here rather than beside the shared ones in
// @liveworkspace/workbench/components/primitives/background-pattern-icons, and follows the same visual contract:
// a rounded frame stroked at currentColor and the motif inside.

export function BackgroundIsometricIcon() {
  // Two shallow (~30°) diagonal families forming isometric rhombi.
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[-2, 12, 26].map((x) => (
        <line
          key={`u${x}`}
          x1={x}
          y1="20"
          x2={x + 22}
          y2="0"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      ))}
      {[-22, -8, 6].map((x) => (
        <line
          key={`d${x}`}
          x1={x}
          y1="0"
          x2={x + 22}
          y2="20"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}
