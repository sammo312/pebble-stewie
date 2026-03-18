export function prepareGraphForBuilder(candidate, { normalizeCanonicalGraph, inferBuilderMetaFromGraph }) {
  const normalized = normalizeCanonicalGraph(candidate)
  if (!normalized) {
    return null
  }

  if (candidate && candidate._builderMeta) {
    normalized._builderMeta = candidate._builderMeta
  } else {
    normalized._builderMeta = inferBuilderMetaFromGraph(normalized)
  }

  return normalized
}

export function parseImportedGraphText(importText, deps) {
  let parsed
  try {
    parsed = JSON.parse(importText)
  } catch (error) {
    return {
      ok: false,
      error: `Import JSON parse error: ${error.message}`
    }
  }

  const candidate = parsed && parsed.graph ? parsed.graph : parsed
  const normalized = prepareGraphForBuilder(candidate, deps)
  if (!normalized) {
    return {
      ok: false,
      error: 'Import failed. Payload is not a canonical graph.'
    }
  }

  return {
    ok: true,
    graph: normalized
  }
}

export function prepareTemplateGraph(template, deps) {
  if (!template || !template.graph) {
    return null
  }

  const candidate = JSON.parse(JSON.stringify(template.graph))
  return prepareGraphForBuilder(candidate, deps)
}

export function createGraphLoadState(graph, options = {}) {
  const nextState = {
    graph,
    selectedScreenId: graph.entryScreenId,
    selectedNodeId: '',
    previewPlaceholderScreen: null,
    previewScreenId: graph.entryScreenId,
    previewHistory: [],
    bindingsDraftByScreen: {},
    visibleRunTargetIds: [],
    resetNodePositions: true,
    resetRunTargetPositions: true
  }

  if (options.setImportText) {
    nextState.importText = JSON.stringify(graph, null, 2)
  }

  if (options.resetPreviewRuntime) {
    nextState.previewVars = {}
    nextState.previewStorage = {}
  }

  return nextState
}
