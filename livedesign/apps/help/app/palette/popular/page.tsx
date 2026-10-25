import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { popularMoved } from '@liveworkspace/help-site/lib/moved';

// Popular is gone; its guide is toolbar-layout: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = popularMoved;

export const metadata = moved.metadata;

export default function PopularRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
