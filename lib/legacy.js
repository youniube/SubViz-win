'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cached = null;

function loadLegacy() {
  if (cached) return cached;
  const root = path.join(__dirname, '..');
  const files = [
    'src/server/00-bootstrap.js',
    'src/server/10-country.js',
    'src/server/20-parser.js',
  ];
  const context = {
    console,
    VERSION: '0.2.0-node',
    MARKER: 'SUBVIZ_NODE_0_2_0',
    atob(input) {
      return Buffer.from(String(input || ''), 'base64').toString('binary');
    },
    btoa(input) {
      return Buffer.from(String(input || ''), 'binary').toString('base64');
    },
    escape: global.escape,
    unescape: global.unescape,
    setTimeout,
    clearTimeout,
    Buffer,
    Date,
    JSON,
    Math,
    RegExp,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Error,
    URL,
  };
  vm.createContext(context);
  for (const rel of files) {
    const file = path.join(root, rel);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, context, { filename: rel });
  }
  cached = context;
  return cached;
}

function pick(name) {
  const ctx = loadLegacy();
  return ctx[name];
}

module.exports = { loadLegacy, pick };
