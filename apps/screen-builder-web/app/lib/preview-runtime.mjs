export function evaluatePreviewCondition(condition, vars, { runtimeValues }) {
  return runtimeValues.evaluateCondition(condition, vars)
}

export function applyPreviewVarMutationToState(run, vars, { runtimeValues }) {
  return runtimeValues.applySetVar(run, vars)
}

export function applyPreviewStorageMutationToState(run, sourceScreen, vars, storage, { runtimeValues }) {
  return runtimeValues.applyStore(run, sourceScreen, vars, storage)
}

export function executePreviewHookRun(run, sourceScreen, vars, storage, deps) {
  if (!run || !run.type) {
    return { vars, storage, redirect: '' }
  }

  if (run.type === 'navigate') {
    if (!evaluatePreviewCondition(run.condition, vars, deps)) {
      return { vars, storage, redirect: '' }
    }
    return {
      vars,
      storage,
      redirect: run.screen || ''
    }
  }

  if (run.type === 'set_var') {
    const nextVars = applyPreviewVarMutationToState(run, vars, deps)
    return {
      vars: nextVars || vars,
      storage,
      redirect: ''
    }
  }

  if (run.type === 'store') {
    const nextStorage = applyPreviewStorageMutationToState(run, sourceScreen, vars, storage, deps)
    return {
      vars,
      storage: nextStorage || storage,
      redirect: ''
    }
  }

  return { vars, storage, redirect: '' }
}

export function executePreviewHookSequence(runs, sourceScreen, vars, storage, deps) {
  let nextVars = { ...(vars || {}) }
  let nextStorage = { ...(storage || {}) }
  let redirect = ''

  ;(runs || []).forEach((run) => {
    const result = executePreviewHookRun(run, sourceScreen, nextVars, nextStorage, deps)
    nextVars = result.vars
    nextStorage = result.storage
    if (result.redirect) {
      redirect = result.redirect
    }
  })

  return {
    vars: nextVars,
    storage: nextStorage,
    redirect
  }
}

export function computePreviewJump(graph, screenId, options = {}, deps) {
  if (!screenId || !graph?.screens?.[screenId]) {
    return { ok: false }
  }

  let targetScreenId = screenId
  let nextVars = { ...(options.vars || {}) }
  let nextStorage = { ...(options.storage || {}) }
  const shouldRunLifecycle = options.runLifecycle !== false
  const sourceScreen = options.sourceScreen || null

  if (shouldRunLifecycle && sourceScreen && sourceScreen.id !== targetScreenId) {
    const exitResult = executePreviewHookSequence(sourceScreen.onExit, sourceScreen, nextVars, nextStorage, deps)
    nextVars = exitResult.vars
    nextStorage = exitResult.storage
    if (exitResult.redirect) {
      targetScreenId = exitResult.redirect
    }
  }

  let depth = 0
  const maxDepth = typeof deps.maxRedirectDepth === 'number' ? deps.maxRedirectDepth : 8
  while (shouldRunLifecycle && depth < maxDepth) {
    const nextScreen = graph.screens[targetScreenId]
    if (!nextScreen) {
      return { ok: false }
    }

    const enterResult = executePreviewHookSequence(nextScreen.onEnter, nextScreen, nextVars, nextStorage, deps)
    nextVars = enterResult.vars
    nextStorage = enterResult.storage
    if (enterResult.redirect && enterResult.redirect !== targetScreenId) {
      targetScreenId = enterResult.redirect
      depth += 1
      continue
    }
    break
  }

  if (depth >= maxDepth) {
    return { ok: false }
  }

  const targetScreen = graph.screens[targetScreenId]
  const now = typeof deps.now === 'function' ? deps.now() : Date.now()
  const nextTimerDeadline =
    targetScreen?.timer && (sourceScreen?.id !== targetScreenId || options.forceLifecycle)
      ? now + Math.max(100, Number(targetScreen.timer.durationMs || 5000))
      : sourceScreen?.id === targetScreenId
        ? options.timerDeadline ?? null
        : null

  return {
    ok: true,
    targetScreenId,
    vars: nextVars,
    storage: nextStorage,
    nextTimerDeadline
  }
}
