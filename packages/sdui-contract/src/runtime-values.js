'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');

function sanitizeVarKey(key) {
  var raw = textUtils.sanitizeText(key).toLowerCase();
  if (!raw) {
    return '';
  }

  return raw
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
    .substring(0, constants.MAX_ACTION_ID_LEN);
}

function parseConditionValue(rawValue) {
  var text = textUtils.sanitizeText(rawValue);
  if (!text) {
    return '';
  }

  if (text === 'true') {
    return true;
  }

  if (text === 'false') {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  return text;
}

function evaluateCondition(condition, vars) {
  if (!condition || typeof condition !== 'object') {
    return true;
  }

  var key = sanitizeVarKey(condition.var);
  var op = textUtils.sanitizeText(condition.op).toLowerCase();
  if (!key || !op) {
    return false;
  }

  var sourceVars = vars && typeof vars === 'object' ? vars : {};
  var left = sourceVars[key];
  var right = parseConditionValue(condition.value);
  var leftNumber = Number(left);
  var rightNumber = Number(right);
  var numbersComparable = !isNaN(leftNumber) && !isNaN(rightNumber);

  if (op === 'eq') {
    return String(left === undefined || left === null ? '' : left) ===
      String(right === undefined || right === null ? '' : right);
  }

  if (op === 'neq') {
    return String(left === undefined || left === null ? '' : left) !==
      String(right === undefined || right === null ? '' : right);
  }

  if (!numbersComparable) {
    return false;
  }

  if (op === 'gt') {
    return leftNumber > rightNumber;
  }
  if (op === 'gte') {
    return leftNumber >= rightNumber;
  }
  if (op === 'lt') {
    return leftNumber < rightNumber;
  }
  if (op === 'lte') {
    return leftNumber <= rightNumber;
  }

  return false;
}

function applySetVar(run, vars) {
  if (!run || typeof run !== 'object') {
    return null;
  }

  var key = sanitizeVarKey(run.key);
  var valueSpec = textUtils.sanitizeText(run.value);
  if (!key || !valueSpec) {
    return null;
  }

  var nextVars = {};
  var sourceVars = vars && typeof vars === 'object' ? vars : {};
  for (var existingKey in sourceVars) {
    if (Object.prototype.hasOwnProperty.call(sourceVars, existingKey)) {
      nextVars[existingKey] = sourceVars[existingKey];
    }
  }

  var current = nextVars[key];
  var nextValue = valueSpec;

  if (valueSpec === 'increment') {
    var incrementBase = Number(current);
    nextValue = !isNaN(incrementBase) ? incrementBase + 1 : 1;
  } else if (valueSpec === 'decrement') {
    var decrementBase = Number(current);
    nextValue = !isNaN(decrementBase) ? decrementBase - 1 : -1;
  } else if (valueSpec === 'toggle') {
    nextValue = !(current === true || String(current).toLowerCase() === 'true');
  } else if (valueSpec.indexOf('literal:') === 0) {
    nextValue = valueSpec.substring('literal:'.length);
  } else if (valueSpec === 'true') {
    nextValue = true;
  } else if (valueSpec === 'false') {
    nextValue = false;
  } else if (/^-?\d+(\.\d+)?$/.test(valueSpec)) {
    nextValue = Number(valueSpec);
  }

  nextVars[key] = nextValue;
  return nextVars;
}

function getNestedValue(context, path) {
  var parts = String(path || '').split('.');
  var cursor = context;
  for (var i = 0; i < parts.length; i++) {
    var key = parts[i];
    if (!key) {
      continue;
    }

    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) {
      return undefined;
    }

    cursor = cursor[key];
  }

  return cursor;
}

function readBindingValue(binding, storage, now) {
  var source = binding && binding.source ? String(binding.source) : '';
  var currentTime = now instanceof Date ? now : new Date();

  if (source === 'device.time') {
    return {
      localString: currentTime.toLocaleString(),
      localTime: currentTime.toLocaleTimeString(),
      iso: currentTime.toISOString(),
      timestamp: currentTime.getTime()
    };
  }

  if (source.indexOf('storage.') === 0) {
    var storageKey = sanitizeVarKey(source.substring('storage.'.length));
    if (!storageKey) {
      return '';
    }
    return Object.prototype.hasOwnProperty.call(storage || {}, storageKey) ? storage[storageKey] : '';
  }

  return '';
}

function buildTemplateContext(screen, options) {
  var settings = options || {};
  var vars = settings.vars && typeof settings.vars === 'object' ? settings.vars : {};
  var storage = settings.storage && typeof settings.storage === 'object' ? settings.storage : {};
  var timer = settings.timer && typeof settings.timer === 'object' ? settings.timer : { remaining: 0 };
  var now = settings.now instanceof Date ? settings.now : new Date();
  var context = {
    var: vars,
    storage: storage,
    timer: timer
  };

  var bindings = screen && screen.bindings && typeof screen.bindings === 'object' ? screen.bindings : {};
  var bindingKeys = Object.keys(bindings);
  for (var i = 0; i < bindingKeys.length; i++) {
    var bindingKey = bindingKeys[i];
    context[bindingKey] = readBindingValue(bindings[bindingKey], storage, now);
  }

  return context;
}

function renderTemplate(template, context) {
  if (template === undefined || template === null) {
    return '';
  }

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, function(match, path) {
    var value = getNestedValue(context, path);
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

function resolveTemplateValue(rawValue, screen, options) {
  var template = rawValue === undefined || rawValue === null ? '' : String(rawValue);
  if (!template) {
    return '';
  }

  return renderTemplate(template, buildTemplateContext(screen, options));
}

function applyStore(run, screen, vars, storage, options) {
  if (!run || typeof run !== 'object') {
    return null;
  }

  var key = sanitizeVarKey(run.key);
  var rawValue = run.value === undefined || run.value === null ? '' : String(run.value);
  if (!key || !rawValue) {
    return null;
  }

  var sourceStorage = storage && typeof storage === 'object' ? storage : {};
  var nextStorage = {};
  for (var existingKey in sourceStorage) {
    if (Object.prototype.hasOwnProperty.call(sourceStorage, existingKey)) {
      nextStorage[existingKey] = sourceStorage[existingKey];
    }
  }

  nextStorage[key] = String(resolveTemplateValue(rawValue, screen, {
    vars: vars,
    storage: sourceStorage,
    timer: options && options.timer ? options.timer : { remaining: 0 },
    now: options && options.now ? options.now : undefined
  }) || '');
  return nextStorage;
}

module.exports = {
  sanitizeVarKey: sanitizeVarKey,
  parseConditionValue: parseConditionValue,
  evaluateCondition: evaluateCondition,
  applySetVar: applySetVar,
  buildTemplateContext: buildTemplateContext,
  renderTemplate: renderTemplate,
  resolveTemplateValue: resolveTemplateValue,
  applyStore: applyStore
};
