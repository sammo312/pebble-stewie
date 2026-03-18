import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyPreviewStorageMutationToState,
  applyPreviewVarMutationToState,
  computePreviewJump,
  evaluatePreviewCondition,
  executePreviewHookSequence
} from '../apps/screen-builder-web/app/lib/preview-runtime.mjs'

function createRuntimeDeps(overrides = {}) {
  return {
    runtimeValues: {
      evaluateCondition(condition, vars) {
        if (!condition || !condition.key) {
          return true
        }
        return String(vars?.[condition.key] ?? '') === String(condition.value ?? '')
      },
      applySetVar(run, vars) {
        if (!run?.key) {
          return null
        }
        return {
          ...(vars || {}),
          [run.key]: run.value ?? ''
        }
      },
      applyStore(run, sourceScreen, vars, storage) {
        if (!run?.key) {
          return null
        }

        let nextValue = run.value
        if (run.value === '$screen') {
          nextValue = sourceScreen?.id ?? ''
        } else if (run.value === '$var') {
          nextValue = vars?.[run.varKey] ?? ''
        }

        return {
          ...(storage || {}),
          [run.key]: nextValue
        }
      }
    },
    maxRedirectDepth: 8,
    now: () => 1000,
    ...overrides
  }
}

test('preview runtime delegates condition and mutation helpers', () => {
  const deps = createRuntimeDeps()

  assert.equal(evaluatePreviewCondition({ key: 'mode', value: 'ready' }, { mode: 'ready' }, deps), true)
  assert.deepEqual(
    applyPreviewVarMutationToState({ type: 'set_var', key: 'mode', value: 'ready' }, { mode: 'idle' }, deps),
    { mode: 'ready' }
  )
  assert.deepEqual(
    applyPreviewStorageMutationToState(
      { type: 'store', key: 'lastScreen', value: '$screen' },
      { id: 'root' },
      { mode: 'ready' },
      {},
      deps
    ),
    { lastScreen: 'root' }
  )
})

test('executePreviewHookSequence accumulates vars, storage, and redirect', () => {
  const deps = createRuntimeDeps()

  const result = executePreviewHookSequence(
    [
      { type: 'set_var', key: 'mode', value: 'ready' },
      { type: 'store', key: 'savedMode', value: '$var', varKey: 'mode' },
      { type: 'navigate', condition: { key: 'mode', value: 'ready' }, screen: 'next' }
    ],
    { id: 'root' },
    {},
    {},
    deps
  )

  assert.deepEqual(result, {
    vars: { mode: 'ready' },
    storage: { savedMode: 'ready' },
    redirect: 'next'
  })
})

test('computePreviewJump runs exit and enter lifecycle hooks until redirect settles', () => {
  const deps = createRuntimeDeps()
  const graph = {
    screens: {
      root: {
        id: 'root',
        onExit: [
          { type: 'set_var', key: 'phase', value: 'exit' },
          { type: 'navigate', condition: { key: 'allowRedirect', value: 'yes' }, screen: 'gate' }
        ]
      },
      menu: {
        id: 'menu',
        onEnter: []
      },
      gate: {
        id: 'gate',
        onEnter: [
          { type: 'store', key: 'visited', value: '$screen' },
          { type: 'navigate', screen: 'final' }
        ]
      },
      final: {
        id: 'final',
        onEnter: [{ type: 'set_var', key: 'phase', value: 'final' }]
      }
    }
  }

  const result = computePreviewJump(
    graph,
    'menu',
    {
      sourceScreen: graph.screens.root,
      storage: {},
      vars: { allowRedirect: 'yes' }
    },
    deps
  )

  assert.deepEqual(result, {
    ok: true,
    targetScreenId: 'final',
    vars: {
      allowRedirect: 'yes',
      phase: 'final'
    },
    storage: {
      visited: 'gate'
    },
    nextTimerDeadline: null
  })
})

test('computePreviewJump computes timer deadline from target timer', () => {
  const deps = createRuntimeDeps({ now: () => 5000 })
  const graph = {
    screens: {
      root: { id: 'root' },
      timer: {
        id: 'timer',
        timer: {
          durationMs: 250
        }
      }
    }
  }

  const result = computePreviewJump(
    graph,
    'timer',
    {
      sourceScreen: graph.screens.root,
      storage: {},
      vars: {}
    },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.targetScreenId, 'timer')
  assert.equal(result.nextTimerDeadline, 5250)
})

test('computePreviewJump fails when lifecycle redirects exceed the maximum depth', () => {
  const deps = createRuntimeDeps({ maxRedirectDepth: 2 })
  const graph = {
    screens: {
      root: { id: 'root' },
      alpha: {
        id: 'alpha',
        onEnter: [{ type: 'navigate', screen: 'beta' }]
      },
      beta: {
        id: 'beta',
        onEnter: [{ type: 'navigate', screen: 'gamma' }]
      },
      gamma: {
        id: 'gamma',
        onEnter: [{ type: 'navigate', screen: 'alpha' }]
      }
    }
  }

  assert.deepEqual(
    computePreviewJump(
      graph,
      'alpha',
      {
        sourceScreen: graph.screens.root,
        storage: {},
        vars: {}
      },
      deps
    ),
    { ok: false }
  )
})
