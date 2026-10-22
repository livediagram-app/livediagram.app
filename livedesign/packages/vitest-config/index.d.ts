import type { UserConfig } from 'vitest/config';

/** Shared Vitest defaults for every workspace. See docs/specs/003-system-architecture/testing.md. */
export declare const baseConfig: UserConfig;

/** Merge the shared base config with per-workspace overrides. */
export declare function defineProject(overrides?: UserConfig): UserConfig;
