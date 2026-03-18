import { getScreenActions } from './constants.js'

const CONTENT_TEMPLATE_FIELDS = {
  title: 'titleTemplate',
  body: 'bodyTemplate',
  label: 'labelTemplate'
}

function getScreenHookRuns(screen, hookKey) {
  if (!screen || (hookKey !== 'onEnter' && hookKey !== 'onExit')) {
    return []
  }
  return Array.isArray(screen[hookKey]) ? screen[hookKey] : []
}

function getScreenTimerRun(screen) {
  return screen?.timer?.run || null
}

function getNestedValue(obj, path) {
  if (!obj || !path) {
    return ''
  }

  if (!path.includes('.')) {
    const direct = obj[path]
    return direct === undefined || direct === null ? '' : direct
  }

  const segments = path.split('.')
  let cursor = obj
  for (let i = 0; i < segments.length; i += 1) {
    if (!cursor || typeof cursor !== 'object') {
      return ''
    }
    cursor = cursor[segments[i]]
  }

  return cursor === undefined || cursor === null ? '' : cursor
}

function getContentTemplateFieldId(fieldId) {
  return CONTENT_TEMPLATE_FIELDS[fieldId] || ''
}

function getDisplayFieldValue(entity, fieldId) {
  const templateFieldId = getContentTemplateFieldId(fieldId)
  if (templateFieldId) {
    const templateValue = getNestedValue(entity, templateFieldId)
    if (templateValue !== '') {
      return templateValue
    }
  }

  return getNestedValue(entity, fieldId)
}

function collectTemplateReferenceKeys(text, scope, output) {
  if (!text || !scope || !output) {
    return
  }

  const pattern = new RegExp(`\\{\\{\\s*${scope}\\.([a-zA-Z0-9_-]+)(?:\\.[a-zA-Z0-9_.-]+)?\\s*\\}\\}`, 'g')
  let match = pattern.exec(String(text))
  while (match) {
    if (match[1]) {
      output.add(String(match[1]))
    }
    match = pattern.exec(String(text))
  }
}

function collectRunReferenceKeys(run, variableKeys, storageKeys) {
  if (!run || typeof run !== 'object') {
    return
  }

  if (run.type === 'set_var' && run.key) {
    variableKeys.add(String(run.key))
  }
  if (run.type === 'dictation' && run.variable) {
    variableKeys.add(String(run.variable))
  }
  if (run.type === 'store' && run.key) {
    storageKeys.add(String(run.key))
  }
  if (run.type === 'navigate' && run.condition?.var) {
    variableKeys.add(String(run.condition.var))
  }

  collectTemplateReferenceKeys(run.value, 'var', variableKeys)
  collectTemplateReferenceKeys(run.value, 'storage', storageKeys)
  collectTemplateReferenceKeys(run.prompt, 'var', variableKeys)
  collectTemplateReferenceKeys(run.prompt, 'storage', storageKeys)
  collectTemplateReferenceKeys(run.command, 'var', variableKeys)
  collectTemplateReferenceKeys(run.command, 'storage', storageKeys)

  if (run.then && typeof run.then === 'object' && run.then.type) {
    collectRunReferenceKeys(run.then, variableKeys, storageKeys)
  }
}

