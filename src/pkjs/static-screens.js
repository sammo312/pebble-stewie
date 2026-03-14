'use strict';

var constants = require('./constants');

module.exports = {
  schemaVersion: 'pebble.sdui.v1',
  entryScreenId: 'draw-demo',
  screens: {
    root: {
      id: 'root',
      type: 'menu',
      title: 'Main Menu',
      items: [
        { id: 'draw-demo', label: 'Draw Demo', run: { type: 'navigate', screen: 'draw-demo' } },
        { id: 'controls', label: 'Controls', run: { type: 'navigate', screen: 'controls' } },
        { id: 'agent-home', label: 'Agent SDUI', run: { type: 'navigate', screen: 'agent-home' } },
        { id: 'status', label: 'Status Card', run: { type: 'navigate', screen: 'status-card' } },
        { id: 'time', label: 'Phone Time', run: { type: 'navigate', screen: 'time-card' } },
        { id: 'about', label: 'About', run: { type: 'navigate', screen: 'about-card' } }
      ]
    },
    'draw-demo': {
      id: 'draw-demo',
      type: 'draw',
      title: 'Draw Demo',
      body: 'Animated shapes',
      drawing: {
        playMode: 'ping_pong',
        background: 'grid',
        timelineMs: 1800,
        steps: [
          {
            id: 'orbit',
            kind: 'circle',
            label: 'Orb',
            color: 'accent',
            fill: false,
            x: 12,
            y: 18,
            toX: 80,
            toY: 48,
            width: 24,
            height: 24,
            delayMs: 0,
            durationMs: 760,
            fromScale: 0.75,
            toScale: 1.1,
            fromOpacity: 0.25,
            toOpacity: 1
          },
          {
            id: 'sweep',
            kind: 'rect',
            label: 'Bar',
            color: 'accent2',
            fill: true,
            x: 18,
            y: 88,
            toX: 78,
            toY: 88,
            width: 34,
            height: 12,
            delayMs: 180,
            durationMs: 920,
            fromScale: 0.8,
            toScale: 1,
            fromOpacity: 0.2,
            toOpacity: 1
          },
          {
            id: 'text',
            kind: 'text',
            label: 'Hi Pebble',
            color: 'ink',
            fill: true,
            x: 20,
            y: 140,
            toX: 56,
            toY: 132,
            width: 40,
            height: 16,
            delayMs: 320,
            durationMs: 1100,
            fromScale: 0.8,
            toScale: 1.15,
            fromOpacity: 0.3,
            toOpacity: 1
          }
        ]
      }
    },
    controls: {
      id: 'controls',
      type: 'menu',
      title: 'Controls',
      items: [
        { id: 'start', label: 'Start Task', run: { type: 'navigate', screen: 'start-card' } },
        { id: 'stop', label: 'Stop Task', run: { type: 'navigate', screen: 'stop-card' } },
        { id: 'diag', label: 'Diagnostics', run: { type: 'navigate', screen: 'diag-card' } }
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
          run: {
            type: 'agent_prompt',
            prompt: 'Start a useful short conversation and ask me a yes or no question first.'
          }
        },
        { id: constants.VOICE_INPUT_ITEM_ID, label: 'Speak to Agent' },
        { id: 'agent-reset', label: 'Reset Thread', run: { type: 'agent_command', command: 'reset' } },
        { id: 'agent-help', label: 'Setup Help', run: { type: 'navigate', screen: 'agent-help-card' } }
      ]
    },
    'agent-help-card': {
      id: 'agent-help-card',
      type: 'card',
      title: 'Agent Setup',
      body: 'Open app settings. Paste canonical graph JSON + OpenAI key.'
    },
    'status-card': {
      id: 'status-card',
      type: 'card',
      title: 'System Status',
      body: 'Phone brain online. Watch renders from canonical graph state.',
      actions: [
        { slot: 'select', id: 'status-home', icon: 'check', run: { type: 'navigate', screen: 'root' } }
      ]
    },
    'time-card': {
      id: 'time-card',
      type: 'card',
      title: 'Phone Time',
      bodyTemplate: '{{time.localString}}',
      bindings: {
        time: {
          source: 'device.time',
          live: true,
          refreshMs: 30000
        }
      },
      actions: [
        { slot: 'select', id: 'time-home', icon: 'check', run: { type: 'navigate', screen: 'root' } }
      ]
    },
    'about-card': {
      id: 'about-card',
      type: 'card',
      title: 'About',
      body: 'Watch renders. Phone + OpenAI direct decide next screens.'
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
  }
};
