import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const contract = require('../packages/sdui-contract/src')

const latestVersion = contract.constants.LATEST_SDUI_SCHEMA_VERSION
const v1Version = contract.constants.SDUI_SCHEMA_VERSION
const v110Version = contract.constants.SDUI_SCHEMA_VERSION_V1_1_0

test('latest graphs normalize to the latest canonical schema', () => {
  const graph = {
    schemaVersion: latestVersion,
    storageNamespace: 'check_contract_demo',
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        title: 'Main Menu',
        onEnter: [{ type: 'set_var', key: 'entered_root', value: 'true' }],
        timer: {
          durationMs: 3000,
          run: { type: 'effect', vibe: 'short' }
        },
        items: [
          { id: 'opt_yes', label: 'Yes', value: 'yes', run: { type: 'set_var', key: 'count', value: 'increment' } }
        ]
      }
    }
  }

  const normalized = contract.graphSchema.normalizeCanonicalGraph(graph)
  assert.ok(normalized)
  assert.equal(normalized.schemaVersion, latestVersion)
  assert.equal(normalized.storageNamespace, 'check_contract_demo')
  assert.equal(normalized.screens.root.timer.durationMs, 3000)
})

test('v1 imports normalize forward to the latest canonical schema', () => {
  const graph = {
    schemaVersion: v1Version,
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        title: 'Main Menu',
        items: [
          {
            id: 'go',
            label: 'Go',
            value: 'go',
            run: { type: 'navigate', screen: 'done' }
          }
        ]
      },
      done: {
        id: 'done',
        type: 'card',
        title: 'Done',
        body: 'Legacy contract'
      }
    }
  }

  const normalized = contract.graphSchema.normalizeCanonicalGraph(graph)
  assert.ok(normalized)
  assert.equal(normalized.schemaVersion, latestVersion)
  assert.equal(normalized.entryScreenId, 'root')
  assert.deepEqual(normalized.screens.root.items[0].run, { type: 'navigate', screen: 'done' })
  assert.deepEqual(normalized.screens.done.actions, [])
})

test('v1.1.0 imports retain supported draw and timer behavior while normalizing forward', () => {
  const graph = {
    schemaVersion: v110Version,
    storageNamespace: 'demo_store',
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'draw',
        title: 'Draw Demo',
        body: 'Animated shapes',
        onEnter: [{ type: 'set_var', key: 'count', value: 'increment' }],
        timer: {
          durationMs: 1200,
          run: { type: 'effect', vibe: 'short' }
        },
        drawing: {
          playMode: 'loop',
          background: 'grid',
          timelineMs: 900,
          steps: [
            {
              id: 'step_1',
              kind: 'circle',
              label: 'Pulse',
              x: 18,
              y: 28,
              toX: 60,
              toY: 52,
              width: 24,
              height: 24,
              delayMs: 0,
              durationMs: 720,
              fromScale: 0.75,
              toScale: 1,
              fromOpacity: 0.2,
              toOpacity: 1,
              fill: false,
              color: 'accent'
            }
          ]
        }
      }
    }
  }

  const normalized = contract.graphSchema.normalizeCanonicalGraph(graph)
  assert.ok(normalized)
  assert.equal(normalized.schemaVersion, latestVersion)
  assert.equal(normalized.storageNamespace, 'demo_store')
  assert.equal(normalized.screens.root.type, 'draw')
  assert.equal(normalized.screens.root.timer.durationMs, 1200)
  assert.equal(normalized.screens.root.onEnter[0].type, 'set_var')
})
