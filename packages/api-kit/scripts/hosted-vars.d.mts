// Types for hosted-vars.mjs, which stays plain JavaScript so the deploy runs it on any Node.

export type HostedEnvironment = 'production' | 'staging';

export interface HostedProfile {
  shared: Record<string, string>;
  environments: Record<HostedEnvironment, Record<string, string>>;
}

export interface VarDrift {
  name: string;
  expected: string;
  actual: string | null;
}

export function readHostedProfile(path: string): HostedProfile;
export function hostedEnvironment(wranglerEnv: string): HostedEnvironment;
export function resolveHostedVars(
  profile: HostedProfile,
  environment: HostedEnvironment,
): { vars: Record<string, string>; unset: string[] };
export function splitEnvArg(args: readonly string[]): { wranglerEnv: string; rest: string[] };
export function wranglerVarFlags(vars: Record<string, string>): string[];
export function buildEnv(vars: Record<string, string>): string[];
export function activeVersionIds(status: unknown): string[];
export function plainVars(view: unknown): Map<string, string>;
export function unsetVarDrift(unset: readonly string[], deployed: Map<string, string>): VarDrift[];
export function hostedVarDrift(
  expected: Record<string, string>,
  deployed: Map<string, string>,
): VarDrift[];
export function runHostedVars(
  argv: readonly string[],
  path: string,
  wranglerJson?: (args: string[]) => unknown,
): number;
