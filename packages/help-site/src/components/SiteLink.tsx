'use client';

import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';
import { siteHref } from '../lib/site-href';

// A plain link to another site's address that stays in the page's deployment (lib/site-href.ts): the server renders
// the live (or local) address; once hydrated, a staging page links the staging one. For links a server component
// draws (Pick an App, the All Apps header); a client component reads useSiteHref instead.

const subscribeNever = () => () => {};
const pageHost = () => window.location.host;
const noHost = () => '';

/** `(href) => href` as this page's deployment links it (lib/site-href.ts), live until hydrated. */
export function useSiteHref(): (href: string) => string {
  const host = useSyncExternalStore(subscribeNever, pageHost, noHost);
  return (href) => siteHref(href, host);
}

export function SiteLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const to = useSiteHref();
  return <a href={to(href)} {...props} />;
}
