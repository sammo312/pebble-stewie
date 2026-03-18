import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGraphEdges,
  buildGraphNodes,
  computeAutoPosition,
  computeRunTargetPosition
} from '../apps/screen-builder-web/app/lib/graph-canvas.mjs'

test('graph canvas positions use stable defaults', () => {
  assert.deepEqual(computeAutoPosition(0, 0), { x: 240, y: 0 })
  assert.deepEqual(computeRunTargetPosition(2), { x: 760, y: 220 })
})

test('buildGraphEdges maps screen entities to focused canvas edges', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'card',
        actions: [{ id: 'save', slot: 'up', label: 'Save', run: { type: 'store', key: 'saved', value: 'yes' } }],
        onExit: [{ type: 'navigate', screen: 'detail' }]
      },
      detail: {
        id: 'detail',
        type: 'scroll',
        actions: [{ id: 'confirm', label: 'Confirm', run: { type: 'navigate', screen: 'root' } }],
        onEnter: [{ type: 'effect', vibe: 'short' }],
        timer: { run: { type: 'store', key: 'saved', value: 'later' } }
      }
    }
  }

  const edges = buildGraphEdges(graph, { focusedNodeId: 'detail' })

  assert.deepEqual(
    edges.map((edge) => ({
      id: edge.id,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      label: edge.label,
      focused: edge.data.focused,
      muted: edge.data.muted
    })),
    [
      {
        id: 'root:slot-up:__run_target_store__',
        sourceHandle: 'slot-up',
        target: '__run_target_store__',
        label: '',
        focused: false,
        muted: true
      },
      {
        id: 'root:hook-onExit-0:detail',
        sourceHandle: 'hook-onExit-0',
        target: 'detail',
        label: 'onExit',
        focused: true,
        muted: false
      },
      {
        id: 'detail:action-confirm:root',
        sourceHandle: 'action-confirm',
        target: 'root',
        label: 'Confirm',
        focused: true,
        muted: false
      },
      {
        id: 'detail:hook-onEnter-0:__run_target_effect__',
        sourceHandle: 'hook-onEnter-0',
        target: '__run_target_effect__',
        label: 'onEnter',
        focused: true,
        muted: false
      },
      {
        id: 'detail:timer-run:__run_target_store__',
        sourceHandle: 'timer-run',
        target: '__run_target_store__',
        label: 'timer',
        focused: true,
        muted: false
      }
    ]
  )
})

test('buildGraphNodes creates screen and run-target nodes with usage summaries', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        title: 'Home',
        type: 'card',
        actions: [{ id: 'save', slot: 'up', label: 'Save', run: { type: 'store', key: 'saved', value: 'yes' } }]
      },
      detail: {
        id: 'detail',
        title: 'Detail',
        type: 'scroll',
        actions: [{ id: 'confirm', label: 'Confirm', run: { type: 'navigate', screen: 'root' } }]
      }
    }
  }
  const callbacks = {
    onAddMenuItem: () => {},
    onAddDrawerItem: () => {}
  }

  const nodes = buildGraphNodes(
    graph,
    graph,
    { root: { x: 10, y: 20 } },
    '__run_target_store__',
    ['__run_target_store__'],
    {},
    callbacks
  )

  assert.equal(nodes.length, 3)
  assert.deepEqual(
    nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      tags: node.data.tags,
      className: node.className,
      width: node.style.width,
      usageCount: node.data.usageSummary?.count
    })),
    [
      {
        id: 'root',
        type: 'pebble',
        position: { x: 10, y: 20 },
        tags: ['entry', 'card'],
        className: 'graph-node-shell ',
        width: 298,
        usageCount: undefined
      },
      {
        id: 'detail',
        type: 'pebble',
        position: computeAutoPosition(1, 2),
        tags: ['scroll', 'drawer'],
        className: 'graph-node-shell ',
        width: 262,
        usageCount: undefined
      },
      {
        id: '__run_target_store__',
        type: 'runTarget',
        position: computeRunTargetPosition(0),
        tags: undefined,
        className: 'graph-node-shell node-selected',
        width: 220,
        usageCount: 1
      }
    ]
  )
  assert.equal(nodes[0].data.onAddMenuItem, callbacks.onAddMenuItem)
  assert.equal(nodes[1].data.onAddDrawerItem, callbacks.onAddDrawerItem)
  assert.deepEqual(nodes[2].data.usageSummary.lines, ['Home: Save → → store saved = yes'])
})
