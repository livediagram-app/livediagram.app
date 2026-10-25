'use client';

import { FaqBrowser as SharedFaqBrowser } from '@liveworkspace/marketing-site/components/faq/FaqBrowser';

import { FAQ_CATEGORIES } from '@/lib/faq-content';

// The /faq page body (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): the shared browser, with
// livedesign's questions. A client module, since the categories hold icons and JSX answers a server page cannot pass.
export function FaqBrowser(props: { eyebrow: string; title: string; lede: string }) {
  return <SharedFaqBrowser categories={FAQ_CATEGORIES} {...props} />;
}
