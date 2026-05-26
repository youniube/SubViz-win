'use strict';

const { pick } = require('./legacy');

const api = {
  parseSubscription: pick('parseSubscription'),
  parseClash: pick('parseClash'),
  parseURI: pick('parseURI'),
  parseSurge: pick('parseSurge'),
  normalizeProxyObject: pick('normalizeProxyObject'),
  buildNode: pick('buildNode'),
  setFingerprint: pick('setFingerprint'),
  analyzeNodes: pick('analyzeNodes'),
  maybeDecodeBase64: pick('maybeDecodeBase64'),
};

module.exports = api;
