'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function findHeaders(execPath, version) {
  const roots = new Set([execPath, fs.realpathSync(execPath)].map(
    (executable) => path.dirname(path.dirname(executable))
  ));
  for (const root of roots) {
    const include = path.join(root, 'include', 'node');
    try {
      const header = fs.readFileSync(path.join(include, 'node_version.h'), 'utf8');
      const found = ['MAJOR', 'MINOR', 'PATCH'].map((part) => {
        const match = header.match(new RegExp(`^#define\\s+NODE_${part}_VERSION\\s+(\\d+)`, 'm'));
        return match && match[1];
      }).join('.');
      if (found === version && ['node_api.h', 'common.gypi', 'config.gypi'].every(
        (file) => fs.existsSync(path.join(include, file))
      )) return root;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
  }
  return undefined;
}

function build() {
  const args = process.argv.slice(2);
  // Explicit header or cross-compilation settings take precedence.
  const options = ['nodedir', 'target', 'arch', 'dist-url', 'disturl', 'tarball'];
  const configured = options.some((option) =>
    args.some((arg) => arg === `--${option}` || arg.startsWith(`--${option}=`)) ||
    [option, option.replaceAll('-', '_')].some((key) =>
      process.env[`npm_config_${key}`] || process.env[`npm_package_config_node_gyp_${key}`]
    )
  );
  if (!configured) {
    const root = findHeaders(process.execPath, process.versions.node);
    if (root) {
      console.log(`Using local Node.js ${process.versions.node} headers: ${root}`);
      args.push(`--nodedir=${root}`);
    }
  }

  // npm exposes its bundled node-gyp here; PATH supports direct script usage.
  const nodeGyp = process.env.npm_config_node_gyp;
  const result = nodeGyp
    ? spawnSync(process.execPath, [nodeGyp, 'rebuild', ...args], { stdio: 'inherit' })
    : spawnSync('node-gyp', ['rebuild', ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status === null ? 1 : result.status;
}

if (require.main === module) build();
module.exports = { findHeaders };
