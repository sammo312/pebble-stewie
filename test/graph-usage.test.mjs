import test from 'node:test'
import assert from 'node:assert/strict'

import {
  countUnmappedEntities,
  getRunTargetNodeIdForType,
  getCanvasTargetIdForRun,
  collectRequiredRunTargetIds,
  collectNodeUsages,
  collectRunTargetUsageSummary,
  remapNavigateTargets
} from '../apps/screen-builder-web/app/lib/graph-usage.mjs'

test('run target helpers resolve node ids and required targets', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        items: [{ id: 'item_1', run: { type: 'set_var', key: 'count', value: '1' } }],
        onEnter: [{ type: 'effect', vibe: 'short' }],
        timer: { run: { type: 'store', key: 'saved', value: 'ok' } }
      }
    }
  }

  assert.equal(getRunTargetNodeIdForType('set_var'), '__run_target_set_var__')
  assert.equal(getCanvasTargetIdForRun({ type: 'navigate', screen: 'detail' }), 'detail')
  assert.deepEqual(
    collectRequiredRunTargetIds(graph).sort(),
    ['__run_target_effect__', '__run_target_set_var__', '__run_target_store__']
  )
})

test('countUnmappedEntities counts incomplete items, hooks, actions, and timers', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'card',
        items: [{ id: 'item_1' }],
        actions: [{ id: 'action_1', run: { type: 'navigate', screen: '' } }],
        onEnter: [{ type: 'effect' }],
        onExit: [{ type: 'set_var', key: 'count', value: '1' }],
        timer: { run: { type: 'store', key: '', value: 'missing' } }
      }
    }
  }

  assert.equal(countUnmappedEntities(graph), 4)
})

test('collectNodeUsages and usage summary describe matching entities', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        title: 'Home',
        type: 'menu',
        items: [
          { id: 'go', label: 'Go', run: { type: 'navigate', screen: 'detail' } }
        ],
        onEnter: [{ type: 'effect', vibe: 'short' }]
      },
      detail: {
        id: 'detail',
        title: 'Detail',
        type: 'scroll',
        actions: [
          { id: 'save', label: 'Save', run: { type: 'store', key: 'saved', value: 'yes' } }
        ],
        timer: { run: { type: 'store', key: 'saved', value: 'later' } }
      }
    }
  }

  const navUsages = collectNodeUsages(graph, 'detail')
  assert.deepEqual(navUsages, [
    {
      id: 'root:item:go',
      sourceScreenId: 'root',
      sourceScreenLabel: 'Home',
      entityKind: 'Menu Item',
      entityLabel: 'Go',
      runSummary: '→ detail'
    }
  ])

  const storeSummary = collectRunTargetUsageSummary(graph, '__run_target_store__')
  assert.equal(storeSummary.count, 2)
  assert.deepEqual(storeSummary.lines, [
    'Detail: Save → → store saved = yes',
    'Detail: Timer → → store saved = later'
  ])
})

test('remapNavigateTargets updates screen references across entities', () => {
  const screens = {
    root: {
      id: 'root',
      type: 'menu',
      items: [{ id: 'go', run: { type: 'navigate', screen: 'old' } }],
      onEnter: [{ type: 'navigate', screen: 'old' }]
    },
    detail: {
      id: 'detail',
      type: 'scroll',
      actions: [{ id: 'confirm', run: { type: 'navigate', screen: 'old' } }],
      onExit: [{ type: 'navigate', screen: 'old' }],
      timer: { run: { type: 'navigate', screen: 'old' } }
    },
    card: {
      id: 'card',
      type: 'card',
      onEnter: [{ type: 'navigate', screen: 'old' }],
      onExit: [{ type: 'navigate', screen: 'old' }]
    }
  }

  const remapped = remapNavigateTargets(screens, 'old', 'new')

  assert.equal(remapped.root.items[0].run.screen, 'new')
  assert.equal(remapped.root.onEnter[0].screen, 'new')
  assert.equal(remapped.detail.actions[0].run.screen, 'new')
  assert.equal(remapped.detail.onExit[0].screen, 'new')
  assert.equal(remapped.detail.timer.run.screen, 'new')
  assert.equal(remapped.card.onEnter[0].screen, 'new')
  assert.equal(remapped.card.onExit[0].screen, 'new')
})
