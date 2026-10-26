// The marketing site's retired legal URLs, the same in every product but for its name. /terms and /privacy keep
// working by sending visitors to liveworkspace.app, whose terms and privacy policy cover every liveworkspace app;
// /security is the short, guessable URL researchers try first, so it sends them to the help centre's disclosure
// policy (docs/specs/002-project-scope/vulnerability-disclosure.md). Each stub is noindex and names its target
// canonical, so search engines consolidate on that page.
//
// The page file stays in each app (the app router needs it) and reads:
//
//   const moved = termsMoved('livedesign');
//   export const metadata = moved.metadata;
//   export default function TermsPage() {
//     return <LegalRedirect {...moved.redirect} />;
//   }

/** A moved legal page: its stub's metadata and what its `LegalRedirect` says. */
export interface LegalMovedPage {
  metadata: {
    title: string;
    description: string;
    robots: { index: false; follow: true };
    alternates: { canonical: string };
  };
  redirect: { href: string; heading: string; linkText: string; lead: string };
}

// The policies live on liveworkspace.app.
const LIVEWORKSPACE_URL = 'https://liveworkspace.app';

function moved(
  title: string,
  description: string,
  redirect: LegalMovedPage['redirect'],
): LegalMovedPage {
  return {
    metadata: {
      title,
      description,
      robots: { index: false, follow: true },
      alternates: { canonical: redirect.href },
    },
    redirect,
  };
}

/** /privacy: liveworkspace.app's privacy policy. */
export function privacyMoved(product: string): LegalMovedPage {
  return moved(
    `Privacy Policy · ${product}`,
    `The privacy policy for ${product} is liveworkspace's, on liveworkspace.app.`,
    {
      href: `${LIVEWORKSPACE_URL}/privacy`,
      heading: 'Our privacy policy has moved',
      linkText: 'read the privacy policy here',
      lead: 'It now lives on liveworkspace.app and covers every liveworkspace app.',
    },
  );
}

/** /terms: liveworkspace.app's terms of use. */
export function termsMoved(product: string): LegalMovedPage {
  return moved(
    `Terms of Use · ${product}`,
    `The terms of use for ${product} are liveworkspace's, on liveworkspace.app.`,
    {
      href: `${LIVEWORKSPACE_URL}/terms`,
      heading: 'Our terms of use have moved',
      linkText: 'read the terms of use here',
      lead: 'They now live on liveworkspace.app and cover every liveworkspace app.',
    },
  );
}

/** /security: the vulnerability disclosure policy, in the help centre's Policies. */
export function securityMoved(product: string): LegalMovedPage {
  return moved(`Security · ${product}`, `How to report a security vulnerability in ${product}.`, {
    href: '/help/policies/report-a-vulnerability/',
    heading: 'Found a security vulnerability?',
    linkText: 'read how to report it privately',
    lead: 'Our disclosure policy lives in the help centre.',
  });
}
