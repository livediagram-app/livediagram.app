// The Microsoft Whiteboard board format's ids (docs/specs/020-import-export/blueprints/
// ms-whiteboard-import.md "Format ids"): node types, trait names and group commands. Meanings were
// established against real boards and their screenshots.

export const MSWB_COMMAND = {
  insert: '441c00a9-8641-5c0a-8963-1e1187a452ff',
  delete: 'bbb1ac6a-a4fd-59ba-9800-230a519a99fe',
  replace: 'bb723ce4-a815-5e5f-9385-be6952869171',
  move: '03e9f4ba-fa67-5d11-9fdc-5647ea4b6537',
  tag: '749ebcf1-7f01-52aa-8fb6-374b8533d65b',
} as const;

/** The traits of a group command node. */
export const MSWB_COMMAND_TRAIT = {
  parent: '892b5431-5362-5a26-b9b6-32099d81b16c',
  trait: 'e5c7f972-7578-560f-a714-01ae181111f9',
  afterSibling: '1cb61f46-fd96-52f3-b03c-48fa9d78c7cf',
  beforeSibling: 'c3936e38-eabe-52a7-bb76-a9decc92a2f6',
  first: 'a1056e79-3904-5fbd-9403-50f5641bf102',
  last: '846bc9a6-e7f1-5a37-b767-6f20fc9a8f11',
  content: '3792af56-b090-5388-b872-932d7b678f72',
  sourceParent: '4947a929-d251-562d-ab82-97f1bc72c7e9',
  sourceTrait: 'de3d4416-be6b-5aca-9a83-659b8473c4d4',
  sourceFirst: '854606b9-6678-5524-9fdf-5df367d03c28',
  sourceLast: 'da7f7bc8-e7bb-53a0-8421-44326b19bb48',
} as const;

export const MSWB_TYPE = {
  root: '0d9fce78-6659-5cc6-b7f5-3865cee3e683',
  layer: '07025d3c-5560-56ae-8594-b7736a93ab82',
  canvas: '45c4a855-5e6c-5871-9370-b57d99b8c7ec',
  number: 'aca37c68-0fe7-5e45-aff6-7de22674768c',
  point: 'b97b9a09-0a67-56ab-ac0d-b8f3194f8be7',
  size: '3482e3ec-ad62-519b-8741-483ba2e81a90',
  argb: '070d4707-df88-5710-a4f7-b0213810971b',
  string: '09b0b613-ba79-513c-89d9-0e176e10e27a',
  paragraph: '6f1f81ab-5a90-5778-bec6-834dd609e88d',
  run: 'e5bf7079-f6a0-5230-a006-266256be2cb8',
  inkGroup: 'b411b923-3baf-5d9b-afe1-3ae7cb671172',
  pen: 'a8d76e89-916e-519f-8541-fc39c149de2f',
  highlighter: 'b4d5e6bc-854c-4730-918d-4ec17b9bd3dc',
  highlighterOld: '6a4b5280-4d81-54bc-b80e-fd8685ce5f94',
  rainbow: 'c9bcc8ed-3515-5b2d-a414-d3d1761faa3d',
  galaxy: '85ca93c8-41da-5c06-901c-66e1eb203d4c',
  penColour: 'b64896c8-92f2-5db1-8986-d434672280b4',
  widthFactor: '00d4ac68-1eb2-5ff6-b6da-ef406361be49',
  strokeTransform: '6a076eb4-41f4-5464-b4c6-be48ac8f3ee5',
  arrowhead: 'fb367356-ea57-58ad-878d-0731dc0bce5f',
  shape: 'ff42e2b3-c846-44e6-934e-51463fc34d7d',
  sticky: '5513b186-c137-5b0e-af1d-6cf4ddf06042',
  textBox: 'e2eb1352-ea16-46ae-8c04-f2c20cfb474a',
  image: '755697df-0ff8-5f2f-85a7-fe0e917d544a',
  imageData: '05c5ba36-9cc2-5f24-a499-6a4538255c2c',
  polygon: '5d2a5253-5f77-5b1f-94eb-374666484adc',
  polygonCorner: '34a5476c-bd1c-5ac7-82df-bd6df556182f',
  line: '346f7b83-5c80-4f88-b7ff-171b3f268189',
  table: '2475d295-6360-5c5d-8f00-63e7da4bca74',
  tableRow: 'a5eed8a8-1651-51e4-829e-365bbbaecd64',
  tableCell: '50e641e8-cd26-5e71-8524-5cdf867be6ca',
  tableColumn: '76849568-2e8a-559e-98e9-1200fbed32cd',
  bold: '96ea80cb-bb66-5975-a397-88de7a0241fe',
  patternPlain: '260365d4-673e-5de9-a028-f3de409641e0',
  patternDots: '4d3677ad-de7c-5f5b-8b7c-f86c2d187d2d',
  patternGrid: '9c59a5b7-56a6-5a7b-b175-087d5c97bd49',
  patternGridSmall: '6abe2936-3d80-5cde-bdf2-6889be6cddad',
} as const;

