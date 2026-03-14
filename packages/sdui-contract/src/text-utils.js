'use strict';

function sanitizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\n/g, ' ').replace(/\|/g, '/').trim();
}

function limitText(value, maxLen) {
  var text = sanitizeText(value);
  if (!text) {
    return '';
  }

  if (text.length <= maxLen) {
    return text;
  }

  return text.substring(0, maxLen - 3) + '...';
}

function parseNumber(value, fallback) {
  var parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

module.exports = {
  sanitizeText: sanitizeText,
  limitText: limitText,
  parseNumber: parseNumber
};
