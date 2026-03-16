'use strict';

var v1 = require('./versions/v1');
var v1_1_0 = require('./versions/v1_1_0');
var v1_2_0 = require('./versions/v1_2_0');

var DESCRIPTORS = {};
DESCRIPTORS[v1.schemaVersion] = v1;
DESCRIPTORS[v1_1_0.schemaVersion] = v1_1_0;
DESCRIPTORS[v1_2_0.schemaVersion] = v1_2_0;

function listSchemaVersions() {
  return Object.keys(DESCRIPTORS);
}

function getLatestSchemaVersion() {
  return v1_2_0.schemaVersion;
}

function getSchemaDescriptor(schemaVersion) {
  var key = schemaVersion || getLatestSchemaVersion();
  return DESCRIPTORS[key] || null;
}

module.exports = {
  LATEST_SCHEMA_VERSION: getLatestSchemaVersion(),
  listSchemaVersions: listSchemaVersions,
  getLatestSchemaVersion: getLatestSchemaVersion,
  getSchemaDescriptor: getSchemaDescriptor
};
