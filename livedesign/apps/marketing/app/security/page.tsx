import { LegalRedirect } from '@liveworkspace/marketing-site/components/LegalRedirect';
import { securityMoved } from '@liveworkspace/marketing-site/lib/legal-moved';

// The disclosure policy lives in the help centre: this stub keeps the historical /security URL alive, noindex
// (@liveworkspace/marketing-site/lib/legal-moved).
const moved = securityMoved('livedesign');

export const metadata = moved.metadata;

export default function SecurityPage() {
  return <LegalRedirect {...moved.redirect} />;
}
