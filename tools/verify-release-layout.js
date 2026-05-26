#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist');

function rel(p) {
  return path.relative(process.cwd(), p).replace(/\\/g, '/');
}

function mustFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new Error('Release package layout error: missing file ' + rel(full));
  }
}

function mustNotDir(dir) {
  const full = path.join(root, dir);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    throw new Error('Release package layout error: duplicated directory ' + rel(full));
  }
}

function main() {
  mustFile('server.js');
  mustFile('SubViz.bat');
  mustFile('node/node.exe');
  mustFile('public/index.html');
  mustFile('public/app.js');
  mustFile('lib/legacy.js');
  mustFile('lib/parser.js');
  mustFile('src/server/00-bootstrap.js');
  mustFile('src/server/10-country.js');
  mustFile('src/server/20-parser.js');
  mustFile('data/sample.yaml');

  mustNotDir('src/src');
  mustNotDir('tools/tools');
  mustNotDir('test/test');

  console.log('[OK] Release package layout verified:', root);
}

main();
