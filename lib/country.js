'use strict';

const { pick } = require('./legacy');

module.exports = {
  COUNTRY: pick('COUNTRY'),
  detectCountry: pick('detectCountry'),
  flagToCC: pick('flagToCC'),
  countryInfo: pick('countryInfo'),
  isCFServer: pick('isCFServer'),
};
