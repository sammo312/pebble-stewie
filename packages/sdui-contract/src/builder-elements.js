'use strict';

var schemaRegistry = require('./schema-registry');

function cloneFieldList(fields) {
  return (fields || []).map(function(field) {
    return Object.assign({}, field);
  });
}

function getDescriptor(schemaVersion) {
  return schemaRegistry.getSchemaDescriptor(schemaVersion) ||
    schemaRegistry.getSchemaDescriptor();
}

function getScreenFieldDefinitions(screenType, schemaVersion) {
  var descriptor = getDescriptor(schemaVersion);
  var type = String(screenType || descriptor.defaults.screenType).toLowerCase();
  if (descriptor.enums.screenTypes.indexOf(type) < 0) {
    type = descriptor.defaults.screenType;
  }

  return cloneFieldList(descriptor.fieldDefs.screen.common)
    .concat(cloneFieldList(descriptor.fieldDefs.screen[type]));
}

function deriveBuilderSpecForScreen(screenType, schemaVersion) {
  var descriptor = getDescriptor(schemaVersion);
  return {
    schemaVersion: descriptor.schemaVersion,
    limits: Object.assign({}, descriptor.limits),
    enums: {
      screenTypes: descriptor.enums.screenTypes.slice(),
      inputModes: descriptor.enums.inputModes.slice(),
      runTypes: descriptor.enums.runTypes.slice(),
      actionSlots: descriptor.enums.actionSlots.slice(),
      actionIcons: descriptor.enums.actionIcons.slice(),
      vibeTypes: descriptor.enums.vibeTypes.slice(),
      drawPlayModes: (descriptor.enums.drawPlayModes || []).slice(),
      drawBackgrounds: (descriptor.enums.drawBackgrounds || []).slice(),
      drawKinds: (descriptor.enums.drawKinds || []).slice(),
      drawColors: (descriptor.enums.drawColors || []).slice(),
      canvasTemplates: (descriptor.enums.canvasTemplates || []).slice(),
      motionPresets: (descriptor.enums.motionPresets || []).slice(),
      motionSpeeds: (descriptor.enums.motionSpeeds || []).slice(),
      motionIntensities: (descriptor.enums.motionIntensities || []).slice(),
      motionPlacements: (descriptor.enums.motionPlacements || []).slice()
    },
    uiSections: descriptor.uiSections,
    screenFields: getScreenFieldDefinitions(screenType, descriptor.schemaVersion),
    itemFields: cloneFieldList(descriptor.fieldDefs.item),
    actionFields: cloneFieldList(descriptor.fieldDefs.action),
    menuActionFields: cloneFieldList(descriptor.fieldDefs.menuAction || []),
    drawerItemFields: cloneFieldList(descriptor.fieldDefs.drawerItem || descriptor.fieldDefs.menuAction || []),
    hookRunFields: cloneFieldList(descriptor.fieldDefs.hookRun || []),
    timerRunFields: cloneFieldList(descriptor.fieldDefs.timerRun || []),
    motionTrackFields: cloneFieldList(descriptor.fieldDefs.motionTrack || [])
  };
}

function deriveBuilderSpecFromGraph(graph) {
  var schemaVersion = graph && graph.schemaVersion ? String(graph.schemaVersion) : '';
  var descriptor = getDescriptor(schemaVersion);
  var firstScreenType = descriptor.defaults.screenType;
  if (graph && graph.screens && graph.entryScreenId && graph.screens[graph.entryScreenId]) {
    firstScreenType = String(graph.screens[graph.entryScreenId].type || descriptor.defaults.screenType).toLowerCase();
  }

  return deriveBuilderSpecForScreen(firstScreenType, descriptor.schemaVersion);
}

var latestDescriptor = getDescriptor();

module.exports = {
  SCREEN_TYPES: latestDescriptor.enums.screenTypes.slice(),
  INPUT_MODES: latestDescriptor.enums.inputModes.slice(),
  ACTION_SLOTS: latestDescriptor.enums.actionSlots.slice(),
  ACTION_ICONS: latestDescriptor.enums.actionIcons.slice(),
  VIBE_TYPES: latestDescriptor.enums.vibeTypes.slice(),
  LIMITS: Object.assign({}, latestDescriptor.limits),
  SCREEN_FIELD_DEFS: latestDescriptor.fieldDefs.screen,
  ITEM_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.item),
  ACTION_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.action),
  MENU_ACTION_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.menuAction || []),
  DRAWER_ITEM_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.drawerItem || latestDescriptor.fieldDefs.menuAction || []),
  HOOK_RUN_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.hookRun || []),
  TIMER_RUN_FIELD_DEFS: cloneFieldList(latestDescriptor.fieldDefs.timerRun || []),
  getScreenFieldDefinitions: getScreenFieldDefinitions,
  deriveBuilderSpecForScreen: deriveBuilderSpecForScreen,
  deriveBuilderSpecFromGraph: deriveBuilderSpecFromGraph
};
