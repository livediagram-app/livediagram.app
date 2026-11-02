import { installIconResponse } from '@/lib/install-icon';

// The 256-pixel icon the manifest and the push-only worker's notifications name (site.md "Installing").
export const dynamic = 'force-static';

export function GET(): Response {
  return installIconResponse(256);
}
