// Which of the Worker's crons a run is (wrangler.toml, liveworkspace/docs/specs/003-accounts/blueprints/accounts.md
// "The crons"): the 15-minute one, or the hourly one, whose 09:17 UTC run also does the once-a-day steps.
import type { Env } from './env.ts';
import { PURGE_RETRY_CRON } from './index-purge.ts';

// The UTC hour of the hourly cron's run that does the daily steps (the token Timeline notes, idle guests).
export const DAILY_RUN_HOUR_UTC = 9;

export function cronRun(controller: Pick<ScheduledController, 'cron' | 'scheduledTime'>): {
  hourly: boolean;
  daily: boolean;
} {
  const hourly = controller.cron !== PURGE_RETRY_CRON;
  return {
    hourly,
    daily: hourly && new Date(controller.scheduledTime).getUTCHours() === DAILY_RUN_HOUR_UTC,
  };
}

// Whether an email can go: the EMAIL binding, or development, which logs each one instead. Without either, the
// sweeps that email send and stamp nothing, so a self-hosted deployment with no email stays quiet.
export function canSendEmail(env: Pick<Env, 'EMAIL' | 'ENVIRONMENT'>): boolean {
  return Boolean(env.EMAIL) || env.ENVIRONMENT === 'development';
}
