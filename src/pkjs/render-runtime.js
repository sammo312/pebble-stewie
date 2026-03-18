'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');
var runtimeValues = require('./runtime-values');

var MAX_MENU_ITEMS = constants.MAX_MENU_ITEMS;
var VOICE_INPUT_ITEM_ID = constants.VOICE_INPUT_ITEM_ID;
var GRAPH_STORAGE_PREFIX = 'sdui-storage:';
var MAX_GRAPH_STORAGE_BYTES = 4096;

var parseNumber = textUtils.parseNumber;

function shortHash(value) {
  var text = String(value || '');
  var hash = 5381;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function getUtf8ByteLength(value) {
  try {
    return unescape(encodeURIComponent(String(value || ''))).length;
  } catch (error) {
    return String(value || '').length;
  }
}

function getGraphStorageNamespace(graph) {
  var explicitNamespace = runtimeValues.sanitizeVarKey(graph && graph.storageNamespace);
  if (explicitNamespace) {
    return explicitNamespace;
  }

  if (!graph || !graph.screens || !graph.entryScreenId) {
    return '';
  }

  return 'graph_' + shortHash(JSON.stringify({
    entryScreenId: graph.entryScreenId,
    screens: graph.screens
  })).slice(0, 8);
}

function getGraphStorageKey(graph) {
  var storageNamespace = getGraphStorageNamespace(graph);
  if (!storageNamespace) {
    return '';
  }

  return GRAPH_STORAGE_PREFIX + storageNamespace;
}

function readGraphStorageMap(storageAdapter, graph, options) {
  var storageKey = getGraphStorageKey(graph);
  if (!storageKey) {
    return {};
  }

  var raw = storageAdapter.getItem(storageKey) || '';
  if (!raw) {
    return {};
  }

  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    if (options && options.logger && typeof options.logger.log === 'function') {
      options.logger.log('Stored graph data parse failed:', error && error.message ? error.message : error);
    }
    return {};
  }
}

function writeGraphStorageMap(storageAdapter, graph, nextStorage, options) {
  var storageKey = getGraphStorageKey(graph);
  if (!storageKey) {
    return false;
  }

  var data = nextStorage && typeof nextStorage === 'object' ? nextStorage : {};
  var keys = Object.keys(data);
  if (keys.length === 0) {
    storageAdapter.removeItem(storageKey);
    return true;
  }

  var serialized = JSON.stringify(data);
  if (getUtf8ByteLength(serialized) > MAX_GRAPH_STORAGE_BYTES) {
    if (options && options.logger && typeof options.logger.log === 'function') {
      options.logger.log('Stored graph data exceeds limit for namespace:', getGraphStorageNamespace(graph));
    }
    return false;
  }

  storageAdapter.setItem(storageKey, serialized);
  return true;
}

function buildTemplateContext(screen, options) {
  var settings = options || {};
  var bindings = screen && screen.bindings && typeof screen.bindings === 'object' ? screen.bindings : {};
  var bindingKeys = Object.keys(bindings);
  var context = runtimeValues.buildTemplateContext(screen, {
    vars: settings.vars,
    storage: settings.storage,
    timer: {
      remaining: settings.timerRemaining || 0
    },
    now: settings.now
  });
  var refreshMs = 0;

  for (var i = 0; i < bindingKeys.length; i++) {
    var bindingKey = bindingKeys[i];
    var binding = bindings[bindingKey];
    if (binding && binding.live) {
      var candidateRefresh = parseNumber(binding.refreshMs, 0);
      if (candidateRefresh > 0 && (refreshMs === 0 || candidateRefresh < refreshMs)) {
        refreshMs = candidateRefresh;
      }
    }
  }

  return {
    context: context,
    refreshMs: refreshMs
  };
}

function cloneRecord(source) {
  var target = {};
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
}

function applyScreenBindings(screen, options) {
  if (!screen || typeof screen !== 'object') {
    return { screen: screen, refreshMs: 0 };
  }

  var preparedContext = buildTemplateContext(screen, options);
  var context = preparedContext.context;
  var refreshMs = preparedContext.refreshMs;
  var resolved = cloneRecord(screen);

  if (screen.titleTemplate) {
    resolved.title = runtimeValues.renderTemplate(screen.titleTemplate, context);
  }

  if (screen.bodyTemplate) {
    resolved.body = runtimeValues.renderTemplate(screen.bodyTemplate, context);
  }

  if (screen.items && screen.items.length) {
    resolved.items = screen.items.map(function(item) {
      var nextItem = cloneRecord(item);
      if (item.labelTemplate) {
        nextItem.label = runtimeValues.renderTemplate(item.labelTemplate, context);
      }
      return nextItem;
    });
  }

  if (screen.actions && screen.actions.length) {
    resolved.actions = screen.actions.map(function(action) {
      var nextAction = cloneRecord(action);
      if (action.labelTemplate) {
        nextAction.label = runtimeValues.renderTemplate(action.labelTemplate, context);
      }
      return nextAction;
    });
  }

  return {
    screen: resolved,
    refreshMs: refreshMs
  };
}

function prepareScreenForRender(screen, options) {
  if (!screen || typeof screen !== 'object') {
    return screen;
  }

  var prepared = cloneRecord(screen);
  var settings = options || {};

  if (prepared.type === 'menu') {
    var hasVoice = prepared.input && (prepared.input.mode === 'voice' || prepared.input.mode === 'menu_or_voice');
    var maxItems = hasVoice ? MAX_MENU_ITEMS - 1 : MAX_MENU_ITEMS;
    prepared.items = (prepared.items || []).slice(0, maxItems);

    if (hasVoice) {
      prepared.items.push({ id: VOICE_INPUT_ITEM_ID, label: 'Speak response', value: '' });
    }

    if (settings.activeGraphSource === 'agent' && prepared.items.length === 0) {
      prepared.items.push({ id: 'continue', label: 'Continue', value: 'continue' });
    }
  }

  return prepared;
}

module.exports = {
  getGraphStorageNamespace: getGraphStorageNamespace,
  getGraphStorageKey: getGraphStorageKey,
  readGraphStorageMap: readGraphStorageMap,
  writeGraphStorageMap: writeGraphStorageMap,
  buildTemplateContext: buildTemplateContext,
  applyScreenBindings: applyScreenBindings,
  prepareScreenForRender: prepareScreenForRender
};
