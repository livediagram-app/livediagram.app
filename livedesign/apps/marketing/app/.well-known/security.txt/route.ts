import { securityTxt } from '@/lib/security-txt';

// Required for `output: 'export'` (see app/robots.ts): resolved once at build
// time into out/.well-known/security.txt.
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(securityTxt(new Date()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
