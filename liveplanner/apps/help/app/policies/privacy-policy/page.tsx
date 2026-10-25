import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { privacyPolicyMoved } from '@liveworkspace/help-site/lib/moved';

// The privacy policy is liveworkspace's, on liveworkspace.app: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = privacyPolicyMoved('liveplanner');

export const metadata = moved.metadata;

export default function PrivacyPolicyRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
