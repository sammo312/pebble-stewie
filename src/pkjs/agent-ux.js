'use strict';

var constants = require('./constants');

var MAX_MENU_ITEMS = constants.MAX_MENU_ITEMS;
var MAX_MENU_ACTIONS = constants.MAX_MENU_ACTIONS;
var MAX_CARD_ACTIONS = constants.MAX_CARD_ACTIONS;

function cloneRecord(source) {
  var target = {};
  var key;

  for (key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }

  return target;
}

function buildMoreRepliesRun() {
  return {
    type: 'agent_command',
    command: 'more_replies'
  };
}

function isMoreRepliesEntry(entry) {
  return !!(
    entry &&
    entry.run &&
    entry.run.type === 'agent_command' &&
    String(entry.run.command || '').toLowerCase() === 'more_replies'
  );
}

function findOpenCardSlot(actions) {
  var used = {};
  var i;

  for (i = 0; i < actions.length; i++) {
    if (actions[i] && actions[i].slot) {
      used[String(actions[i].slot)] = true;
    }
  }

  if (!used.down) {
    return 'down';
  }
  if (!used.up) {
    return 'up';
  }
  if (!used.select) {
    return 'select';
  }

  return '';
}

function augmentMenuScreen(screen) {
  var items = Array.isArray(screen.items) ? screen.items.slice(0) : [];
  if (items.length >= MAX_MENU_ITEMS) {
    return screen;
  }
  if (items.some(isMoreRepliesEntry)) {
    return screen;
  }

  screen.items = items.concat([{
    id: 'agent-more-replies',
    label: 'More Replies',
    run: buildMoreRepliesRun()
  }]);

  return screen;
}

function augmentScrollScreen(screen) {
  var actions = Array.isArray(screen.actions) ? screen.actions.slice(0) : [];
  if (actions.length >= MAX_MENU_ACTIONS) {
    return screen;
  }
  if (actions.some(isMoreRepliesEntry)) {
    return screen;
  }

  screen.actions = actions.concat([{
    id: 'agent-more-replies',
    label: 'More Replies',
    run: buildMoreRepliesRun()
  }]);

  return screen;
}

function augmentCardScreen(screen) {
  var actions = Array.isArray(screen.actions) ? screen.actions.slice(0) : [];
  var slot = '';

  if (actions.some(isMoreRepliesEntry) || actions.length >= MAX_CARD_ACTIONS) {
    return screen;
  }

  slot = findOpenCardSlot(actions);
  if (!slot) {
    return screen;
  }

  screen.actions = actions.concat([{
    slot: slot,
    id: 'agent-more',
    icon: 'plus',
    label: 'More',
    run: buildMoreRepliesRun()
  }]);

  return screen;
}

function augmentScreenForWatch(screen, watchProfile) {
  var nextScreen;
  var supportsDictation = !watchProfile || watchProfile.supportsDictation !== false;
  var preferSuggestedReplies = !watchProfile || watchProfile.preferSuggestedReplies !== false;

  if (!screen || typeof screen !== 'object') {
    return screen;
  }

  nextScreen = cloneRecord(screen);

  if (!supportsDictation && nextScreen.input && typeof nextScreen.input === 'object') {
    if (nextScreen.input.mode === 'voice' || nextScreen.input.mode === 'menu_or_voice') {
      nextScreen.input = cloneRecord(nextScreen.input);
      nextScreen.input.mode = 'menu';
    }
  }

  if (!preferSuggestedReplies) {
    return nextScreen;
  }

  if (nextScreen.type === 'menu') {
    return augmentMenuScreen(nextScreen);
  }

  if (nextScreen.type === 'scroll') {
    return augmentScrollScreen(nextScreen);
  }

  if (nextScreen.type === 'card') {
    return augmentCardScreen(nextScreen);
  }

  return nextScreen;
}

function augmentAgentGraph(graph, watchProfile) {
  var nextGraph;
  var nextScreens = {};
  var keys;
  var i;

  if (!graph || typeof graph !== 'object' || !graph.screens || !graph.entryScreenId) {
    return graph;
  }

  nextGraph = cloneRecord(graph);
  keys = Object.keys(graph.screens);

  for (i = 0; i < keys.length; i++) {
    nextScreens[keys[i]] = augmentScreenForWatch(graph.screens[keys[i]], watchProfile);
  }

  nextGraph.screens = nextScreens;
  return nextGraph;
}

function buildMoreRepliesPrompt() {
  return [
    'System task: generate 4 short, distinct tap-friendly replies the user could send next.',
    'Return a menu screen.',
    'Keep item labels under 18 chars.',
    'Set each item value to the exact reply text to send.',
    'Avoid generic yes/no unless it is clearly the best fit.'
  ].join(' ');
}

module.exports = {
  augmentAgentGraph: augmentAgentGraph,
  buildMoreRepliesPrompt: buildMoreRepliesPrompt
};
