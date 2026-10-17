import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// Draw mode is Drawing mode (docs/specs/023-drawing-mode/drawing-mode.md), and its article moved with the name.
// This stub keeps the old help URL alive (it redirects there) but is noindex, so search engines consolidate on
// the canonical article rather than this thin redirect.
const NEW_URL = '/help/canvas/drawing-mode/';

export const metadata: Metadata = {
  title: 'Drawing Mode',
  description: 'Draw mode is now Drawing mode: sketch by hand with pens, erasers and shapes.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function DrawModeRedirectPage() {
  return <Redirect href={NEW_URL} label="Drawing Mode guide" />;
}
