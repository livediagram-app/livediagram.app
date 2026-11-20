import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { addToPlanMoved as moved } from '@liveworkspace/help-site/lib/moved';

// Add to Plan is gone: a tab's cards stay in the plan they came from. This stub keeps the old URL alive, noindex
// (@liveworkspace/help-site/lib/moved).
export const metadata = moved.metadata;

export default function AddToProjectRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
