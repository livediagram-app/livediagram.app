# Folder content previews

A folder card in the shared Explorer previews what is inside it: a small mosaic of the item pictures it holds and its
subfolders, with its counts ("1 folder · 5 canvases"). The index answers them in batches (`GET /folders/previews`,
one request per batch of up to 60 cards not yet answered), and each canvas's picture is its preview from liveworkspace's previews service, `GET /api/previews/items/:id`
([liveworkspace/docs/previews.md](../../../../liveworkspace/docs/previews.md)), which livediagram draws through its
export door ([Document SVG snapshots](../006-document/document-snapshots.md)).

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, favourites, defaults". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
