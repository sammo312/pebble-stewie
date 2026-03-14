import * as sduiContractModule from '@pebble/sdui-contract'

const contract = sduiContractModule.default || sduiContractModule
export const { constants, builderElements, graphSchema } = contract

export const bindingPresets = [
  {
    id: 'none',
    label: 'No bindings',
    value: ''
  },
  {
    id: 'time-live',
    label: 'Device Time (live, 30s refresh)',
    value: JSON.stringify(
      {
        time: {
          source: 'device.time',
          live: true,
          refreshMs: 30000
        }
      },
      null,
      2
    )
  },
  {
    id: 'time-once',
    label: 'Device Time (single read)',
    value: JSON.stringify(
      {
        time: {
          source: 'device.time',
          live: false
        }
      },
      null,
      2
    )
  }
]

export const FIELD_LABELS = {
  id: 'Screen ID',
  type: 'Screen Type',
  title: 'Title',
  body: 'Body Text',
  titleTemplate: 'Dynamic Title',
  bodyTemplate: 'Dynamic Body',
  bindings: 'Live Data',
  'input.mode': 'Input Mode',
  'run.type': 'When Tapped',
  'run.screen': 'Go To Screen',
  'run.prompt': 'Agent Prompt',
  'run.command': 'Agent Command',
  'run.effect': 'Native Effect',
  'run.vibe': 'Vibration',
  'run.light': 'Flash Backlight',
  slot: 'Button',
  icon: 'Icon',
  label: 'Label',
  value: 'Value',
  labelTemplate: 'Dynamic Label',
  items: 'Menu Items',
  actions: 'Actions',
  'drawing.playMode': 'Playback',
  'drawing.background': 'Stage',
  'drawing.timelineMs': 'Timeline',
  'drawing.steps': 'Motion Steps'
}

export const FIELD_DESCRIPTIONS = {
  id: 'Unique identifier for this screen',
  type: 'menu = selectable list, card = info + buttons, scroll = long text, draw = animated graphics canvas',
  title: 'Shown at top of screen (max 30 chars)',
  body: 'Main content text or optional notes',
  titleTemplate: 'Use {{binding.property}} for live data, e.g. {{time.localString}}',
  bodyTemplate: 'Use {{binding.property}} for live data',
  bindings: 'Connect live data sources to dynamic templates',
  'input.mode': 'How the user interacts: buttons, voice, or both',
  'run.type': 'What happens when the user taps this',
  'run.screen': 'Which screen to navigate to',
  'run.prompt': 'Text sent to the AI agent',
  'run.command': 'Command sent to the AI agent',
  'run.effect': 'Run a native watch-only effect without changing screens',
  'run.vibe': 'Vibrate the watch on this action',
  'run.light': 'Flash the backlight on this action',
  slot: 'Physical button: up, select (middle), or down',
  icon: 'Icon shown on the card action bar'
}

export const SCREEN_TYPE_ICONS = { menu: '\u2630', card: '\u25AD', scroll: '\u2195', draw: '\u25C8' }

export const RUN_TARGETS = [
  {
    id: '__run_target_agent_prompt__',
    runType: 'agent_prompt',
    title: 'Agent Prompt',
    subtitle: 'Send user text into the agent flow',
    badge: 'agent'
  },
  {
    id: '__run_target_agent_command__',
    runType: 'agent_command',
    title: 'Agent Command',
    subtitle: 'Send a command into the agent flow',
    badge: 'command'
  },
  {
    id: '__run_target_effect__',
    runType: 'effect',
    title: 'Native Effect',
    subtitle: 'Vibration / backlight',
    badge: 'native'
  }
]

const RUN_TARGET_BY_ID = RUN_TARGETS.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

export function isRunTargetId(id) {
  return !!RUN_TARGET_BY_ID[id]
}

export function getRunTargetDefinition(id) {
  return RUN_TARGET_BY_ID[id] || null
}

export function screenUsesButtonSlots(screen) {
  return !!screen && screen.type === 'card'
}

export function screenUsesSelectDrawer(screen) {
  return !!screen && screen.type === 'scroll'
}

export function screenUsesDrawingCanvas(screen) {
  return !!screen && screen.type === 'draw'
}

export function screenSupportsActions(screen) {
  return !!screen && (screenUsesButtonSlots(screen) || screenUsesSelectDrawer(screen))
}

export function getScreenActions(screen) {
  return screenSupportsActions(screen) && Array.isArray(screen.actions) ? screen.actions : []
}

export function fieldLabel(id) {
  return FIELD_LABELS[id] || id
}

export function createDefaultGraph() {
  return {
    schemaVersion: constants.SDUI_SCHEMA_VERSION,
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        title: 'Main Menu',
        body: '',
        titleTemplate: '',
        bodyTemplate: '',
        bindings: null,
        input: { mode: 'menu' },
        items: [
          { id: 'help', label: 'Help', value: 'help', labelTemplate: '', run: { type: 'navigate', screen: 'help' } }
        ]
      },
      help: {
        id: 'help',
        type: 'card',
        title: 'Help',
        body: 'Wire your flows by pointing items or actions at target screens. Use the graph canvas to see links.',
        titleTemplate: '',
        bodyTemplate: '',
        bindings: null,
        input: { mode: 'menu' },
        actions: [
          { slot: 'select', id: 'back', icon: 'check', label: 'Back', value: 'root', run: { type: 'navigate', screen: 'root' } }
        ]
      }
    }
  }
}