export function collectGraphReferenceCatalog(graph, selectedScreenId = '') {
  const screens = graph?.screens || {}
  const screenIds = Object.keys(screens)
  const inferredVarKeys = new Set()
  const inferredStorageKeys = new Set()
  const selectedScreen = selectedScreenId ? screens[selectedScreenId] : null
  const bindingKeys = new Set(
    selectedScreen?.bindings && typeof selectedScreen.bindings === 'object'
      ? Object.keys(selectedScreen.bindings)
      : []
  )

  screenIds.forEach((screenId) => {
    const screen = screens[screenId]
    if (!screen) {
      return
    }

    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'title'), 'var', inferredVarKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'title'), 'storage', inferredStorageKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'body'), 'var', inferredVarKeys)
    collectTemplateReferenceKeys(getDisplayFieldValue(screen, 'body'), 'storage', inferredStorageKeys)

    if (screen.bindings && typeof screen.bindings === 'object') {
      Object.values(screen.bindings).forEach((binding) => {
        const source = String(binding?.source || '')
        if (source.startsWith('storage.')) {
          inferredStorageKeys.add(source.slice('storage.'.length))
        }
      })
    }

    ;(screen.items || []).forEach((item) => {
      collectTemplateReferenceKeys(getDisplayFieldValue(item, 'label'), 'var', inferredVarKeys)
      collectTemplateReferenceKeys(getDisplayFieldValue(item, 'label'), 'storage', inferredStorageKeys)
      collectRunReferenceKeys(item?.run, inferredVarKeys, inferredStorageKeys)
    })

    getScreenActions(screen).forEach((action) => {
      collectTemplateReferenceKeys(getDisplayFieldValue(action, 'label'), 'var', inferredVarKeys)
      collectTemplateReferenceKeys(getDisplayFieldValue(action, 'label'), 'storage', inferredStorageKeys)
      collectRunReferenceKeys(action?.run, inferredVarKeys, inferredStorageKeys)
    })

    getScreenHookRuns(screen, 'onEnter').forEach((run) => collectRunReferenceKeys(run, inferredVarKeys, inferredStorageKeys))
    getScreenHookRuns(screen, 'onExit').forEach((run) => collectRunReferenceKeys(run, inferredVarKeys, inferredStorageKeys))
    collectRunReferenceKeys(getScreenTimerRun(screen), inferredVarKeys, inferredStorageKeys)
  })

  const meta = graph?._builderMeta
  const dataItems = Array.isArray(meta?.dataItems) && meta.dataItems.length > 0 ? meta.dataItems : null
  const declaredVariables = dataItems
    ? dataItems.filter((d) => d.scope === 'session').map((d) => ({ key: d.key, defaultValue: d.defaultValue || '', typeHint: d.typeHint || 'string' }))
    : (Array.isArray(meta?.variables) ? meta.variables : [])
  const declaredStorageKeys = dataItems
    ? dataItems.filter((d) => d.scope === 'persistent').map((d) => ({ key: d.key, typeHint: d.typeHint || 'string' }))
    : (Array.isArray(meta?.storageKeys) ? meta.storageKeys : [])
  const declaredDeviceItems = dataItems
    ? dataItems.filter((d) => d.scope === 'device')
    : []
  const declaredVarKeySet = new Set(declaredVariables.map((v) => v.key))
  const declaredStorageKeySet = new Set(declaredStorageKeys.map((s) => s.key))

  const allVarKeys = new Set([...inferredVarKeys, ...declaredVarKeySet])
  const allStorageKeys = new Set([...inferredStorageKeys, ...declaredStorageKeySet])

  const undeclaredVariableKeys = Array.from(inferredVarKeys).filter((k) => !declaredVarKeySet.has(k)).sort()
  const undeclaredStorageKeys = Array.from(inferredStorageKeys).filter((k) => !declaredStorageKeySet.has(k)).sort()

  return {
    screenOptions: screenIds.map((screenId) => {
      const screen = screens[screenId]
      const title = String(screen?.title || '')
      return {
        value: screenId,
        label: title && title !== screenId ? `${screenId} - ${title}` : screenId
      }
    }),
    variableKeys: Array.from(allVarKeys).filter(Boolean).sort(),
    storageKeys: Array.from(allStorageKeys).filter(Boolean).sort(),
    bindingKeys: Array.from(bindingKeys).filter(Boolean).sort(),
    declaredVariables,
    declaredStorageKeys,
    declaredDeviceItems,
    dataItems: dataItems || [],
    undeclaredVariableKeys,
    undeclaredStorageKeys
  }
}

