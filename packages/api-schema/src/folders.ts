// Folders (docs/specs/013-workspace/folders.md): every product's folder row, as the api lists it.

// A folder row. `parentId === null` means the folder lives at the
// tree root. `teamId` (docs/specs/013-workspace/team-shared-documents.md): null = a personal folder gated on
// `ownerId`; non-null = a folder in that team's shared library,
// gated on joined membership (ownerId then records the creator for
// audit only).
export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  teamId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
};
