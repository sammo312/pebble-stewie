'use strict';

var constants = require('./constants');

module.exports = {
  root: {
    id: 'root',
    type: 'menu',
    title: 'Main Menu',
    items: [
      { id: 'controls', label: 'Controls', next: 'controls' },
      { id: 'agent-home', label: 'Agent SDUI', next: 'agent-home' },
      { id: 'status', label: 'Status Card', next: 'status-card' },
      { id: 'time', label: 'Phone Time', next: 'time-card' },
      { id: 'about', label: 'About', next: 'about-card' }
    ]
  },
  controls: {
    id: 'controls',
    type: 'menu',
    title: 'Controls',
    items: [
      { id: 'start', label: 'Start Task', next: 'start-card' },
      { id: 'stop', label: 'Stop Task', next: 'stop-card' },
      { id: 'diag', label: 'Diagnostics', next: 'diag-card' }
    ]
  },
  'agent-home': {
    id: 'agent-home',
    type: 'menu',
    title: 'Agent SDUI',
    items: [
      {
        id: 'agent-quickstart',
        label: 'Start Conversation',
        agentPrompt: 'Start a useful short conversation and ask me a yes or no question first.'
      },
      { id: constants.VOICE_INPUT_ITEM_ID, label: 'Speak to Agent' },
      { id: 'agent-reset', label: 'Reset Thread', agentCommand: 'reset' },
      { id: 'agent-help', label: 'Setup Help', next: 'agent-help-card' }
    ]
  },
  'agent-help-card': {
    id: 'agent-help-card',
    type: 'card',
    title: 'Agent Setup',
    body: 'Set localStorage openai-backend-url and optional openai-backend-token.'
  },
  'status-card': {
    id: 'status-card',
    type: 'card',
    title: 'System Status',
    body: 'Phone brain online. Watch renders SDUI from phone state.',
    actions: [
      { slot: 'select', id: 'status-home', icon: 'check', next: 'root' }
    ]
  },
  'about-card': {
    id: 'about-card',
    type: 'card',
    title: 'About',
    body: 'Watch renders. Phone + backend decide next screens.'
  },
  'start-card': {
    id: 'start-card',
    type: 'card',
    title: 'Started',
    body: 'Start action acknowledged by phone.'
  },
  'stop-card': {
    id: 'stop-card',
    type: 'card',
    title: 'Stopped',
    body: 'Stop action acknowledged by phone.'
  },
  'diag-card': {
    id: 'diag-card',
    type: 'card',
    title: 'Diagnostics',
    body: 'All checks passed. Rendering loop healthy.'
  }
};
