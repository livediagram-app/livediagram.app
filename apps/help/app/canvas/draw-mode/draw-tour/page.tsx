import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// The Draw Tour is the Drawing Tour (docs/specs/023-drawing-mode/drawing-tour.md), and its article moved with the
// name. This stub keeps the old help URL alive (it redirects there) but is noindex, so search engines consolidate on
// the canonical article rather than this thin redirect.
const NEW_URL = '/help/canvas/drawing-mode/drawing-tour/';

export const metadata: Metadata = {
  title: 'The Drawing Tour',
  description: 'The Draw Tour is now the Drawing Tour: a short walkthrough of the Drawing dock.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function DrawTourRedirectPage() {
  return <Redirect href={NEW_URL} label="Drawing Tour guide" />;
}
