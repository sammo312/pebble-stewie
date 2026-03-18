'use strict';

function getSelectedItemFromAction(action, menuScreen) {
  var items = menuScreen.items || [];

  if (action.itemId) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === action.itemId) {
        return items[i];
      }
    }
  }

  if (action.index >= 0 && action.index < items.length) {
    return items[action.index];
  }

  return null;
}

function handleBack(deps) {
  if (deps.getHistoryLength() === 0) {
    if (deps.getActiveGraphSource() === 'agent') {
      deps.leaveAgentConversation();
      deps.activateGraph(deps.getStaticGraph(), 'static', false);
      return;
    }

    deps.activateGraph(deps.getActiveGraph() || deps.getStaticGraph(), deps.getActiveGraphSource() || 'static', false);
    return;
  }

  var previous = deps.popHistoryEntry();
  if (deps.getActiveGraphSource() === 'agent' && previous && previous.source !== 'agent') {
    deps.leaveAgentConversation();
  }
  deps.restoreHistoryEntry(previous);
}

function handleMenuSelect(action, deps) {
  var currentScreen = deps.getCurrentRenderedScreen();
  if (!currentScreen || currentScreen.type !== 'menu') {
    return;
  }

  var selectedItem = getSelectedItemFromAction(action, currentScreen);
  if (!selectedItem) {
    return;
  }

  if (deps.executeTypedAction(selectedItem.run, 'menu_item')) {
    return;
  }

  if (deps.getActiveGraphSource() === 'agent' && selectedItem.value) {
    deps.submitAgentTextInput('User selected item ' + selectedItem.id + ': ' + selectedItem.value, 'menu_item');
  }
}

function handleMenuActionSelect(action, deps) {
  if (action.index >= 0) {
    return false;
  }

  var selectedId = action.itemId || '';
  if (!selectedId) {
    return false;
  }

  var selectedAction = deps.getCurrentMenuActionsById()[selectedId];
  if (!selectedAction) {
    return false;
  }

  if (deps.executeTypedAction(selectedAction.run, 'menu_action')) {
    return true;
  }

  if (deps.getActiveGraphSource() === 'agent' && selectedAction.value) {
    deps.submitAgentTextInput('User selected action menu item ' + selectedAction.id + ': ' + selectedAction.value, 'menu_action');
    return true;
  }

  return true;
}

function handleCardActionSelect(action, deps) {
  var selectedId = action.itemId || '';
  if (!selectedId) {
    return false;
  }

  var selectedAction = deps.getCurrentCardActionsById()[selectedId];
  if (!selectedAction) {
    return false;
  }

  if (deps.executeTypedAction(selectedAction.run, 'card_action')) {
    return true;
  }

  if (deps.getActiveGraphSource() === 'agent' && selectedAction.value) {
    deps.submitAgentTextInput('User selected card action ' + selectedAction.id + ': ' + selectedAction.value, 'card_action');
    return true;
  }

  return true;
}

function handleSelect(action, deps) {
  if (handleCardActionSelect(action, deps)) {
    return;
  }

  if (handleMenuActionSelect(action, deps)) {
    return;
  }

  handleMenuSelect(action, deps);
}

