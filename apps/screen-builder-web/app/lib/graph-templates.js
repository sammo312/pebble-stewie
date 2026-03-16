import { constants } from './constants'

const V = constants.LATEST_SDUI_SCHEMA_VERSION

function base(overrides) {
  return {
    schemaVersion: V,
    storageNamespace: 'stewie_builder_demo',
    entryScreenId: 'root',
    _builderMeta: { variables: [], storageKeys: [], dataItems: [] },
    ...overrides
  }
}

export const GRAPH_TEMPLATES = [
  {
    id: 'agent',
    label: 'Voice Agent',
    description: 'Menu with voice dictation that sends transcript to an AI agent.',
    graph: base({
      _builderMeta: {
        variables: [],
        storageKeys: [],
        dataItems: [
          { key: 'transcript', scope: 'session', typeHint: 'string', defaultValue: '' }
        ]
      },
      screens: {
        root: {
          id: 'root',
          type: 'menu',
          title: 'Agent',
          body: '',
          titleTemplate: '',
          bodyTemplate: '',
          bindings: null,
          input: { mode: 'menu' },
          items: [
            {
              id: '__voice__',
              label: 'Speak to Agent',
              labelTemplate: '',
              value: '',
              run: {
                type: 'dictation',
                variable: 'transcript',
                then: {
                  type: 'agent_prompt',
                  prompt: '{{var.transcript}}'
                }
              }
            },
            {
              id: 'start',
              label: 'Start Conversation',
              labelTemplate: '',
              value: '',
              run: {
                type: 'agent_prompt',
                prompt: 'Start a useful short conversation and ask me a yes or no question first.'
              }
            },
            {
              id: 'reset',
              label: 'Reset Thread',
              labelTemplate: '',
              value: '',
              run: { type: 'agent_command', command: 'reset' }
            }
          ]
        }
      }
    })
  },
  {
    id: 'timer',
    label: 'Countdown Timer',
    description: 'Card with a countdown timer that navigates when it expires.',
    graph: base({
      _builderMeta: {
        variables: [],
        storageKeys: [],
        dataItems: [
          { key: 'count', scope: 'session', typeHint: 'number', defaultValue: '0' }
        ]
      },
      screens: {
        root: {
          id: 'root',
          type: 'card',
          title: 'Timer Demo',
          body: '',
          titleTemplate: '',
          bodyTemplate: 'Timer: {{timer.remaining}}s\nTaps: {{var.count}}',
          bindings: null,
          input: { mode: 'menu' },
          timer: {
            durationMs: 10000,
            run: { type: 'navigate', screen: 'done' }
          },
          actions: [
            {
              slot: 'select',
              id: 'tap',
              icon: 'check',
              label: 'Tap',
              labelTemplate: '',
              value: '',
              run: { type: 'set_var', key: 'count', value: 'increment' }
            }
          ]
        },
        done: {
          id: 'done',
          type: 'card',
          title: 'Time Up',
          body: '',
          titleTemplate: '',
          bodyTemplate: 'You tapped {{var.count}} times.',
          bindings: null,
          input: { mode: 'menu' },
          actions: [
            {
              slot: 'select',
              id: 'restart',
              icon: 'check',
              label: 'Again',
              labelTemplate: '',
              value: '',
              run: { type: 'navigate', screen: 'root' }
            }
          ]
        }
      }
    })
  },
  {
    id: 'launcher',
    label: 'App Launcher',
    description: 'Multi-screen menu launcher with status cards and live time.',
    graph: base({
      screens: {
        root: {
          id: 'root',
          type: 'menu',
          title: 'Launcher',
          body: '',
          titleTemplate: '',
          bodyTemplate: '',
          bindings: null,
          input: { mode: 'menu' },
          items: [
            { id: 'status', label: 'Status', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'status' } },
            { id: 'clock', label: 'Clock', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'clock' } },
            { id: 'about', label: 'About', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'about' } }
          ]
        },
        status: {
          id: 'status',
          type: 'card',
          title: 'Status',
          body: 'All systems nominal.',
          titleTemplate: '',
          bodyTemplate: '',
          bindings: null,
          input: { mode: 'menu' },
          actions: [
            { slot: 'select', id: 'back', icon: 'check', label: 'Back', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'root' } }
          ]
        },
        clock: {
          id: 'clock',
          type: 'card',
          title: 'Clock',
          body: '',
          titleTemplate: '',
          bodyTemplate: '{{time.localString}}',
          bindings: {
            time: { source: 'device.time', live: true, refreshMs: 30000 }
          },
          input: { mode: 'menu' },
          actions: [
            { slot: 'select', id: 'back', icon: 'check', label: 'Back', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'root' } }
          ]
        },
        about: {
          id: 'about',
          type: 'card',
          title: 'About',
          body: 'Pebble SDUI app built with Stewie Builder.',
          titleTemplate: '',
          bodyTemplate: '',
          bindings: null,
          input: { mode: 'menu' },
          actions: [
            { slot: 'select', id: 'back', icon: 'check', label: 'Back', labelTemplate: '', value: '', run: { type: 'navigate', screen: 'root' } }
          ]
        }
      }
    })
  }
]
