// The sign-in providers' brand marks, one function each. Kept apart from the
// auth chrome that renders them because a brand glyph is somebody else's fixed
// artwork: its own colours, its own provenance, its own reasons to change — none
// of which the surrounding form shares.
//
// Each is sized by the class its button passes, so no page scales a mark by hand.

// ---------------------------------------------------------------------
// Google. The four official colours of the "Sign in with Google" mark
// (4285F4 / 34A853 / FBBC05 / EA4335).
// ---------------------------------------------------------------------

export function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Feishu (Lark). The mark is two quadrilaterals; the geometry is IconPark's
// `lark` icon — ByteDance's own Apache-2.0 icon set
// (https://iconpark.oceanengine.com) — filled flat in the brand blue #3370FF
// rather than with the logo's gradient, so it reads the same on the button's
// light and dark surfaces. Shown only on a deployment that offers the provider
// (apps/server/src/main.ts answers which ones it does).
// ---------------------------------------------------------------------

export function FeishuGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#3370FF"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M41.0716 5.99409L3.31071 16.5187L12.3856 25.8126L20.7998 25.9594L30.4827 16.5187C30.2266 15.9943 30.0985 15.5552 30.0985 15.2013C30.0985 14.4074 30.4104 13.7786 30.8947 13.333C31.7241 12.57 32.7222 12.4558 33.8889 12.9905L41.0716 5.99409Z"
      />
      <path
        fill="#3370FF"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M42.1021 6.72842L31.5775 44.4893L22.2836 35.4144L22.1367 27.0002L31.5115 17.4816C32.0195 17.8454 32.5743 18.0105 33.1759 17.9769C34.0784 17.9264 34.6614 17.3813 34.9349 17.0602C35.2083 16.7392 35.5293 16.2051 35.5025 15.4113C35.4847 14.8821 35.3109 14.3941 34.9812 13.9472L42.1021 6.72842Z"
      />
    </svg>
  );
}
