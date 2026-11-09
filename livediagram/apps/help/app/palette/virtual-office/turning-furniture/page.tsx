import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { movedToLivehuddle } from '@/lib/moved-to-livehuddle';

// Turning Furniture moved to livehuddle (Work Tracker #650): this stub sends the old URL to the same article in livehuddle's help, noindex.
const moved = movedToLivehuddle('palette/virtual-office/turning-furniture', 'Turning Furniture');

export const metadata = moved.metadata;

export default function TurningFurnitureRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
