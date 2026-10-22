import { describe, expect, it } from 'vitest';
import { projectPath } from './project-paths';

describe('projectPath', () => {
  it("is the project's page in the editor, its id encoded", () => {
    expect(projectPath('abc-123')).toBe('/project/abc-123');
    expect(projectPath('a/b c')).toBe('/project/a%2Fb%20c');
  });
});
