/** The environment variable that lets a build skip Next's own type check. */
export declare const SKIP_TYPECHECK_ENV: 'BUILD_SKIP_TYPECHECK';

/** Next's `typescript` setting: skips the build's type check only when BUILD_SKIP_TYPECHECK=1. */
export declare function typescriptConfig(env?: NodeJS.ProcessEnv): { ignoreBuildErrors: boolean };

/** Whether this build runs under Turbopack (Next sets `TURBOPACK` before loading the config). */
export declare function isTurbopack(env?: NodeJS.ProcessEnv): boolean;

/** The settings every Next app shares; an app spreads this and adds only what is its own. */
export declare function liveworkspaceNextConfig(options?: {
  env?: NodeJS.ProcessEnv;
  exportInDev?: boolean;
  /** Run the React Compiler (Rust port, under Turbopack only). The editor alone sets it. */
  reactCompiler?: boolean;
  now?: Date;
}): import('next').NextConfig;
