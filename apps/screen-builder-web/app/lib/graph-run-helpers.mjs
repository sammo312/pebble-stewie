export function getScreenHookRuns(screen, hookKey) {
  if (!screen || (hookKey !== 'onEnter' && hookKey !== 'onExit')) {
    return []
  }
  return Array.isArray(screen[hookKey]) ? screen[hookKey] : []
}

export function getScreenTimerRun(screen) {
  return screen?.timer?.run || null
}

export function isRunConfigured(run) {
  if (!run || !run.type) {
    return false
  }

  if (run.type === 'navigate') {
    return !!run.screen
  }
  if (run.type === 'set_var') {
    return !!String(run.key || '').trim() && String(run.value || '').trim() !== ''
  }
  if (run.type === 'store') {
    return !!String(run.key || '').trim() && String(run.value || '').trim() !== ''
  }
  if (run.type === 'agent_prompt') {
    return !!String(run.prompt || '').trim()
  }
  if (run.type === 'agent_command') {
    return !!String(run.command || '').trim()
  }
  if (run.type === 'effect') {
    return !!run.vibe || !!run.light
  }
  if (run.type === 'dictation') {
    return !!String(run.variable || '').trim()
  }

  return false
}

export function describeRunTarget(run) {
  if (!run || !run.type) {
    return 'unmapped'
  }

  if (run.type === 'navigate') {
    if (!run.screen) {
      return 'navigation target missing'
    }
    if (run.condition && run.condition.var && run.condition.op) {
      const compareValue = run.condition.value !== undefined && run.condition.value !== null && run.condition.value !== ''
        ? ` ${run.condition.value}`
        : ''
      return `\u2192 ${run.screen} if ${run.condition.var} ${run.condition.op}${compareValue}`
    }
    return `\u2192 ${run.screen}`
  }
  if (run.type === 'set_var') {
    if (!run.key) return 'variable target missing'
    const value = String(run.value || '')
    if (value === 'increment') return `\u2192 increment ${run.key}`
    if (value === 'decrement') return `\u2192 decrement ${run.key}`
    if (value === 'toggle') return `\u2192 toggle ${run.key}`
    return `\u2192 set ${run.key} = ${value}`
  }
  if (run.type === 'store') {
    return run.key ? `\u2192 store ${run.key} = ${String(run.value || '')}` : 'storage target missing'
  }
  if (run.type === 'agent_prompt') {
    return run.prompt ? '\u2192 agent prompt' : 'agent prompt missing'
  }
  if (run.type === 'agent_command') {
    return run.command ? `\u2192 command ${run.command}` : 'agent command missing'
  }
  if (run.type === 'effect') {
    const parts = []
    if (run.vibe) {
      parts.push(run.vibe)
    }
    if (run.light) {
      parts.push('light')
    }
    return parts.length ? `\u2192 effect ${parts.join(' + ')}` : 'effect missing'
  }
  if (run.type === 'dictation') {
    if (!run.variable) return 'dictation variable missing'
    return `\u2192 dictate \u2192 ${run.variable}${run.screen ? ` \u2192 ${run.screen}` : ''}`
  }

  return run.type
}

export function isEntityWired(entity) {
  return isRunConfigured(entity && entity.run)
}
