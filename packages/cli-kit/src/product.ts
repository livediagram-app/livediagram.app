// What a product's CLI is, as the shared modules need it: the command and the names that follow from it.

export type CliProduct = {
  // The command, and the name its config and cache directories, keychain entries and sign-in pages go by
  // ('livediagram'). Its requests say `X-<Name>-Client: cli` and `User-Agent: <name>-cli/<version>`.
  readonly name: string;
  // Its environment variables' prefix: `<PREFIX>_TOKEN`, `<PREFIX>_DEBUG`.
  readonly envPrefix: string;
  // The package npm publishes it under ('@livediagram/cli').
  readonly npmPackage: string;
  // The CLI's own version.
  readonly version: string;
  // The OAuth client it signs in as, built into its host's authorization server.
  readonly clientId: string;
};
