'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
let storePath = process.env.SUBVIZ_STORE_PATH || DEFAULT_STORE_PATH;

function setStorePath(nextPath) {
  storePath = nextPath || DEFAULT_STORE_PATH;
}

function ensureDir() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function readAll() {
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (_) {
    return {};
  }
}

function writeAll(obj) {
  ensureDir();
  const tmp = storePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj || {}, null, 2), 'utf8');
  fs.renameSync(tmp, storePath);
  return true;
}

function read(key) {
  const obj = readAll();
  const v = obj[key];
  return v === undefined || v === null ? '' : String(v);
}

function write(key, value) {
  const obj = readAll();
  if (value === undefined || value === null || value === '') delete obj[key];
  else obj[key] = String(value);
  return writeAll(obj);
}

function remove(key) {
  return write(key, '');
}

module.exports = { DEFAULT_STORE_PATH, setStorePath, readAll, writeAll, read, write, remove };
