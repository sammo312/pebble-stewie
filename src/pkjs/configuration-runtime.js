'use strict';

function parseImportedGraphFromJson(schemaJson, deps) {
  var trimmed = String(schemaJson || '').trim();
  if (!trimmed) {
    return { graph: null, error: '' };
  }

  var parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { graph: null, error: 'Schema JSON is invalid.' };
  }

  var normalized = deps.normalizeCanonicalGraph(parsed);
  if (!normalized) {
    return { graph: null, error: 'Schema must be a canonical graph with schemaVersion, entryScreenId, and screens.' };
  }

  return { graph: normalized, error: '' };
}

function tryRenderImportedSchemaFromStorage(deps) {
  var storedSchema = deps.storage.getItem(deps.importedSchemaStorageKey) || '';
  if (!storedSchema) {
    return false;
  }

  var parsed = parseImportedGraphFromJson(storedSchema, deps);
  if (!parsed.graph) {
    deps.renderImportError(parsed.error || 'Stored schema is invalid.');
    return true;
  }

  deps.activateGraph(parsed.graph, 'imported', false);
  return true;
}

function applyConfigurationFromPayload(payload, deps) {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  var openaiToken = deps.sanitizeText(payload.openaiToken || '');
  var openaiModel = deps.sanitizeText(payload.openaiModel || deps.defaultOpenAIModel) || deps.defaultOpenAIModel;
  var schemaJson = payload.schemaJson !== undefined && payload.schemaJson !== null ? String(payload.schemaJson) : '';

  if (openaiToken) {
    deps.storage.setItem(deps.openaiTokenStorageKey, openaiToken);
  } else {
    deps.storage.removeItem(deps.openaiTokenStorageKey);
  }

  deps.storage.setItem(deps.openaiModelStorageKey, openaiModel);

  var schemaTrimmed = String(schemaJson || '').trim();
  if (!schemaTrimmed) {
    deps.storage.removeItem(deps.importedSchemaStorageKey);
    deps.renderAgentStatusCard('Import Cleared', 'Imported schema removed.');
    return;
  }

  var parsed = parseImportedGraphFromJson(schemaJson, deps);
  if (!parsed.graph) {
    deps.renderImportError(parsed.error || 'Invalid imported schema.');
    return;
  }

  deps.storage.setItem(deps.importedSchemaStorageKey, schemaJson);
  deps.activateGraph(parsed.graph, 'imported', false);
}

function handleReady(deps) {
  deps.log('Phone brain ready');

  var config = deps.getAgentConfig();
  if (config.openaiToken) {
    deps.log('OpenAI key configured');
  } else {
    deps.log('OpenAI key missing. Open app settings to add one.');
  }

  if (!deps.getCurrentScreenId()) {
    deps.resetHistory();
    if (!tryRenderImportedSchemaFromStorage(deps)) {
      deps.activateGraph(deps.getStaticGraph(), 'static', false);
    }
  }
}

module.exports = {
  parseImportedGraphFromJson: parseImportedGraphFromJson,
  tryRenderImportedSchemaFromStorage: tryRenderImportedSchemaFromStorage,
  applyConfigurationFromPayload: applyConfigurationFromPayload,
  handleReady: handleReady
};
