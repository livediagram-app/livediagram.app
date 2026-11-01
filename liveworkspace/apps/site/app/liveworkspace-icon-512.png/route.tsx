import { installIconResponse } from '@/lib/install-icon';

// The 512-pixel icon the manifest names, for a home screen's splash (site.md "Installing").
export const dynamic = 'force-static';

export function GET(): Response {
  return installIconResponse(512);
}
