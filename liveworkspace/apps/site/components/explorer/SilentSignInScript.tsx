'use client';

import { trustedHtml } from '@liveworkspace/trusted-types';

// The Explorer's silent sign-in on an app's own address (lib/explorer/silent.ts), as the first thing its layout
// renders. A client component on purpose (livediagram/docs/specs/016-platform/trusted-types.md "Server-rendered
// markup"): when React renders this <script> in the browser (a client navigation into /explorer) it writes the
// source through `innerHTML`, which the page's Trusted Types header refuses unless it is `TrustedHTML` minted here, in
// the browser. Written from a server component, the prerender (no Trusted Types) handed it a plain string, the
// `default` policy refused it and the whole Explorer crashed to a blank page. Its one source is the build's own
// script, from explorerSilentSignInScript.
export function SilentSignInScript({ source }: { source: string }) {
  return <script dangerouslySetInnerHTML={{ __html: trustedHtml(source) }} />;
}
