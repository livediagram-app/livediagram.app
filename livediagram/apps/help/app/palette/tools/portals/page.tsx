import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { movedToLivehuddle } from '@/lib/moved-to-livehuddle';

// Portals moved to livehuddle (Work Tracker 1318): this stub sends the old URL to the same article in livehuddle's help, noindex.
const moved = movedToLivehuddle('palette/tools/portals', 'Portals');

export const metadata = moved.metadata;

export default function PortalsRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
