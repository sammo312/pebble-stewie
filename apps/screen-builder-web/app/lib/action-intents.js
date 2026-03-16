export const ACTION_INTENTS = [
  {
    id: 'navigate',
    label: 'Go To Screen',
    runType: 'navigate',
    fields: ['run.screen', 'run.condition.var', 'run.condition.op', 'run.condition.value']
  },
  {
    id: 'increment',
    label: 'Increment',
    runType: 'set_var',
    fields: ['variableKey']
  },
  {
    id: 'decrement',
    label: 'Decrement',
    runType: 'set_var',
    fields: ['variableKey']
  },
  {
    id: 'toggle',
    label: 'Toggle',
    runType: 'set_var',
    fields: ['variableKey']
  },
  {
    id: 'set_to',
    label: 'Set To',
    runType: 'set_var',
    fields: ['variableKey', 'literalValue']
  },
  {
    id: 'store',
    label: 'Store Value',
    runType: 'store',
    fields: ['storageKey', 'valueTemplate']
  },
  {
    id: 'effect',
    label: 'Vibrate / Light',
    runType: 'effect',
    fields: ['run.vibe', 'run.light']
  },
  {
    id: 'agent_prompt',
    label: 'Ask Agent',
    runType: 'agent_prompt',
    fields: ['run.prompt']
  },
  {
    id: 'agent_command',
    label: 'Command Agent',
    runType: 'agent_command',
    fields: ['run.command']
  },
  {
    id: 'dictation',
    label: 'Dictation (Mic)',
    runType: 'dictation',
    fields: ['run.variable', 'run.screen']
  }
]

const INTENT_BY_ID = ACTION_INTENTS.reduce((acc, intent) => {
  acc[intent.id] = intent
  return acc
}, {})

const SHORTHAND_VALUE_MAP = {
  increment: 'increment',
  decrement: 'decrement',
  toggle: 'toggle'
}

export function inferIntentFromRun(run) {
  if (!run || !run.type) {
    return { intentId: '', params: {} }
  }

  if (run.type === 'navigate') {
    return {
      intentId: 'navigate',
      params: {
        screen: run.screen || '',
        condition: run.condition || null
      }
    }
  }

  if (run.type === 'set_var') {
    const value = String(run.value || '')
    if (SHORTHAND_VALUE_MAP[value]) {
      return {
        intentId: value,
        params: { variableKey: run.key || '' }
      }
    }
    return {
      intentId: 'set_to',
      params: {
        variableKey: run.key || '',
        literalValue: value
      }
    }
  }

  if (run.type === 'store') {
    return {
      intentId: 'store',
      params: {
        storageKey: run.key || '',
        valueTemplate: run.value || ''
      }
    }
  }

  if (run.type === 'effect') {
    return {
      intentId: 'effect',
      params: {
        vibe: run.vibe || '',
        light: !!run.light
      }
    }
  }

  if (run.type === 'agent_prompt') {
    return {
      intentId: 'agent_prompt',
      params: { prompt: run.prompt || '' }
    }
  }

  if (run.type === 'agent_command') {
    return {
      intentId: 'agent_command',
      params: { command: run.command || '' }
    }
  }

  if (run.type === 'dictation') {
    return {
      intentId: 'dictation',
      params: {
        variable: run.variable || '',
        screen: run.screen || '',
        then: run.then || null
      }
    }
  }

  return { intentId: '', params: {} }
}

export function compileIntentToRun(intentId, params, existingRun = {}) {
  const run = {}

  switch (intentId) {
    case 'navigate':
      run.type = 'navigate'
      if (params.screen) run.screen = params.screen
      if (params.condition) run.condition = params.condition
      break
    case 'increment':
      run.type = 'set_var'
      run.key = params.variableKey || ''
      run.value = 'increment'
      break
    case 'decrement':
      run.type = 'set_var'
      run.key = params.variableKey || ''
      run.value = 'decrement'
      break
    case 'toggle':
      run.type = 'set_var'
      run.key = params.variableKey || ''
      run.value = 'toggle'
      break
    case 'set_to':
      run.type = 'set_var'
      run.key = params.variableKey || ''
      run.value = params.literalValue || ''
      break
    case 'store':
      run.type = 'store'
      run.key = params.storageKey || ''
      run.value = params.valueTemplate || ''
      break
    case 'effect':
      run.type = 'effect'
      if (params.vibe) run.vibe = params.vibe
      if (params.light) run.light = true
      break
    case 'agent_prompt':
      run.type = 'agent_prompt'
      run.prompt = params.prompt || ''
      break
    case 'agent_command':
      run.type = 'agent_command'
      run.command = params.command || ''
      break
    case 'dictation':
      run.type = 'dictation'
      run.variable = params.variable || ''
      if (params.screen) run.screen = params.screen
      if (params.then && params.then.type) run.then = params.then
      break
    default:
      return existingRun
  }

  if (existingRun.vibe && intentId !== 'effect') run.vibe = existingRun.vibe
  if (existingRun.light && intentId !== 'effect') run.light = existingRun.light

  return run
}

export function getIntentDefinition(intentId) {
  return INTENT_BY_ID[intentId] || null
}

export function getIntentOptionsForSchema(descriptor) {
  const supportedRunTypes = descriptor?.enums?.runTypes || []
  return ACTION_INTENTS.filter((intent) => supportedRunTypes.includes(intent.runType))
}
