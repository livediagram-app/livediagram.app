import type { Metadata } from 'next';

// The help URLs that have moved (docs/specs/018-help/help-pages.md). The help app is a static export, so a retired
// path keeps resolving through a stub page that renders `Redirect` with `href` and `label`. Each stub is noindex and
// names the new page canonical, so search engines consolidate on it rather than on the thin redirect.
//
// What a stub says is the same in every product but for the product's name or what it calls its work; those come in
// as arguments. The page file stays in each app (the app router needs it) and reads:
//
//   const moved = termsMoved('livedesign');
//   export const metadata = moved.metadata;
//   export default function TermsRedirectPage() {
//     return <Redirect href={moved.href} label={moved.label} />;
//   }

/** A moved help URL: where it goes, the words of its fallback link, and the stub's metadata. */
export interface MovedPage {
  /** An absolute path including the `/help` basePath, or a full URL. */
  href: string;
  /** The fallback link reads "read the {label} here". */
  label: string;
  metadata: Metadata;
}

function moved(href: string, label: string, title: string, description: string): MovedPage {
  return {
    href,
    label,
    metadata: {
      title,
      description,
      robots: { index: false, follow: true },
      alternates: { canonical: href },
    },
  };
}

// The policies cover every liveworkspace app, so they live on liveworkspace.app (for now its workers.dev gateway).
const LIVEWORKSPACE_URL = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev';

/** /help/policies/privacy-policy and /help/privacy-and-security/privacy-policy: liveworkspace.app's privacy policy. */
export function privacyPolicyMoved(product: string): MovedPage {
  return moved(
    `${LIVEWORKSPACE_URL}/privacy`,
    'privacy policy',
    'Privacy Policy',
    `The privacy policy for ${product} is liveworkspace's, on liveworkspace.app.`,
  );
}

/** /help/policies/terms: liveworkspace.app's terms of service. */
export function termsMoved(product: string): MovedPage {
  return moved(
    `${LIVEWORKSPACE_URL}/terms`,
    'terms of service',
    'Terms of Service',
    `The terms of service for ${product} are liveworkspace's, on liveworkspace.app.`,
  );
}

/** /help/explorer/my-work: the space was "My Work", became "My <work>", and is "My Work" again
 *  (docs/specs/013-workspace); its article moved to personal-space along the way. */
export const myWorkMoved: MovedPage = moved(
  '/help/explorer/personal-space/',
  'My Work guide',
  'My Work and Folders',
  'The My Work guide has moved.',
);

/** /help/explorer/unsorted: Unsorted is gone (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets).
 *  Work with no folder sits at the root of My Work, and the article went with it. `work` is what the product calls
 *  its work, plural (`designs`, `plans`). */
export function unsortedMoved(work: string): MovedPage {
  return moved(
    '/help/explorer/personal-space/',
    'My Work guide',
    'My Work and Folders',
    `Unsorted is gone: ${work} with no folder sit at the root of My Work.`,
  );
}

/** /help/palette/favourites: Favourites is gone (docs/specs/010-palette/palette-favourites.md), and so is Popular,
 *  which replaced it: the palette's categories sit on the strip, each one press away. */
export const favouritesMoved: MovedPage = moved(
  '/help/palette/toolbar-layout/',
  'Toolbar Layout guide',
  'Toolbar Layout',
  'Favourites is gone: the palette shows its categories on the strip, each one press away.',
);

/** /help/palette/popular: Popular is gone from the palette (docs/specs/007-editor/toolbar-layout.md "The category
 *  bar"): the strip shows every category by name, each one press away, so a pick from across them added nothing. */
export const popularMoved: MovedPage = moved(
  '/help/palette/toolbar-layout/',
  'Toolbar Layout guide',
  'Toolbar Layout',
  'Popular is gone: the palette shows its categories on the strip, each one press away.',
);