export function inferBuilderMetaFromGraph(graph) {
  const catalog = collectGraphReferenceCatalog(graph, '')
  const variables = catalog.variableKeys.map((key) => ({ key, defaultValue: '', typeHint: 'string' }))
  const storageKeys = catalog.storageKeys.map((key) => ({ key, typeHint: 'string' }))

  const dataItems = [
    ...variables.map((v) => ({ key: v.key, scope: 'session', defaultValue: v.defaultValue, typeHint: v.typeHint })),
    ...storageKeys.map((s) => ({ key: s.key, scope: 'persistent', typeHint: s.typeHint }))
  ]

  const screens = graph?.screens || {}
  Object.values(screens).forEach((screen) => {
    if (screen.bindings && typeof screen.bindings === 'object') {
      Object.entries(screen.bindings).forEach(([alias, binding]) => {
        if (!dataItems.some((d) => d.key === alias && d.scope === 'device')) {
          dataItems.push({
            key: alias,
            scope: 'device',
            source: binding.source || '',
            live: !!binding.live,
            refreshMs: binding.refreshMs || 0
          })
        }
      })
    }
  })

  return { variables, storageKeys, dataItems }
}

export function compileVariableDefaults(graph) {
  const meta = graph?._builderMeta
  const dataItems = Array.isArray(meta?.dataItems) && meta.dataItems.length > 0 ? meta.dataItems : null
  const sessionVars = dataItems
    ? dataItems.filter((d) => d.scope === 'session' && d.key && d.defaultValue !== '' && d.defaultValue != null)
    : (Array.isArray(meta?.variables) ? meta.variables : []).filter((v) => v.key && v.defaultValue !== '' && v.defaultValue != null)

  const deviceItems = dataItems
    ? dataItems.filter((d) => d.scope === 'device' && d.key && d.source)
    : []

  let result = graph

  if (sessionVars.length > 0) {
    const entryId = result.entryScreenId
    const entryScreen = result.screens?.[entryId]
    if (entryScreen) {
      const existingOnEnter = Array.isArray(entryScreen.onEnter) ? entryScreen.onEnter : []
      const existingSetVarKeys = new Set(
        existingOnEnter.filter((r) => r?.type === 'set_var' && r.key).map((r) => r.key)
      )
      const initRuns = sessionVars
        .filter((v) => !existingSetVarKeys.has(v.key))
        .map((v) => ({ type: 'set_var', key: v.key, value: v.defaultValue }))

      if (initRuns.length > 0) {
        result = {
          ...result,
          screens: {
            ...result.screens,
            [entryId]: {
              ...entryScreen,
              onEnter: [...initRuns, ...existingOnEnter]
            }
          }
        }
      }
    }
  }

  if (deviceItems.length > 0) {
    const screens = { ...result.screens }
    const screenIds = Object.keys(screens)

    deviceItems.forEach((item) => {
      const tokenPattern = new RegExp(`\\{\\{\\s*${item.key}[\\.\\s}]`)
      screenIds.forEach((screenId) => {
        const screen = screens[screenId]
        const texts = [
          screen.title, screen.titleTemplate,
          screen.body, screen.bodyTemplate,
          ...(screen.items || []).flatMap((i) => [i.label, i.labelTemplate]),
          ...(Array.isArray(screen.actions) ? screen.actions : []).flatMap((a) => [a.label, a.labelTemplate])
        ].filter(Boolean)

        const usesToken = texts.some((t) => tokenPattern.test(String(t)))
        if (!usesToken) return

        const existingBindings = screen.bindings && typeof screen.bindings === 'object' ? screen.bindings : {}
        if (existingBindings[item.key]) return

        screens[screenId] = {
          ...screen,
          bindings: {
            ...existingBindings,
            [item.key]: {
              source: item.source,
              ...(item.live ? { live: true } : {}),
              ...(item.refreshMs ? { refreshMs: item.refreshMs } : {})
            }
          }
        }
      })
    })

    result = { ...result, screens }
  }

  return result
}
