import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { termsMoved } from '@liveworkspace/help-site/lib/moved';

// The terms are liveworkspace's, on liveworkspace.app: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = termsMoved('livedocuments');

export const metadata = moved.metadata;

export default function TermsRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
