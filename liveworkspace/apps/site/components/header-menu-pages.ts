import { proOn } from '@liveworkspace/subscription-ui/flag';

// What the header's menu buttons know without their rows (HeaderMenus): the pages each menu leads to, so a button
// reads as current on one of them. The rows themselves (names, hints, icons) are the open menu's, in its own chunk
// (HeaderMenuSurface), and HeaderMenus.test.tsx holds the two lists to each other.

export type HeaderMenuName = 'Product' | 'Support';

/** The pages a menu's rows lead to (Pricing only where Pro is on in the build). A section of a page is no page. */
export const headerMenuPages = (menu: HeaderMenuName): readonly string[] =>
  menu === 'Support'
    ? ['/help', '/status', '/telemetry']
    : [...(proOn() ? ['/pricing'] : []), '/compare', '/community'];

/** The page a row is for: the same path (`/#apps` is the home page's section, never "current"). */
export const isCurrent = (href: string, path: string | null): boolean =>
  !href.includes('#') && path !== null && (path === href || path.startsWith(`${href}/`));
