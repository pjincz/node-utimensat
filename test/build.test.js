'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findHeaders } = require('../scripts/build');

test('selects matching local headers and rejects mismatched or incomplete headers', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utimensat-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  const include = path.join(root, 'include/node');
  fs.mkdirSync(bin);
  fs.mkdirSync(include, { recursive: true });
  const executable = path.join(bin, 'node');
  fs.writeFileSync(executable, '');
  assert.equal(findHeaders(executable, '24.21.0'), undefined);
  fs.writeFileSync(path.join(include, 'node_version.h'),
    '#define NODE_MAJOR_VERSION 24\n#define NODE_MINOR_VERSION 21\n#define NODE_PATCH_VERSION 0\n');
  assert.equal(findHeaders(executable, '24.21.0'), undefined);
  for (const file of ['node_api.h', 'common.gypi', 'config.gypi']) {
    fs.writeFileSync(path.join(include, file), '');
  }
  assert.equal(findHeaders(executable, '24.21.0'), root);
  assert.equal(findHeaders(executable, '24.22.0'), undefined);
  const shim = path.join(root, 'shim/node');
  fs.mkdirSync(path.dirname(shim));
  fs.symlinkSync(executable, shim);
  assert.equal(findHeaders(shim, '24.21.0'), root);
});
