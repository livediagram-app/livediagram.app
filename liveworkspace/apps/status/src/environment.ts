// Which environment the Worker runs in, which decides each app's address (@liveworkspace/status).

import type { StatusEnvironment } from '@liveworkspace/status';
import type { Env } from './env';

export function environmentOfWorker(env: Env): StatusEnvironment {
  return env.ENVIRONMENT === 'staging' || env.ENVIRONMENT === 'development'
    ? env.ENVIRONMENT
    : 'production';
}
