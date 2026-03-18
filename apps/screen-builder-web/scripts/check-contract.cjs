'use strict';

var assert = require('node:assert/strict');
var contract = require('../../../packages/sdui-contract/src');
var latestVersion = contract.constants.LATEST_SDUI_SCHEMA_VERSION;
var legacyVersion = contract.constants.SDUI_SCHEMA_VERSION;
var latestDescriptor = contract.schemaRegistry.getSchemaDescriptor(latestVersion);
var legacyDescriptor = contract.schemaRegistry.getSchemaDescriptor(legacyVersion);

var latestSample = {
  schemaVersion: latestVersion,
  storageNamespace: 'check_contract_demo',
  entryScreenId: 'root',
  screens: {
    root: {
      id: 'root',
      type: 'menu',
      title: 'Main Menu',
      onEnter: [
        { type: 'set_var', key: 'entered_root', value: 'true' }
      ],
      timer: {
        durationMs: 3000,
        run: { type: 'effect', vibe: 'short' }
      },
      items: [
        { id: 'opt_yes', label: 'Yes', value: 'yes', run: { type: 'set_var', key: 'count', value: 'increment' } },
        { id: 'save_best', label: 'Save Best', value: 'save', run: { type: 'store', key: 'high_score', value: '{{var.count}}' } },
        {
          id: 'opt_no',
          label: 'No',
          value: 'no',
          run: {
            type: 'navigate',
            screen: 'done',
            condition: { var: 'count', op: 'gte', value: '2' }
          }
        }
      ]
    },
    done: {
      id: 'done',
      type: 'card',
      title: 'Done',
      onExit: [
        { type: 'effect', vibe: 'short' }
      ],
      bodyTemplate: 'Count is {{var.count}} / best {{storage.high_score}}',
      bindings: {
        best: {
          source: 'storage.high_score',
          live: false
        }
      }
    }
  }
};

var legacySample = {
  schemaVersion: legacyVersion,
  entryScreenId: 'root',
  screens: {
    root: {
      id: 'root',
      type: 'menu',
      title: 'Main Menu',
      items: [
        {
          id: 'go',
          label: 'Go',
          value: 'go',
          run: {
            type: 'navigate',
            screen: 'done'
          }
        }
      ]
    },
    done: {
      id: 'done',
      type: 'card',
      title: 'Done',
      body: 'Legacy contract'
    }
  }
};

var normalizedLatest = contract.graphSchema.normalizeCanonicalGraph(latestSample);
var normalizedLegacy = contract.graphSchema.normalizeCanonicalGraph(legacySample);
var latestSpec = contract.builderElements.deriveBuilderSpecFromGraph(latestSample);
var legacySpec = contract.builderElements.deriveBuilderSpecFromGraph(legacySample);
var migratedLegacySpec = contract.builderElements.deriveBuilderSpecFromGraph(normalizedLegacy);

assert.ok(normalizedLatest, 'latest graph should normalize');
assert.ok(normalizedLegacy, 'legacy graph should normalize');
assert.equal(normalizedLatest.schemaVersion, latestVersion);
assert.equal(normalizedLegacy.schemaVersion, latestVersion);
assert.equal(normalizedLegacy.entryScreenId, 'root');
assert.equal(normalizedLegacy.screens.done.type, 'card');
assert.deepEqual(contract.schemaRegistry.listSchemaVersions(), [
  legacyVersion,
  contract.constants.SDUI_SCHEMA_VERSION_V1_1_0,
  latestVersion
]);
assert.ok(latestDescriptor.enums.screenTypes.includes('draw'));
assert.ok(!legacyDescriptor.enums.screenTypes.includes('draw'));
assert.ok(latestSpec.screenFields.some(function(field) { return field.id === 'onEnter'; }));
assert.ok(legacySpec.screenFields.some(function(field) { return field.id === 'items'; }));
assert.equal(legacySpec.schemaVersion, legacyVersion);
assert.equal(migratedLegacySpec.schemaVersion, latestVersion);

console.log('Contract check passed');
