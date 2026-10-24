import { describe, expect, it } from 'vitest';

import { detectLicenceId, isLicenceAllowed, licenceFromManifest } from './licence-id.ts';

const MIT = `Copyright (c) 2020 Someone

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal`;
const ISC = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that`;
const APACHE = `                                 Apache License
                           Version 2.0, January 2004`;
const BSD2 = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:`;
const BSD3 = `${BSD2}
3. Neither the name of the copyright holder nor the names of its contributors`;

describe('licenceFromManifest', () => {
  it.each([
    [{ license: 'MIT' }, 'MIT'],
    [{ license: '(MIT OR CC0-1.0)' }, '(MIT OR CC0-1.0)'],
    [{ license: { type: 'BSD-3-Clause' } }, 'BSD-3-Clause'],
    [{ licenses: [{ type: 'MIT' }] }, 'MIT'],
    [{ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] }, '(MIT OR Apache-2.0)'],
  ])('reads %j', (manifest, id) => {
    expect(licenceFromManifest(manifest)).toBe(id);
  });

  it.each([
    [{}],
    [{ license: 'SEE LICENSE IN LICENSE.md' }],
    [{ license: 'see licence in COPYING' }],
    [{ license: '' }],
    [{ license: { type: 3 } }],
    [{ licenses: [] }],
    [{ licenses: [{ kind: 'MIT' }] }],
  ])('has nothing usable in %j', (manifest) => {
    expect(licenceFromManifest(manifest)).toBeUndefined();
  });
});

describe('detectLicenceId', () => {
  it.each([
    [MIT, 'MIT'],
    [ISC, 'ISC'],
    [APACHE, 'Apache-2.0'],
    [BSD2, 'BSD-2-Clause'],
    [BSD3, 'BSD-3-Clause'],
  ])('recognises %#', (text, id) => {
    expect(detectLicenceId(text)).toBe(id);
  });

  it('recognises nothing in unknown text', () => {
    expect(detectLicenceId('All rights reserved.')).toBeUndefined();
  });

  it('refuses to guess between two licences in one text', () => {
    expect(detectLicenceId(`${MIT}\n\n${APACHE}`)).toBeUndefined();
  });
});

describe('isLicenceAllowed', () => {
  it.each([
    'MIT',
    'Apache-2.0',
    '(MIT OR CC0-1.0)',
    'Apache-2.0 AND MIT',
    'MIT OR GPL-3.0-only',
    '(GPL-3.0-only OR (MIT AND ISC))',
    'Apache-2.0 WITH LLVM-exception',
    'Apache-2.0+',
    'mit or isc',
  ])('allows %s', (expr) => {
    expect(isLicenceAllowed(expr)).toBe(true);
  });

  it.each([
    'UNLICENSED',
    'GPL-3.0-only',
    'LGPL-3.0-or-later',
    'MIT AND GPL-3.0-only',
    'Proprietary',
    '(MIT',
    'MIT OR',
    'MIT)',
    '',
    'WITH MIT',
    'MIT WITH',
  ])('refuses %s', (expr) => {
    expect(isLicenceAllowed(expr)).toBe(false);
  });
});
