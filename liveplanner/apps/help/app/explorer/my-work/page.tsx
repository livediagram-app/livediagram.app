import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { myWorkMoved } from '@liveworkspace/help-site/lib/moved';

// The My Work guide moved to personal-space: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = myWorkMoved;

export const metadata = moved.metadata;

export default function MyWorkRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
