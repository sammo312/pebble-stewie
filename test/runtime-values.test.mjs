import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const contract = require('../packages/sdui-contract/src')
const runtimeValues = contract.runtimeValues

test('evaluateCondition handles string and numeric comparisons', () => {
  assert.equal(runtimeValues.evaluateCondition({ var: 'count', op: 'eq', value: '2' }, { count: 2 }), true)
  assert.equal(runtimeValues.evaluateCondition({ var: 'count', op: 'gte', value: '2' }, { count: 3 }), true)
  assert.equal(runtimeValues.evaluateCondition({ var: 'count', op: 'lt', value: '2' }, { count: 3 }), false)
  assert.equal(runtimeValues.evaluateCondition({ var: 'ready', op: 'eq', value: 'true' }, { ready: true }), true)
})

test('applySetVar supports increment, toggle, literal, and numeric coercion', () => {
  const incremented = runtimeValues.applySetVar({ key: 'count', value: 'increment' }, { count: 1 })
  assert.deepEqual(incremented, { count: 2 })

  const toggled = runtimeValues.applySetVar({ key: 'enabled', value: 'toggle' }, { enabled: false })
  assert.deepEqual(toggled, { enabled: true })

  const literal = runtimeValues.applySetVar({ key: 'name', value: 'literal:Sam' }, {})
  assert.deepEqual(literal, { name: 'Sam' })

  const numeric = runtimeValues.applySetVar({ key: 'count', value: '42' }, {})
  assert.deepEqual(numeric, { count: 42 })
})

test('resolveTemplateValue builds binding, storage, timer, and var context', () => {
  const screen = {
    bindings: {
      best: { source: 'storage.high_score', live: false },
      time: { source: 'device.time', live: true }
    }
  }
  const now = new Date('2025-01-02T03:04:05.000Z')
  const value = runtimeValues.resolveTemplateValue(
    'count={{var.count}} best={{best}} timer={{timer.remaining}} iso={{time.iso}}',
    screen,
    {
      vars: { count: 7 },
      storage: { high_score: '99' },
      timer: { remaining: 5 },
      now
    }
  )

  assert.equal(value, 'count=7 best=99 timer=5 iso=2025-01-02T03:04:05.000Z')
})

test('applyStore resolves templates into the next storage map', () => {
  const screen = {
    bindings: {
      best: { source: 'storage.high_score', live: false }
    }
  }

  const nextStorage = runtimeValues.applyStore(
    { key: 'summary', value: '{{var.count}}/{{best}}' },
    screen,
    { count: 3 },
    { high_score: '12' }
  )

  assert.deepEqual(nextStorage, {
    high_score: '12',
    summary: '3/12'
  })
})
