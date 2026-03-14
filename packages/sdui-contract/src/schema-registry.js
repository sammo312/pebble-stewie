'use strict';

var v1 = require('./versions/v1');

var DESCRIPTORS = {};
DESCRIPTORS[v1.schemaVersion] = v1;

function listSchemaVersions() {
  return Object.keys(DESCRIPTORS);
}

function getLatestSchemaVersion() {
  return v1.schemaVersion;
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