function handleVoiceAction(action, deps) {
  var pending = deps.getPendingDictation();
  if (pending && pending.variable) {
    deps.clearPendingDictation();
    if (action.itemId === deps.voiceNotSupportedItemId || action.itemId === deps.voiceErrorItemId) {
      handleBack(deps);
      return;
    }

    var transcript = deps.sanitizeText(action.text);
    if (!transcript) {
      handleBack(deps);
      return;
    }

    deps.applySetVar({ type: 'set_var', key: pending.variable, value: 'literal:' + transcript });

    if (pending.then && pending.then.type) {
      if (!deps.executeTypedAction(pending.then, 'dictation_then')) {
        handleBack(deps);
      }
    } else if (pending.screen) {
      if (!deps.transitionTo(pending.screen, false)) {
        handleBack(deps);
      }
    } else {
      handleBack(deps);
    }
    return;
  }

  if (action.itemId === deps.voiceNotSupportedItemId) {
    deps.sendRender({
      id: 'voice-unsupported',
      type: 'card',
      title: 'Voice',
      body: 'Voice dictation not supported on this watch.'
    });
    return;
  }

  if (action.itemId === deps.voiceErrorItemId) {
    deps.sendRender({
      id: 'voice-error',
      type: 'card',
      title: 'Voice',
      body: 'Dictation failed. Try again.'
    });
    return;
  }

  if (deps.getActiveGraphSource() === 'agent') {
    deps.submitAgentVoice(action.text);
    return;
  }

  var voiceTranscript = deps.sanitizeText(action.text);
  var currentDef = deps.getCurrentScreenDefinition();
  if (currentDef && Array.isArray(currentDef.items)) {
    var voiceItem = null;
    for (var vi = 0; vi < currentDef.items.length; vi++) {
      if (currentDef.items[vi] && currentDef.items[vi].id === deps.voiceInputItemId) {
        voiceItem = currentDef.items[vi];
        break;
      }
    }

    if (voiceItem && voiceItem.run && voiceItem.run.type === 'dictation') {
      if (!voiceTranscript) {
        handleBack(deps);
        return;
      }

      var itemDictVar = deps.sanitizeVarKey(voiceItem.run.variable);
      if (itemDictVar) {
        deps.applySetVar({ type: 'set_var', key: itemDictVar, value: 'literal:' + voiceTranscript });
      }

      if (voiceItem.run.then && voiceItem.run.then.type) {
        var thenRun = voiceItem.run.then;
        if (thenRun.type === 'agent_prompt' && thenRun.prompt && itemDictVar) {
          thenRun = {
            type: 'agent_prompt',
            prompt: thenRun.prompt.replace('{{var.' + itemDictVar + '}}', voiceTranscript)
          };
          if (voiceItem.run.then.vibe) {
            thenRun.vibe = voiceItem.run.then.vibe;
          }
          if (voiceItem.run.then.light) {
            thenRun.light = voiceItem.run.then.light;
          }
        }
        if (deps.executeTypedAction(thenRun, 'dictation_then')) {
          return;
        }
      }

      if (voiceItem.run.screen) {
        deps.pushCurrentHistoryEntry();
        if (deps.transitionTo(voiceItem.run.screen, false)) {
          return;
        }
      }

      handleBack(deps);
      return;
    }
  }

  if (!voiceTranscript) {
    deps.sendRender({
      id: 'voice-empty',
      type: 'card',
      title: 'Voice',
      body: 'No transcript captured. Try again.'
    });
    return;
  }

  deps.pushCurrentHistoryEntry();
  deps.sendRender({
    id: 'voice-result',
    type: 'scroll',
    title: 'Voice Input',
    body: deps.limitText(voiceTranscript, deps.maxScrollBodyLen)
  });
}

function handleActionMessage(payload, deps) {
  var msgType = deps.parseNumber(payload.msgType, 0);
  if (msgType !== deps.msgTypeAction) {
    return;
  }

  var actionType = deps.parseNumber(payload.actionType, 0);
  var action = {
    screenId: payload.actionScreenId ? String(payload.actionScreenId) : '',
    itemId: payload.actionItemId ? String(payload.actionItemId) : '',
    index: deps.parseNumber(payload.actionIndex, -1),
    text: payload.actionText ? String(payload.actionText) : ''
  };

  if (action.screenId) {
    deps.setCurrentScreenId(action.screenId);
  }

  if (actionType === deps.actionTypeReady) {
    deps.resetHistory();
    deps.resetVars();
    deps.clearScreenTimer();
    deps.resetAgentConversation(false);
    if (!deps.tryRenderImportedSchemaFromStorage()) {
      deps.activateGraph(deps.getStaticGraph(), 'static', false);
    }
    return;
  }

  if (actionType === deps.actionTypeSelect) {
    handleSelect(action, deps);
    return;
  }

  if (actionType === deps.actionTypeBack) {
    handleBack(deps);
    return;
  }

  if (actionType === deps.actionTypeVoice) {
    handleVoiceAction(action, deps);
  }
}

module.exports = {
  getSelectedItemFromAction: getSelectedItemFromAction,
  handleBack: handleBack,
  handleMenuSelect: handleMenuSelect,
  handleMenuActionSelect: handleMenuActionSelect,
  handleCardActionSelect: handleCardActionSelect,
  handleSelect: handleSelect,
  handleVoiceAction: handleVoiceAction,
  handleActionMessage: handleActionMessage
};
