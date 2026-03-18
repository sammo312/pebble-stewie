import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const agentUx = require('../src/pkjs/agent-ux.js')

test('augmentAgentGraph strips voice-only input on no-dictation watches and injects more replies affordances', () => {
  const graph = {
    entryScreenId: 'menu',
    screens: {
      menu: {
        id: 'menu',
        type: 'menu',
        title: 'Menu',
        input: { mode: 'menu_or_voice' },
        items: [{ id: 'a', label: 'Alpha' }]
      },
      card: {
        id: 'card',
        type: 'card',
        title: 'Card',
        actions: [{ slot: 'select', id: 'ok', icon: 'check' }]
      },
      scroll: {
        id: 'scroll',
        type: 'scroll',
        title: 'Scroll',
        actions: [{ id: 'refresh', label: 'Refresh' }]
      }
    }
  }

  const augmented = agentUx.augmentAgentGraph(graph, {
    supportsDictation: false,
    preferSuggestedReplies: true
  })

  assert.equal(augmented.screens.menu.input.mode, 'menu')
  assert.deepEqual(augmented.screens.menu.items[1], {
    id: 'agent-more-replies',
    label: 'More Replies',
    run: { type: 'agent_command', command: 'more_replies' }
  })
  assert.deepEqual(augmented.screens.card.actions[1], {
    slot: 'down',
    id: 'agent-more',
    icon: 'plus',
    label: 'More',
    run: { type: 'agent_command', command: 'more_replies' }
  })
  assert.deepEqual(augmented.screens.scroll.actions[1], {
    id: 'agent-more-replies',
    label: 'More Replies',
    run: { type: 'agent_command', command: 'more_replies' }
  })
  assert.equal(graph.screens.menu.input.mode, 'menu_or_voice')
  assert.equal(graph.screens.menu.items.length, 1)
})

test('augmentAgentGraph does not duplicate more replies entries', () => {
  const graph = {
    entryScreenId: 'root',
    screens: {
      root: {
        id: 'root',
        type: 'menu',
        title: 'Root',
        items: [
          {
            id: 'agent-more-replies',
            label: 'More Replies',
            run: { type: 'agent_command', command: 'more_replies' }
          }
        ]
      }
    }
  }

  const augmented = agentUx.augmentAgentGraph(graph, {
    supportsDictation: false,
    preferSuggestedReplies: true
  })

  assert.equal(augmented.screens.root.items.length, 1)
})
