'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const utimensat = require('..');
const { lutimensat } = utimensat;

test('preserves the default export and provides named functions', () => {
  assert.equal(utimensat.utimensat, utimensat);
  assert.equal(typeof lutimensat, 'function');
});

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'utimensat-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '时间.txt');
  fs.writeFileSync(file, 'test');
  return { dir, file };
}

test('lutimensat updates the link, preserves omitted times and leaves target unchanged', (t) => {
  const { dir, file } = fixture(t);
  const link = path.join(dir, 'link');
  fs.symlinkSync(file, link);
  const target = fs.statSync(file, { bigint: true });
  assert.equal(lutimensat(link, [1700000000, 123], 1700000001.5), undefined);
  let stat = fs.lstatSync(link, { bigint: true });
  assert.equal(stat.atimeNs, 1700000000000000123n);
  assert.equal(stat.mtimeNs, 1700000001500000000n);
  lutimensat(link, null, [1700000002, 456]);
  stat = fs.lstatSync(link, { bigint: true });
  assert.equal(stat.atimeNs, 1700000000000000123n);
  assert.equal(stat.mtimeNs, 1700000002000000456n);
  lutimensat(link, 1700000003.25, undefined);
  stat = fs.lstatSync(link, { bigint: true });
  assert.equal(stat.atimeNs, 1700000003250000000n);
  assert.equal(stat.mtimeNs, 1700000002000000456n);
  lutimensat(link);
  const after = fs.lstatSync(link, { bigint: true });
  for (const key of ['atimeNs', 'mtimeNs', 'ctimeNs']) {
    assert.equal(after[key], stat[key]);
    assert.equal(fs.statSync(file, { bigint: true })[key], target[key]);
  }
});

test('lutimensat handles dangling links, regular files and directories', (t) => {
  const { dir, file } = fixture(t);
  const link = path.join(dir, 'dangling');
  fs.symlinkSync(path.join(dir, 'missing'), link);
  for (const target of [path.relative(process.cwd(), link), file, dir]) {
    lutimensat(target, [1700000000, 1], [1700000001, 999999999]);
    const stat = fs.lstatSync(target, { bigint: true });
    assert.equal(stat.atimeNs, 1700000000000000001n);
    assert.equal(stat.mtimeNs, 1700000001999999999n);
  }
});

test('lutimensat validates inputs and reports filesystem errors', (t) => {
  const { dir, file } = fixture(t);
  assert.throws(() => lutimensat(file, null, [0, 1000000000]), RangeError);
  assert.throws(() => lutimensat(file, {}, null), TypeError);
  assert.throws(() => lutimensat(file + '\0', 0, 0), TypeError);
  const missing = path.join(dir, 'missing');
  assert.throws(() => lutimensat(missing, null, 0), (error) => {
    assert.equal(error.code, 'ENOENT');
    assert.equal(error.syscall, 'lutimensat');
    assert.equal(error.path, missing);
    assert.ok(error.errno < 0);
    return true;
  });
});

test('sets both timestamps with exact nanoseconds', (t) => {
  const { file } = fixture(t);
  for (const ns of [0, 1, 123456789, 999999999]) {
    assert.equal(utimensat(file, [1700000000, ns], [1700000001, ns]), undefined);
    const stat = fs.statSync(file, { bigint: true });
    const expected = 1700000000000000000n + BigInt(ns);
    assert.equal(stat.atimeNs, expected);
    assert.equal(stat.mtimeNs, expected + 1000000000n);
  }
});

test('supports relative paths and directories', (t) => {
  const { dir, file } = fixture(t);
  for (const target of [path.relative(process.cwd(), file), dir]) {
    utimensat(target, null, [1700000001, 42]);
    assert.equal(fs.statSync(target, { bigint: true }).mtimeNs, 1700000001000000042n);
  }
});

test('follows symbolic links without changing the link timestamp', (t) => {
  const { dir, file } = fixture(t);
  const link = path.join(dir, 'link');
  fs.symlinkSync(file, link);
  const before = fs.lstatSync(link, { bigint: true }).mtimeNs;
  utimensat(link, undefined, [1700000000, 123]);
  assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, 1700000000000000123n);
  assert.equal(fs.lstatSync(link, { bigint: true }).mtimeNs, before);
});

test('reports filesystem errors with Node-style fields', (t) => {
  const { dir, file } = fixture(t);
  for (const [target, code] of [[path.join(dir, 'missing'), 'ENOENT'],
    [path.join(file, 'child'), 'ENOTDIR'], ['', 'ENOENT']]) {
    assert.throws(() => utimensat(target, 0, 0), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.syscall, 'utimensat');
      assert.equal(error.path, target);
      assert.ok(error.errno < 0);
      return true;
    });
  }
});

