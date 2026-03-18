'use strict';

function executeTypedAction(run, source, deps) {
  if (!run || typeof run !== 'object') {
    return false;
  }

  var type = run.type ? String(run.type) : '';
  if (!type) {
    return false;
  }

  if (type === 'navigate') {
    var targetScreen = String(run.screen || '');
    if (!targetScreen) {
      return false;
    }
    if (!deps.evaluateRunCondition(run.condition)) {
      return true;
    }
    deps.queueRunEffects(run);
    if (!deps.transitionTo(targetScreen, true)) {
      deps.clearPendingEffects();
      deps.sendNavigationError(targetScreen);
    }
    return true;
  }

  if (type === 'agent_prompt') {
    var prompt = String(run.prompt || '');
    if (!prompt) {
      return false;
    }
    deps.queueRunEffects(run);
    deps.submitAgentTextInput(prompt, source || 'schema_action');
    return true;
  }

  if (type === 'agent_command') {
    if (String(run.command || '') === 'reset') {
      deps.queueRunEffects(run);
      deps.resetAgentConversation(true);
      deps.renderAgentStatusCard('Agent', 'Thread reset.');
      return true;
    }
    return false;
  }

  if (type === 'set_var') {
    if (!deps.applySetVar(run)) {
      return false;
    }
    deps.queueRunEffects(run);
    if (deps.getCurrentScreenDefinition()) {
      deps.sendRender(deps.getCurrentScreenDefinition(), { resetTimer: false });
    }
    return true;
  }

  if (type === 'store') {
    if (!deps.sanitizeVarKey(run.key) || run.value === undefined || run.value === null || String(run.value) === '') {
      return false;
    }
    if (!deps.applyStore(run, deps.getCurrentScreenDefinition() || deps.getCurrentRenderedScreen() || {})) {
      return true;
    }
    deps.queueRunEffects(run);
    if (deps.getCurrentScreenDefinition()) {
      deps.sendRender(deps.getCurrentScreenDefinition(), { resetTimer: false });
    }
    return true;
  }

  if (type === 'effect') {
    deps.queueRunEffects(run);
    if (deps.getCurrentScreenDefinition()) {
      deps.sendRender(deps.getCurrentScreenDefinition(), { resetTimer: false });
      return true;
    }
    return false;
  }

  if (type === 'dictation') {
    var dictVar = deps.sanitizeVarKey(run.variable);
    if (!dictVar) {
      return false;
    }
    deps.queueRunEffects(run);
    deps.setPendingDictation({
      variable: dictVar,
      screen: String(run.screen || ''),
      then: run.then || null
    });
    deps.pushCurrentHistoryEntry();
    deps.sendRender({
      id: '__dictation__',
      type: 'voice',
      title: 'Listening...',
      variable: dictVar
    });
    return true;
  }

  return false;
}

function executeHookRun(run, screen, deps) {
  if (!run || typeof run !== 'object' || !run.type) {
    return '';
  }

  if (run.type === 'navigate') {
    if (!deps.evaluateRunCondition(run.condition)) {
      return '';
    }
    return String(run.screen || '');
  }

  if (run.type === 'set_var') {
    if (deps.applySetVar(run)) {
      deps.queueRunEffects(run);
    }
    return '';
  }

  if (run.type === 'store') {
    if (deps.sanitizeVarKey(run.key) && run.value !== undefined && run.value !== null && String(run.value) !== '') {
      if (deps.applyStore(run, screen || {})) {
        deps.queueRunEffects(run);
      }
    }
    return '';
  }

  if (run.type === 'effect') {
    deps.queueRunEffects(run);
  }

  return '';
}

function executeHookRuns(runs, screen, deps) {
  var redirect = '';
  var hookRuns = Array.isArray(runs) ? runs : [];

  for (var i = 0; i < hookRuns.length; i++) {
    var nextRedirect = executeHookRun(hookRuns[i], screen, deps);
    if (nextRedirect) {
      redirect = nextRedirect;
    }
  }

  return redirect;
}

function renderGraphScreen(graph, source, screenId, pushHistory, deps) {
  var targetScreenId = screenId;
  var currentScreen = deps.getCurrentScreenDefinition();
  if (pushHistory) {
    deps.pushCurrentHistoryEntry();
  }

  if (currentScreen && Array.isArray(currentScreen.onExit) && currentScreen.onExit.length) {
    var exitRedirect = executeHookRuns(currentScreen.onExit, currentScreen, deps);
    if (exitRedirect) {
      targetScreenId = exitRedirect;
    }
  }

  if (deps.getActiveGraphSource() === 'agent' && source !== 'agent') {
    deps.leaveAgentConversation();
  }

  deps.setActiveGraph(graph, source);

  for (var redirectCount = 0; redirectCount <= deps.maxHookRedirects; redirectCount++) {
    var nextScreen = deps.resolveScreenInGraph(graph, targetScreenId);
    if (!nextScreen) {
      deps.log('Unknown screen id:', targetScreenId);
      return false;
    }

    if (!Array.isArray(nextScreen.onEnter) || nextScreen.onEnter.length === 0) {
      deps.sendRender(nextScreen);
      return true;
    }

    var enterRedirect = executeHookRuns(nextScreen.onEnter, nextScreen, deps);
    if (!enterRedirect || enterRedirect === targetScreenId) {
      deps.sendRender(nextScreen);
      return true;
    }

    targetScreenId = enterRedirect;
  }

  deps.log('Lifecycle redirect loop detected for:', screenId);
  return false;
}

module.exports = {
  executeTypedAction: executeTypedAction,
  executeHookRun: executeHookRun,
  executeHookRuns: executeHookRuns,
  renderGraphScreen: renderGraphScreen
};
