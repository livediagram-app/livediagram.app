import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { movedToLivehuddle } from '@/lib/moved-to-livehuddle';

// Avatar Pads moved to livehuddle (Work Tracker #650): this stub sends the old URL to the same article in livehuddle's help, noindex.
const moved = movedToLivehuddle('palette/avatar-pads', 'Avatar Pads');

export const metadata = moved.metadata;

export default function AvatarPadsRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