test('rejects invalid arguments before changing the file', (t) => {
  const { file } = fixture(t);
  const before = fs.statSync(file, { bigint: true }).mtimeNs;
  for (const value of [undefined, null, 1, Buffer.from(file)]) {
    assert.throws(() => utimensat(value, 0, 0), TypeError);
  }
  assert.throws(() => utimensat(file + '\0ignored', 0, 0), TypeError);
  for (const value of ['0', 0n, {}, [], [0], [0, 0, 0], ['0', 0]]) {
    assert.throws(() => utimensat(file, value, 0), TypeError);
    assert.throws(() => utimensat(file, 0, value), TypeError);
  }
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => utimensat(file, value, 0), RangeError);
  }
  for (const value of [NaN, Infinity, -1, 0.5, 1000000000]) {
    assert.throws(() => utimensat(file, 0, [0, value]), RangeError);
  }
  assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, before);
});


test('accepts numbers as Unix seconds and mixes input forms', (t) => {
  const { file } = fixture(t);
  for (const [value, expected] of [[0, 0n], [1700000000.125, 1700000000125000000n],
    [1.9999999996, 2000000000n]]) {
    utimensat(file, value, [1700000001, 1]);
    const stat = fs.statSync(file, { bigint: true });
    assert.equal(stat.atimeNs, expected);
    assert.equal(stat.mtimeNs, 1700000001000000001n);
    utimensat(file, null, value);
    assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, expected);
  }
  // Compare negative Number conversion with its exact tuple representation.
  utimensat(file, [-1, 750000000], -0.25);
  const stat = fs.statSync(file, { bigint: true });
  assert.equal(stat.atimeNs, stat.mtimeNs);
});

test('both functions accept Dates with exact millisecond precision', (t) => {
  const { dir, file } = fixture(t);
  const link = path.join(dir, 'date-link');
  fs.symlinkSync(file, link);
  for (const [setTimes, target] of [[utimensat, file], [lutimensat, link]]) {
    for (const ms of [0, 1, 1700000000123, -1, -1001]) {
      setTimes(target, new Date(ms), new Date(ms));
      const stat = fs.lstatSync(target, { bigint: true });
      assert.equal(stat.atimeNs, BigInt(ms) * 1000000n);
      assert.equal(stat.mtimeNs, BigInt(ms) * 1000000n);
    }
    setTimes(target, [1700000000, 42], new Date(1700000001123));
    setTimes(target, null, new Date(1700000002456));
    const stat = fs.lstatSync(target, { bigint: true });
    assert.equal(stat.atimeNs, 1700000000000000042n);
    assert.equal(stat.mtimeNs, 1700000002456000000n);
    for (const args of [[new Date(NaN), 0], [0, new Date(NaN)]]) {
      assert.throws(() => setTimes(target, ...args), RangeError);
    }
    const after = fs.lstatSync(target, { bigint: true });
    assert.equal(after.atimeNs, stat.atimeNs);
    assert.equal(after.mtimeNs, stat.mtimeNs);
  }
});

test('null, undefined and absent arguments preserve timestamps', (t) => {
  const { file } = fixture(t);
  for (const omit of [null, undefined]) {
    utimensat(file, [1700000000, 123], [1700000001, 456]);
    utimensat(file, omit, [1700000002, 789]);
    let stat = fs.statSync(file, { bigint: true });
    assert.equal(stat.atimeNs, 1700000000000000123n);
    assert.equal(stat.mtimeNs, 1700000002000000789n);
    utimensat(file, [1700000003, 42], omit);
    stat = fs.statSync(file, { bigint: true });
    assert.equal(stat.atimeNs, 1700000003000000042n);
    assert.equal(stat.mtimeNs, 1700000002000000789n);
    utimensat(file, omit, omit);
    utimensat(file);
    const after = fs.statSync(file, { bigint: true });
    assert.equal(after.atimeNs, stat.atimeNs);
    assert.equal(after.mtimeNs, stat.mtimeNs);
    assert.equal(after.ctimeNs, stat.ctimeNs);
  }
  utimensat(file, 1700000004);
  const stat = fs.statSync(file, { bigint: true });
  assert.equal(stat.atimeNs, 1700000004000000000n);
  assert.equal(stat.mtimeNs, 1700000002000000789n);
});
