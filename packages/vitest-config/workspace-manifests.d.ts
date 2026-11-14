/** One workspace's package.json, as read. */
export interface WorkspaceManifest {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
/** The package.json of every workspace under a product folder's apps/ and packages/. See workspace-manifests.js. */
export declare function workspaceManifests(root: string | URL): WorkspaceManifest[];
