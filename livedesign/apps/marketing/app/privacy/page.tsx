import { LegalRedirect } from '@liveworkspace/marketing-site/components/LegalRedirect';
import { privacyMoved } from '@liveworkspace/marketing-site/lib/legal-moved';

// The privacy policy lives on liveworkspace.app: this stub keeps the historical /privacy URL alive, noindex
// (@liveworkspace/marketing-site/lib/legal-moved).
const moved = privacyMoved('livedesign');

export const metadata = moved.metadata;

export default function PrivacyPage() {
  return <LegalRedirect {...moved.redirect} />;
}
