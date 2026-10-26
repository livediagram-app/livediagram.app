import { LegalRedirect } from '@liveworkspace/marketing-site/components/LegalRedirect';
import { termsMoved } from '@liveworkspace/marketing-site/lib/legal-moved';

// The terms of use live on liveworkspace.app: this stub keeps the historical /terms URL alive, noindex
// (@liveworkspace/marketing-site/lib/legal-moved).
const moved = termsMoved('livedesign');

export const metadata = moved.metadata;

export default function TermsPage() {
  return <LegalRedirect {...moved.redirect} />;
}
