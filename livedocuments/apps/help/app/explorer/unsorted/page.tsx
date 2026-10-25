import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { unsortedMoved } from '@liveworkspace/help-site/lib/moved';

// Unsorted is gone; its guide is personal-space: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = unsortedMoved('documents');

export const metadata = moved.metadata;

export default function UnsortedRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
