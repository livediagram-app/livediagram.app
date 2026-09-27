import type { AppearanceSetting } from './appearance-store';

// The glyph for the CURRENT setting: sun, moon, or a monitor for System (the device
// deciding). Deliberately not a half-sun / half-moon for System, which reads as
// "between light and dark", the one thing System never is.
export function AppearanceIcon({
  setting,
  size = 14,
}: {
  setting: AppearanceSetting;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {setting === 'dark' ? (
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
      ) : setting === 'system' ? (
        <>
          <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" />
          <path d="M6 14h4" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
        </>
      )}
    </svg>
  );
}
