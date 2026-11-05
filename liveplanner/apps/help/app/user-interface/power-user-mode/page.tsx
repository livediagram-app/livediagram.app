import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { powerUserModeMoved as moved } from '@liveworkspace/help-site/lib/moved';

// Power User Mode is gone; Settings lists every setting: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
export const metadata = moved.metadata;

export default function PowerUserModeRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
