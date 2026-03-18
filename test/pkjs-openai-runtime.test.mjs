import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const openaiRuntime = require('../src/pkjs/openai-runtime.js')

test('buildSystemPrompt bakes the latest schema version into instructions', () => {
  const prompt = openaiRuntime.buildSystemPrompt('v9.9.9')

  assert.match(prompt, /schemaVersion/)
  assert.match(prompt, /v9\.9\.9/)
  assert.match(prompt, /return valid JSON only/i)
})

test('buildOpenAIContext sanitizes user input and preserves runtime context', () => {
  const now = new Date('2025-01-02T03:04:05.000Z')
  const context = openaiRuntime.buildOpenAIContext({
    schemaVersion: 'v1.2.3',
    conversationId: 'abc123',
    reason: 'voice\nprompt',
    userText: 'hello | world\nagain',
    vars: { count: 2 },
    storage: { mode: 'ready' },
    watch: { platform: 'basalt' },
    now
  })

  assert.deepEqual(context, {
    schemaVersion: 'v1.2.3',
    conversationId: 'abc123',
    reason: 'voice prompt',
    input: 'hello / world again',
    tzOffset: -now.getTimezoneOffset(),
    vars: { count: 2 },
    storage: { mode: 'ready' },
    watch: { platform: 'basalt' }
  })
})

test('buildOpenAIRequestBody includes prompt context and previous response id', () => {
  const body = openaiRuntime.buildOpenAIRequestBody({
    model: 'gpt-test',
    instructions: 'Use JSON',
    context: { input: 'hello' },
    previousResponseId: 'resp_123'
  })

  assert.equal(body.model, 'gpt-test')
  assert.equal(body.instructions, 'Use JSON')
  assert.equal(body.previous_response_id, 'resp_123')
  assert.match(body.input, /Runtime context:/)
  assert.match(body.input, /"input":"hello"/)
})

test('extractFirstJsonObject handles nested braces inside strings', () => {
  const extracted = openaiRuntime.extractFirstJsonObject(
    'before {"message":"brace } stays","nested":{"ok":true}} after'
  )

  assert.equal(extracted, '{"message":"brace } stays","nested":{"ok":true}}')
})

test('extractOpenAIOutputText prefers output_text and falls back to chunked output', () => {
  assert.equal(
    openaiRuntime.extractOpenAIOutputText({
      output_text: 'direct'
    }),
    'direct'
  )

  assert.equal(
    openaiRuntime.extractOpenAIOutputText({
      output: [
        {
          content: [{ text: 'chunked' }]
        }
      ]
    }),
    'chunked'
  )

  assert.equal(
    openaiRuntime.extractOpenAIOutputText({
      message: 'fallback'
    }),
    'fallback'
  )
})

test('postJson sends JSON requests and parses JSON responses', () => {
  let xhr
  const requestBody = { hello: 'world' }
  const result = []

  const returned = openaiRuntime.postJson(
    () => {
      xhr = {
        headers: {},
        open(method, url, async) {
          this.method = method
          this.url = url
          this.async = async
        },
        setRequestHeader(key, value) {
          this.headers[key] = value
        },
        send(body) {
          this.sentBody = body
        }
      }
      return xhr
    },
    'https://example.test/v1/responses',
    'sk-test',
    requestBody,
    (error, value) => {
      result.push([error, value])
    }
  )

  assert.equal(returned, xhr)
  assert.equal(xhr.method, 'POST')
  assert.equal(xhr.url, 'https://example.test/v1/responses')
  assert.equal(xhr.headers['Content-Type'], 'application/json')
  assert.equal(xhr.headers.Authorization, 'Bearer sk-test')
  assert.equal(xhr.timeout, 25000)
  assert.equal(xhr.sentBody, JSON.stringify(requestBody))

  xhr.status = 200
  xhr.responseText = '{"ok":true}'
  xhr.onload()

  assert.deepEqual(result, [[null, { ok: true }]])
})

test('postJson falls back to sanitized text bodies and reports network failures', () => {
  let xhr
  const result = []

  openaiRuntime.postJson(
    () => {
      xhr = {
        headers: {},
        open() {},
        setRequestHeader() {},
        send() {}
      }
      return xhr
    },
    'https://example.test/v1/responses',
    '',
    { hello: 'world' },
    (error, value) => {
      result.push([error, value])
    }
  )

  xhr.status = 200
  xhr.responseText = ' plain text fallback '
  xhr.onload()
  xhr.onerror()

  assert.deepEqual(result, [[null, { message: 'plain text fallback' }]])

  const errorResults = []
  openaiRuntime.postJson(
    () => ({
      open() {},
      setRequestHeader() {},
      send() {},
      onerror: null,
      ontimeout: null
    }),
    'https://example.test/v1/responses',
    '',
    {},
    (error, value) => {
      errorResults.push([error, value])
    }
  ).onerror()

  assert.deepEqual(errorResults, [['Network request failed.', null]])
})
