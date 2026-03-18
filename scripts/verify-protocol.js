'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var rootDir = path.resolve(__dirname, '..');
var packageJson = require(path.join(rootDir, 'package.json'));
var pkjsConstants = require(path.join(rootDir, 'src/pkjs/constants.js'));

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function parseObjectLiteral(source, objectName) {
  var match = source.match(new RegExp('const\\s+' + objectName + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\}', 'm'));
  assert.ok(match, 'Could not find object literal for ' + objectName);
  var entries = {};
  var entryPattern = /^\s*([A-Za-z0-9_]+)\s*:\s*(\d+)/gm;
  var entryMatch;
  while ((entryMatch = entryPattern.exec(match[1])) !== null) {
    entries[entryMatch[1]] = Number(entryMatch[2]);
  }
  return entries;
}

function parseConstNumber(source, constantName) {
  var match = source.match(new RegExp('(?:const\\s+' + constantName + '\\s*=\\s*|#define\\s+' + constantName + '\\s+)(\\d+)', 'm'));
  assert.ok(match, 'Could not find numeric constant ' + constantName);
  return Number(match[1]);
}

function parseCEnumValue(source, enumName) {
  var match = source.match(new RegExp(enumName + '\\s*=\\s*(\\d+)', 'm'));
  assert.ok(match, 'Could not find C enum value ' + enumName);
  return Number(match[1]);
}

var expectedMessageKeys = {};
packageJson.pebble.messageKeys.forEach(function(key, index) {
  expectedMessageKeys[key] = 10000 + index;
});

var builderProtocolSource = readFile('apps/screen-builder-web/app/pebble-protocol.js');
var cStateSource = readFile('src/c/stewie/state.h');
var builderMessageKeys = parseObjectLiteral(builderProtocolSource, 'MESSAGE_KEYS');

assert.deepEqual(builderMessageKeys, expectedMessageKeys, 'Builder protocol message keys drifted from package.json');

assert.equal(pkjsConstants.MSG_TYPE_RENDER, parseCEnumValue(cStateSource, 'MSG_TYPE_RENDER'));
assert.equal(pkjsConstants.MSG_TYPE_ACTION, parseCEnumValue(cStateSource, 'MSG_TYPE_ACTION'));
assert.equal(pkjsConstants.ACTION_TYPE_READY, parseCEnumValue(cStateSource, 'ACTION_TYPE_READY'));
assert.equal(pkjsConstants.ACTION_TYPE_SELECT, parseCEnumValue(cStateSource, 'ACTION_TYPE_SELECT'));
assert.equal(pkjsConstants.ACTION_TYPE_BACK, parseCEnumValue(cStateSource, 'ACTION_TYPE_BACK'));
assert.equal(pkjsConstants.ACTION_TYPE_VOICE, parseCEnumValue(cStateSource, 'ACTION_TYPE_VOICE'));

assert.equal(parseConstNumber(builderProtocolSource, 'ACTION_TYPE_READY'), pkjsConstants.ACTION_TYPE_READY);
assert.equal(parseConstNumber(builderProtocolSource, 'ACTION_TYPE_SELECT'), pkjsConstants.ACTION_TYPE_SELECT);
assert.equal(parseConstNumber(builderProtocolSource, 'ACTION_TYPE_BACK'), pkjsConstants.ACTION_TYPE_BACK);
assert.equal(parseConstNumber(builderProtocolSource, 'ACTION_TYPE_VOICE'), pkjsConstants.ACTION_TYPE_VOICE);

assert.equal(parseConstNumber(cStateSource, 'MAX_MENU_ITEMS'), pkjsConstants.MAX_MENU_ITEMS);
assert.equal(parseConstNumber(cStateSource, 'MAX_MENU_ACTIONS'), pkjsConstants.MAX_MENU_ACTIONS);
assert.equal(parseConstNumber(cStateSource, 'MAX_DRAW_STEPS'), pkjsConstants.MAX_DRAW_STEPS);

assert.ok(parseConstNumber(cStateSource, 'MAX_TITLE_LEN') > pkjsConstants.MAX_TITLE_LEN, 'C title buffer should exceed JS title limit');
assert.ok(parseConstNumber(cStateSource, 'MAX_BODY_LEN') > pkjsConstants.MAX_BODY_LEN, 'C body buffer should exceed JS body limit');
assert.ok(parseConstNumber(cStateSource, 'MAX_SCROLL_BODY_LEN') > pkjsConstants.MAX_SCROLL_BODY_LEN, 'C scroll buffer should exceed JS scroll limit');
assert.ok(parseConstNumber(cStateSource, 'MAX_SCREEN_ID_LEN') > pkjsConstants.MAX_SCREEN_ID_LEN, 'C screen id buffer should exceed JS screen id limit');
assert.ok(parseConstNumber(cStateSource, 'MAX_ITEM_ID_LEN') > pkjsConstants.MAX_ACTION_ID_LEN, 'C item id buffer should exceed JS action id limit');
assert.ok(parseConstNumber(cStateSource, 'MAX_ITEM_LABEL_LEN') > pkjsConstants.MAX_OPTION_LABEL_LEN, 'C item label buffer should exceed JS label limit');

console.log('Protocol verification passed');
