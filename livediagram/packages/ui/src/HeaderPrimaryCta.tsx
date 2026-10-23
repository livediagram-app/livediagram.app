'use client';

import { ctaHref, type CtaSurface } from '@livediagram/api-schema';
import { useSyncExternalStore } from 'react';
import { signedInFromCookie } from './browser-repair/identity';
import { ButtonContent, buttonClassName } from './Button';

// The site header's primary (docs/specs/019-marketing/marketing-site.md "Header"): Choose Template
// (/new, the encouraged wizard path) for a visitor, Open Explorer (their documents) for someone signed
// in. Who is signed in comes from the api's readable `ld_signed_in` hint cookie, so the public
// sites never load the session; it only picks a link, it authenticates nothing. The static
// HTML is Choose Template for everyone, and both labels share one cell sized to the wider, so the swap
// after hydration moves nothing in the bar.

export const EXPLORER_HOME_HREF = '/explorer/home';

const noSubscription = () => () => {};
const signedInNow = () => signedInFromCookie(document.cookie) === true;
const signedOutOnServer = () => false;

// Whether the hint cookie says someone is signed in: false in the static HTML, read after hydration.
export function useSignedInHint(): boolean {
  return useSyncExternalStore(noSubscription, signedInNow, signedOutOnServer);
}

export function HeaderPrimaryCta({ ctaSurface }: { ctaSurface?: CtaSurface }) {
  const signedIn = useSignedInHint();
  const href = signedIn
    ? EXPLORER_HOME_HREF
    : ctaSurface
      ? ctaHref('/new', `${ctaSurface}.Header`)
      : '/new';
  const name = signedIn ? 'Open Explorer' : 'Choose Template';
  // Below 380px each label drops its verb so the bar fits a 320px phone; the aria-label keeps it.
  const label = (verb: string, noun: string) => (
    <>
      <span className="max-[379px]:hidden">{verb} </span>
      {noun}
    </>
  );
  return (
    <a
      href={href}
      aria-label={name}
      className={buttonClassName({
        size: 'md',
        // A transparent border, so it is the height of Start Blank (a bordered secondary) beside it.
        className: 'relative shrink-0 border border-transparent shadow-sm touch-target-y',
      })}
    >
      <ButtonContent>
        <span className="grid justify-items-center">
          <span className={`text-optical-line [grid-area:1/1] ${signedIn ? 'invisible' : ''}`}>
            {label('Choose', 'Template')}
          </span>
          <span
            aria-hidden
            className={`text-optical-line [grid-area:1/1] ${signedIn ? '' : 'invisible'}`}
          >
            {label('Open', 'Explorer')}
          </span>
        </span>
      </ButtonContent>
    </a>
  );
}
