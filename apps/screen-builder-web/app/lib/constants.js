import * as sduiContractModule from '@pebble/sdui-contract'

const contract = sduiContractModule.default || sduiContractModule
export const { constants, schemaRegistry, builderElements, graphSchema, motionCompiler } = contract

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
  },
  {
    id: 'storage-high-score',
    label: 'Storage (high score)',
    requiresRunTypes: ['store'],
    value: JSON.stringify(
      {
        highScore: {
          source: 'storage.high_score',
          live: false
        }
      },
      null,
      2
    )
  }
]

export const SCHEMA_VERSIONS = schemaRegistry.listSchemaVersions()

export function getBindingPresetsForSchema(schemaVersion) {
  const descriptor = schemaRegistry.getSchemaDescriptor(schemaVersion) || schemaRegistry.getSchemaDescriptor()
  const supportedRunTypes = descriptor?.enums?.runTypes || []

  return bindingPresets.filter((preset) => {
    const requiredRunTypes = preset.requiresRunTypes || []
    return requiredRunTypes.every((runType) => supportedRunTypes.includes(runType))
  })
}

export const FIELD_LABELS = {
  id: 'Screen ID',
  type: 'Screen Type',
  title: 'Title',
  body: 'Body Text',
  titleTemplate: 'Title Template',
  bodyTemplate: 'Body Template',
  bindings: 'Data Sources',
  'input.mode': 'Input Mode',
  onEnter: 'On Enter',
  onExit: 'On Exit',
  timer: 'Timer',
  'timer.durationMs': 'Delay (ms)',
  'run.type': 'Action',
  'run.screen': 'Go To Screen',
  'run.condition.var': 'If Variable',
  'run.condition.op': 'Condition',
  'run.condition.value': 'Compare To',
  'run.key': 'Variable',
  'run.value': 'Value',
  'run.prompt': 'Agent Prompt',
  'run.command': 'Agent Command',
  'run.effect': 'Native Effect',
  'run.vibe': 'Vibration',
  'run.light': 'Flash Backlight',
  slot: 'Button',
  icon: 'Icon',
  label: 'Label',
  value: 'Value',
  labelTemplate: 'Label Template',
  items: 'Menu Items',
  actions: 'Actions',
  'canvas.template': 'Canvas Template',
  'motion.playMode': 'Playback',
  'motion.background': 'Stage',
  'motion.timelineMs': 'Timeline (ms)',
  'motion.tracks': 'Motion Tracks',
  'drawing.playMode': 'Playback',
  'drawing.background': 'Stage',
  'drawing.timelineMs': 'Timeline (ms)',
  'drawing.steps': 'Motion Steps'
}

export const FIELD_DESCRIPTIONS = {
  id: 'Unique identifier for this screen',
  type: 'menu = selectable list, card = info + buttons, scroll = long text with optional select action menu, draw = animated motion canvas',
  title: 'Visible screen title. You can mix plain text with tokens like {{time.localString}}, {{var.score}}, or {{storage.high_score}} directly here.',
  body: 'Visible body copy. Mix plain text with tokens directly here when you want dynamic content.',
  titleTemplate: 'Optional render-time override for Title. Use binding names from this screen, plus {{var.key}}, {{storage.key}}, or {{timer.remaining}}',
  bodyTemplate: 'Optional render-time override for Body Text. Use binding names from this screen, plus {{var.key}}, {{storage.key}}, or {{timer.remaining}}',
  bindings: 'Define token names for this screen. Example: {"time":{"source":"device.time","live":true}} creates {{time.localString}}. {"best":{"source":"storage.high_score","live":false}} creates {{best}}.',
  'input.mode': 'How the user interacts: buttons, voice, or both',
  onEnter: 'Runs before the screen renders when it becomes active',
  onExit: 'Runs before leaving this screen',
  timer: 'One-shot delayed action for this screen',
  'timer.durationMs': 'How long to wait before firing the timer action',
  'run.type': 'What happens when the user taps this',
  'run.screen': 'Which screen to navigate to',
  'run.condition.var': 'Only navigate when this session variable passes the condition',
  'run.condition.op': 'Comparison used for conditional navigation',
  'run.condition.value': 'Value used by the condition check',
  'run.key': 'Session or storage key to update',
  'run.value': 'For vars use increment/toggle/true/10/literal:Sam. For store use plain text or templates like {{var.count}}',
  'run.prompt': 'Text sent to the AI agent',
  'run.command': 'Command sent to the AI agent',
  'run.effect': 'Run a native watch-only effect without changing screens',
  'run.vibe': 'Vibrate the watch on this action',
  'run.light': 'Flash the backlight on this action',
  slot: 'Physical button: up, select (middle), or down',
  icon: 'Icon shown on the card action bar',
  label: 'Visible label text. You can mix plain text with bindings, vars, storage, and timer tokens directly here.',
  'canvas.template': 'Choose how this custom draw screen is composed',
  'motion.playMode': 'How the preset motion repeats on the watch',
  'motion.background': 'Backdrop used behind the draw stage',
  'motion.timelineMs': 'Minimum total animation timeline length',
  'motion.tracks': 'Semantic motion tracks compiled into native draw steps',
  'drawing.playMode': 'How the draw animation repeats on the watch',
  'drawing.background': 'Backdrop used behind the draw stage',
  'drawing.timelineMs': 'Minimum total animation timeline length',
  'drawing.steps': 'Animated draw primitives rendered by the native layer'
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
  },
  {
    id: '__run_target_set_var__',
    runType: 'set_var',
    title: 'Set Variable',
    subtitle: 'Update session state on the phone runtime',
    badge: 'logic'
  },
  {
    id: '__run_target_store__',
    runType: 'store',
    title: 'Store Value',
    subtitle: 'Persist state in phone local storage',
    badge: 'storage'
  },
  {
    id: '__run_target_dictation__',
    runType: 'dictation',
    title: 'Native Microphone',
    subtitle: 'Trigger Pebble dictation and store transcript in a variable',
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
    schemaVersion: constants.LATEST_SDUI_SCHEMA_VERSION,
    storageNamespace: 'stewie_builder_demo',
    entryScreenId: 'root',
    _builderMeta: {
      variables: [],
      storageKeys: [],
      dataItems: []
    },
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
