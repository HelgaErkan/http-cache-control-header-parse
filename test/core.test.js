import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDirective,
  parseCacheControl,
  getDeltaSeconds,
  findDirective,
} from '../src/index.js';

test('parseDirective splits a bare token', () => {
  assert.deepEqual(parseDirective('no-store'), { name: 'no-store', value: null });
});

test('parseDirective lowercases the name but preserves the value', () => {
  assert.deepEqual(parseDirective('Max-Age=600'), { name: 'max-age', value: '600' });
});

test('parseDirective trims surrounding whitespace', () => {
  assert.deepEqual(parseDirective('  no-cache  '), { name: 'no-cache', value: null });
});

test('parseDirective keeps a quoted value verbatim', () => {
  assert.deepEqual(parseDirective('no-cache="Set-Cookie, X-Other"'), {
    name: 'no-cache',
    value: '"Set-Cookie, X-Other"',
  });
});

test('parseDirective rejects an empty string', () => {
  assert.throws(() => parseDirective(''), SyntaxError);
});

test('parseDirective rejects a directive with an embedded space in the name', () => {
  assert.throws(() => parseDirective('no cache'), SyntaxError);
});

test('parseDirective requires a string argument', () => {
  assert.throws(() => parseDirective(42), TypeError);
});

test('parseCacheControl handles a list of directives', () => {
  assert.deepEqual(parseCacheControl('no-store, max-age=0, must-revalidate'), [
    { name: 'no-store', value: null },
    { name: 'max-age', value: '0' },
    { name: 'must-revalidate', value: null },
  ]);
});

test('parseCacheControl ignores empty slices from trailing commas', () => {
  assert.deepEqual(parseCacheControl('no-store, , max-age=60,'), [
    { name: 'no-store', value: null },
    { name: 'max-age', value: '60' },
  ]);
});

test('parseCacheControl keeps commas inside quoted values', () => {
  assert.deepEqual(parseCacheControl('no-cache="a,b", max-age=30'), [
    { name: 'no-cache', value: '"a,b"' },
    { name: 'max-age', value: '30' },
  ]);
});

test('parseCacheControl keeps escaped quotes inside quoted values', () => {
  assert.deepEqual(parseCacheControl('private="a\\"b", max-age=5'), [
    { name: 'private', value: '"a\\"b"' },
    { name: 'max-age', value: '5' },
  ]);
});

test('parseCacheControl rejects an unterminated quoted string', () => {
  assert.throws(() => parseCacheControl('no-cache="unterminated'), SyntaxError);
});

test('parseCacheControl requires a string argument', () => {
  assert.throws(() => parseCacheControl(null), TypeError);
});

test('getDeltaSeconds returns the integer for a numeric value', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: '600' }), 600);
});

test('getDeltaSeconds accepts a quoted numeric value', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: '"600"' }), 600);
});

test('getDeltaSeconds returns null when the directive has no value', () => {
  assert.equal(getDeltaSeconds({ name: 'no-store', value: null }), null);
});

test('getDeltaSeconds returns null for a non-numeric value', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: 'abc' }), null);
});

test('getDeltaSeconds returns null for a negative value', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: '-1' }), null);
});

test('getDeltaSeconds returns null for a decimal value', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: '1.5' }), null);
});

test('getDeltaSeconds returns null when the value overflows a safe integer', () => {
  assert.equal(getDeltaSeconds({ name: 'max-age', value: '99999999999999999999' }), null);
});

test('getDeltaSeconds requires a directive object', () => {
  assert.throws(() => getDeltaSeconds('max-age=60'), TypeError);
});

test('findDirective returns the first matching directive', () => {
  const directives = parseCacheControl('max-age=60, max-age=120');
  assert.deepEqual(findDirective(directives, 'max-age'), { name: 'max-age', value: '60' });
});

test('findDirective is case-insensitive', () => {
  const directives = parseCacheControl('No-Store');
  assert.deepEqual(findDirective(directives, 'no-store'), { name: 'no-store', value: null });
});

test('findDirective returns null when nothing matches', () => {
  const directives = parseCacheControl('no-store');
  assert.equal(findDirective(directives, 'max-age'), null);
});

test('findDirective requires an array', () => {
  assert.throws(() => findDirective('no-store', 'no-store'), TypeError);
});
