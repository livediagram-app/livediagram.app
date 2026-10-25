import type { Env } from './env.ts';

// The app APIs this Worker issues access tokens for. Each becomes a token's `aud`, so a
// token minted for one app is refused by every other app's API.
// Adding an app means adding its API here and registering it (README "Adding an app").
export const RESOURCES: Record<Env['ENVIRONMENT'], string[]> = {
  production: [
    'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
    'https://liveplanner.app/api',
    'https://livedocuments.app/api',
    'https://livedesign.app/api',
  ],
  staging: [
    'https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api',
    'https://staging.liveplanner.app/api',
    'https://staging.livedocuments.app/api',
    'https://staging.livedesign.app/api',
  ],
  development: ['http://localhost/api'],
};
