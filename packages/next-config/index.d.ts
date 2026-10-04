/** The environment variable that lets a build skip Next's own type check. */
export declare const SKIP_TYPECHECK_ENV: 'BUILD_SKIP_TYPECHECK';

/** Next's `typescript` setting: skips the build's type check only when BUILD_SKIP_TYPECHECK=1. */
export declare function typescriptConfig(env?: NodeJS.ProcessEnv): { ignoreBuildErrors: boolean };
