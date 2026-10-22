// A project's own page in the editor (the router serves the editor at /project/<id>).
export function projectPath(projectId: string): string {
  return `/project/${encodeURIComponent(projectId)}`;
}
