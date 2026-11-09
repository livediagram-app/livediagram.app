import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { movedToLivehuddle } from '@/lib/moved-to-livehuddle';

// Avatar Mode moved to livehuddle (Work Tracker #650): this stub sends the old URL to the same article in livehuddle's help, noindex.
const moved = movedToLivehuddle('selection-modes/avatar-mode', 'Avatar Mode');

export const metadata = moved.metadata;

export default function AvatarModeRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
