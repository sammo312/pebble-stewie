'use strict';

var contract = require('../../../packages/sdui-contract/src');
var descriptor = contract.schemaRegistry.getSchemaDescriptor(contract.constants.SDUI_SCHEMA_VERSION);

var sample = {
  schemaVersion: contract.constants.SDUI_SCHEMA_VERSION,
  entryScreenId: 'root',
  screens: {
    root: {
      id: 'root',
      type: 'menu',
      title: 'Main Menu',
      items: [
        { id: 'opt_yes', label: 'Yes', value: 'yes' },
        { id: 'opt_no', label: 'No', value: 'no' }
      ]
    }
  }
};

var normalized = contract.graphSchema.normalizeCanonicalGraph(sample);
var spec = contract.builderElements.deriveBuilderSpecFromGraph(sample);

console.log('normalized:', JSON.stringify(normalized, null, 2));
console.log('registered schema versions:', contract.schemaRegistry.listSchemaVersions().join(', '));
console.log('descriptor screen types:', descriptor.enums.screenTypes.join(', '));
console.log('builder screen fields:', spec.screenFields.map(function(field) { return field.id; }).join(', '));
