import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { movedToLivehuddle } from '@/lib/moved-to-livehuddle';

// Virtual Office moved to livehuddle (Work Tracker #650): this stub sends the old URL to the same article in livehuddle's help, noindex.
const moved = movedToLivehuddle('palette/virtual-office', 'Virtual Office');

export const metadata = moved.metadata;

export default function VirtualOfficeRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