export const MSWB_TRAIT = {
  children: '3792af56-b090-5388-b872-932d7b678f72',
  background: '655716c0-d840-5168-a0da-a1d94bea65b1',
  pattern: '722196e3-7731-5bf9-8c94-1f123e2ded8c',
  position: '9f0a1333-d832-5aa3-aaeb-41b59a0cefd6',
  size: '8a6fd24a-374d-510c-b335-9b68bf99a9d4',
  scale: 'e2bdf131-8d21-56d1-a5ac-f35c97538af9',
  rotation: '3ab7c67b-df31-5eb2-94c9-8ada52e3f045',
  strokes: 'ba630533-654f-5ea2-be2a-497453e71c53',
  penColour: '2af15da5-7f8e-555f-8c08-27561a474b94',
  widthFactor: '267ca674-603c-5989-89b9-5897a4a05c2b',
  strokeTransform: 'c19b7df9-5ac1-58dc-a47e-81cf38693b98',
  arrowhead: 'c3bc3cdf-7130-549f-98d7-d5382aeceb88',
  borderWidth: 'aa928acd-8d78-4349-9ebf-6d9fca6f7322',
  dash: 'd65544d0-bd49-4323-9d11-98eb641a676b',
  border: '62e5abb3-911a-43b0-8a45-33d6af42ac5d',
  fill: 'e74bfd74-def1-4ee8-828b-d947618dc704',
  fontSize: '40c74b3e-5047-5299-bff2-ddba7aa24e77',
  weight: '812d483d-b520-51c8-a804-201735f6884e',
  stickyColour: 'a0c280c8-524b-5d1e-8e36-131ce1e9ad02',
  textColour: '0f583d72-8a15-52b2-9d43-046e22c38eb1',
  corners: '37d84524-4ee6-55b6-988a-318fbdeaf32e',
  cornerPoint: '0a88f78d-ab7d-59dc-af78-424671fecd15',
  polygonColour: '408bc500-6f89-5593-af3d-501cfee7d800',
  lineFrom: '09c872f3-870d-4d1d-b4fc-4226a5946a4a',
  lineTo: '1b229c3e-05cc-4459-9b8d-716257847ef4',
  lineStartHead: '2ba03b2d-a09f-443c-8d1f-7516dd3f61ca',
  lineEndHead: 'fdf5881e-eaf8-4da5-a76d-f3e076162c98',
  tableRows: '243dd2a3-c2cb-5144-acba-d37a46fe596f',
  tableColumns: 'e6567acf-f160-593d-8579-ed172eb65e63',
  tableExtent: 'e2924564-bd9a-5670-bfcd-70e5f8f1a17d',
  tableCells: 'a7f5ea95-53ef-446c-befd-c7238baa4074',
  tableCellContent: 'e49ea96b-28b2-5893-b64e-2369f9d44a76',
  tableColour: 'a700d4b8-8acf-5fa5-b6e6-9fb2bb6094f6',
} as const;

/** Text colours by their enum value (measured on real boards; absent reads as black). */
export const MSWB_TEXT_COLOURS: Readonly<Record<string, string>> = {
  '23e4c5b5-0075-5efd-9280-7d74284f25e2': '#000000',
  'e080b312-5dd0-5e57-9724-cab19de4cad2': '#ffffff',
  '11a3662a-83e7-558a-be1b-e3a38e9f8b95': '#f6630c',
  'c3b75d94-4004-5414-a7a0-aaec40014a3a': '#ffc114',
  '990619c3-723e-5ada-b8cc-1a6ae5dee48a': '#02a556',
  '5b8ca61a-66cf-5b8a-9731-090244905e56': '#0069bf',
};

/** Whiteboard's default note colour; the only sticky colour value real boards hold. */
export const MSWB_STICKY_YELLOW = '#f6dc67';
