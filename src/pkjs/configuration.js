'use strict';

var constants = require('./constants');
var textUtils = require('./text-utils');

var LATEST_SDUI_SCHEMA_VERSION = constants.LATEST_SDUI_SCHEMA_VERSION;
var OPENAI_DEFAULT_MODEL = constants.OPENAI_DEFAULT_MODEL;
var STORAGE_IMPORTED_SCHEMA_JSON = constants.STORAGE_IMPORTED_SCHEMA_JSON;
var STORAGE_OPENAI_MODEL = constants.STORAGE_OPENAI_MODEL;
var STORAGE_OPENAI_TOKEN = constants.STORAGE_OPENAI_TOKEN;

var sanitizeText = textUtils.sanitizeText;

function getAgentConfig() {
  return {
    openaiToken: localStorage.getItem(STORAGE_OPENAI_TOKEN) || '',
    openaiModel: localStorage.getItem(STORAGE_OPENAI_MODEL) || OPENAI_DEFAULT_MODEL
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildConfigurationUrl() {
  var existingSchema = localStorage.getItem(STORAGE_IMPORTED_SCHEMA_JSON) || '';
  var existingToken = localStorage.getItem(STORAGE_OPENAI_TOKEN) || '';
  var existingModel = localStorage.getItem(STORAGE_OPENAI_MODEL) || OPENAI_DEFAULT_MODEL;

  var html = [
    '<!doctype html><html><head><meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<title>Pebble SDUI Setup</title>',
    '<style>body{font-family:-apple-system,system-ui,sans-serif;padding:12px;background:#111;color:#eee;}',
    'label{display:block;margin:10px 0 4px;}textarea,input{width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:1px solid #444;background:#1c1c1c;color:#fff;}',
    'textarea{min-height:160px;}button{margin-top:12px;padding:10px 12px;border:0;border-radius:6px;background:#2f7cff;color:#fff;font-weight:600;width:100%;}</style>',
    '</head><body>',
    '<h3>SDUI Import Setup</h3>',
    '<label>Schema JSON</label>',
    '<textarea id="schema" placeholder="{&quot;schemaVersion&quot;:&quot;', escapeHtml(LATEST_SDUI_SCHEMA_VERSION), '&quot;,&quot;entryScreenId&quot;:&quot;root&quot;,&quot;screens&quot;:{...}}">', escapeHtml(existingSchema), '</textarea>',
    '<label>OpenAI API Key</label>',
    '<input id="token" type="password" placeholder="sk-..." value="', escapeHtml(existingToken), '"/>',
    '<label>OpenAI Model</label>',
    '<input id="model" type="text" value="', escapeHtml(existingModel), '"/>',
    '<button id="save">Save</button>',
    '<script>',
    'document.getElementById("save").addEventListener("click", function(){',
    'var payload={schemaJson:document.getElementById("schema").value||"",openaiToken:document.getElementById("token").value||"",openaiModel:document.getElementById("model").value||""};',
    'document.location="pebblejs://close#"+encodeURIComponent(JSON.stringify(payload));',
    '});',
    '</script>',
    '</body></html>'
  ].join('');

  return 'data:text/html,' + encodeURIComponent(html);
}

function parseConfigurationResponse(event) {
  if (!event || !event.response) {
    return null;
  }

  var decoded;
  try {
    decoded = decodeURIComponent(event.response);
  } catch (error) {
    decoded = event.response;
  }

  if (!sanitizeText(decoded)) {
    return null;
  }

  try {
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

module.exports = {
  getAgentConfig: getAgentConfig,
  buildConfigurationUrl: buildConfigurationUrl,
  parseConfigurationResponse: parseConfigurationResponse
};
