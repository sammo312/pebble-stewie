import * as sduiContractModule from '@pebble/sdui-contract'

/**
 * Pebble Protocol implementation for WASM QEMU serial injection.
 *
 * Implements the three protocol layers needed to send AppMessage data
 * to a Pebble watch running in the QEMU WASM emulator:
 *
 *   1. FEED/BEEF framing (QemuCommChannel)
 *   2. Pebble Protocol (length + endpoint)
 *   3. AppMessage PUSH (command + txn + UUID + dictionary tuples)
 *
 * The dictionary tuples match stewie's MESSAGE_KEY_* integers
 * (auto-generated from package.json messageKeys starting at 10000).
 */

const contract = sduiContractModule.default || sduiContractModule
const { drawCodec } = contract
const { encodeDrawingPayload } = drawCodec

// Stewie app UUID: 534cc93b-62cb-4cdf-b711-58fff6a0be41
const STEWIE_UUID = new Uint8Array([
  0x53, 0x4c, 0xc9, 0x3b, 0x62, 0xcb, 0x4c, 0xdf,
  0xb7, 0x11, 0x58, 0xff, 0xf6, 0xa0, 0xbe, 0x41
])

// Pebble Protocol endpoints
const ENDPOINT_APP_MESSAGE = 0x0030
const ENDPOINT_APP_RUN_STATE = 0x0034
const QEMU_PROTOCOL_SPP = 0x0001
const QEMU_HEADER_SIGNATURE = 0xfeed
const QEMU_FOOTER_SIGNATURE = 0xbeef

// AppMessage commands
const APP_MESSAGE_PUSH = 0x01

// AppMessage tuple types
const TUPLE_BYTE_ARRAY = 0
const TUPLE_CSTRING = 1
const TUPLE_UINT = 2
const TUPLE_INT = 3

// Stewie message key IDs (from build/include/message_keys.auto.c)
const MESSAGE_KEYS = {
  msgType: 10000,
  uiType: 10001,
  screenId: 10002,
  title: 10003,
  body: 10004,
  items: 10005,
  actions: 10006,
  actionType: 10007,
  actionScreenId: 10008,
  actionItemId: 10009,
  actionIndex: 10010,
  actionText: 10011,
  effectVibe: 10012,
  effectLight: 10013,
  drawing: 10014
}

// SDUI constants (must match src/pkjs/constants.js)
const MSG_TYPE_RENDER = 1
const MSG_TYPE_ACTION = 2
const UI_TYPE_MENU = 1
const UI_TYPE_CARD = 2
const UI_TYPE_SCROLL = 3
const UI_TYPE_DRAW = 4
const ACTION_TYPE_READY = 1
const ACTION_TYPE_SELECT = 2
const ACTION_TYPE_BACK = 3
const ACTION_TYPE_VOICE = 4
const MESSAGE_KEYS_BY_ID = Object.entries(MESSAGE_KEYS).reduce((acc, [name, key]) => {
  acc[key] = name
  return acc
}, {})

export const ACTION_TYPES = {
  READY: ACTION_TYPE_READY,
  SELECT: ACTION_TYPE_SELECT,
  BACK: ACTION_TYPE_BACK,
  VOICE: ACTION_TYPE_VOICE
}

export const VOICE_ITEM_IDS = {
  INPUT: '__voice__',
  NOT_SUPPORTED: '__voice_not_supported__',
  ERROR: '__voice_error__'
}

let txnId = 0

/**
 * Encode a string as a null-terminated UTF-8 byte array.
 */
function encodeString(str) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str || '')
  const result = new Uint8Array(bytes.length + 1)
  result.set(bytes)
  result[bytes.length] = 0 // null terminator
  return result
}

/**
 * Write a uint16 big-endian into a buffer at offset.
 */
function writeU16BE(buf, offset, value) {
  buf[offset] = (value >> 8) & 0xff
  buf[offset + 1] = value & 0xff
}

function readU16BE(buf, offset) {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0
}

/**
 * Write a uint16 little-endian into a buffer at offset.
 */
function writeU16LE(buf, offset, value) {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >> 8) & 0xff
}

function readU16LE(buf, offset) {
  return (buf[offset] | (buf[offset + 1] << 8)) >>> 0
}

/**
 * Write a uint32 little-endian into a buffer at offset.
 */
function writeU32LE(buf, offset, value) {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >> 8) & 0xff
  buf[offset + 2] = (value >> 16) & 0xff
  buf[offset + 3] = (value >> 24) & 0xff
}

function readU32LE(buf, offset) {
  return (
    buf[offset] |
    (buf[offset + 1] << 8) |
    (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)
  ) >>> 0
}

function decodeCString(bytes) {
  if (!bytes || bytes.length === 0) {
    return ''
  }

  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1
  }
  return new TextDecoder().decode(bytes.slice(0, end))
}

function decodeUnsignedInt(bytes) {
  let value = 0
  for (let i = 0; i < bytes.length; i += 1) {
    value |= bytes[i] << (i * 8)
  }
  return value >>> 0
}

function decodeSignedInt(bytes) {
  const unsigned = decodeUnsignedInt(bytes)
  const width = Math.min(bytes.length * 8, 32)
  if (!width) {
    return 0
  }
  const signBit = 1 << (width - 1)
  if ((unsigned & signBit) === 0) {
    return unsigned
  }
  return unsigned - 2 ** width
}

function concatBytes(left, right) {
  const a = left instanceof Uint8Array ? left : new Uint8Array(left || [])
  const b = right instanceof Uint8Array ? right : new Uint8Array(right || [])
  if (a.length === 0) return b
  if (b.length === 0) return a

  const merged = new Uint8Array(a.length + b.length)
  merged.set(a, 0)
  merged.set(b, a.length)
  return merged
}

function parseTupleValue(type, raw) {
  switch (type) {
    case TUPLE_CSTRING:
      return decodeCString(raw)
    case TUPLE_UINT:
      return decodeUnsignedInt(raw)
    case TUPLE_INT:
      return decodeSignedInt(raw)
    case TUPLE_BYTE_ARRAY:
    default:
      return raw
  }
}

function parseAppMessagePayload(payload) {
  if (!payload || payload.length < 19) {
    return null
  }

  const command = payload[0]
  if (command !== APP_MESSAGE_PUSH) {
    return null
  }

  const tupleCount = payload[18]
  const dict = {}
  let offset = 19

  for (let i = 0; i < tupleCount; i += 1) {
    if (offset + 7 > payload.length) {
      return null
    }

    const key = readU32LE(payload, offset)
    const type = payload[offset + 4]
    const size = readU16LE(payload, offset + 5)
    const dataStart = offset + 7
    const dataEnd = dataStart + size

    if (dataEnd > payload.length) {
      return null
    }

    const rawValue = payload.slice(dataStart, dataEnd)
    const name = MESSAGE_KEYS_BY_ID[key] || String(key)
    dict[name] = parseTupleValue(type, rawValue)
    offset = dataEnd
  }

  return {
    command,
    txnId: payload[1],
    uuid: Array.from(payload.slice(2, 18))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join(''),
    payload: dict
  }
}

function parsePebbleProtocolFrame(frame) {
  if (!frame || frame.length < 4) {
    return null
  }

  const length = readU16BE(frame, 0)
  const endpoint = readU16BE(frame, 2)
  if (frame.length < 4 + length) {
    return null
  }

  return {
    endpoint,
    payload: frame.slice(4, 4 + length)
  }
}

function parseFeedBeefFrames(chunk, remainder = new Uint8Array(0)) {
  const bytes = concatBytes(remainder, chunk)
  const frames = []
  let offset = 0

  while (offset + 8 <= bytes.length) {
    if (readU16BE(bytes, offset) !== QEMU_HEADER_SIGNATURE) {
      offset += 1
      continue
    }

    const protocol = readU16BE(bytes, offset + 2)
    const length = readU16BE(bytes, offset + 4)
    const frameLength = 6 + length + 2

    if (offset + frameLength > bytes.length) {
      break
    }

    const footer = readU16BE(bytes, offset + 6 + length)
    if (footer !== QEMU_FOOTER_SIGNATURE) {
      offset += 2
      continue
    }

    frames.push({
      protocol,
      payload: bytes.slice(offset + 6, offset + 6 + length)
    })
    offset += frameLength
  }

  return {
    frames,
    remainder: bytes.slice(offset)
  }
}

function toStewieActionMessage(appMessage) {
  if (!appMessage || !appMessage.payload) {
    return null
  }

  const payload = appMessage.payload
  if (Number(payload.msgType || 0) !== MSG_TYPE_ACTION) {
    return null
  }

  return {
    txnId: appMessage.txnId,
    type: Number(payload.actionType || 0),
    screenId: payload.actionScreenId ? String(payload.actionScreenId) : '',
    itemId: payload.actionItemId ? String(payload.actionItemId) : '',
    index: Number.isFinite(payload.actionIndex) ? Number(payload.actionIndex) : -1,
    text: payload.actionText ? String(payload.actionText) : '',
    payload
  }
}

/**
 * Build a single AppMessage tuple.
 * Returns Uint8Array: [key:4LE][type:1][len:2LE][data:var]
 */
function buildTuple(key, type, data) {
  const tuple = new Uint8Array(4 + 1 + 2 + data.length)
  writeU32LE(tuple, 0, key)
  tuple[4] = type
  writeU16LE(tuple, 5, data.length)
  tuple.set(data, 7)
  return tuple
}

/**
 * Build a uint tuple (uint8/16/32 depending on value).
 */
function buildUintTuple(key, value) {
  const data = new Uint8Array(4)
  writeU32LE(data, 0, value)
  return buildTuple(key, TUPLE_UINT, data)
}

/**
 * Build a string tuple (CString, null-terminated).
 */
function buildStringTuple(key, str) {
  return buildTuple(key, TUPLE_CSTRING, encodeString(str))
}

/**
 * Build an AppMessage PUSH payload.
 * @param {Object} dict - key-value pairs where keys are MESSAGE_KEYS names
 * @returns {Uint8Array} - the raw AppMessage bytes
 */
function buildAppMessage(dict) {
  const tuples = []
  const entries = Object.entries(dict)

  for (const [name, value] of entries) {
    const key = MESSAGE_KEYS[name]
    if (key === undefined) continue

    if (typeof value === 'number') {
      tuples.push(buildUintTuple(key, value))
    } else if (typeof value === 'string') {
      tuples.push(buildStringTuple(key, value))
    }
  }

  // Calculate total size
  let tupleBytes = 0
  for (const t of tuples) tupleBytes += t.length

  // AppMessage: cmd(1) + txn(1) + uuid(16) + count(1) + tuples
  const msg = new Uint8Array(1 + 1 + 16 + 1 + tupleBytes)
  msg[0] = APP_MESSAGE_PUSH
  msg[1] = (txnId++) & 0xff
  msg.set(STEWIE_UUID, 2)
  msg[18] = tuples.length

  let offset = 19
  for (const t of tuples) {
    msg.set(t, offset)
    offset += t.length
  }

  return msg
}

/**
 * Wrap an AppMessage in a Pebble Protocol frame.
 * @param {Uint8Array} appMsg - raw AppMessage bytes
 * @returns {Uint8Array} - Pebble Protocol frame: [len:2BE][endpoint:2BE][data]
 */
function buildPebbleProtocolFrame(appMsg) {
  const frame = new Uint8Array(4 + appMsg.length)
  writeU16BE(frame, 0, appMsg.length)
  writeU16BE(frame, 2, ENDPOINT_APP_MESSAGE)
  frame.set(appMsg, 4)
  return frame
}

/**
 * Wrap a Pebble Protocol frame in FEED/BEEF framing for QEMU.
 * Protocol=1 (SPP) means the payload is raw Pebble Protocol passed to the UART.
 * @param {Uint8Array} pebbleFrame - Pebble Protocol frame
 * @returns {Uint8Array} - FEED/BEEF framed packet
 */
function buildFeedBeefFrame(pebbleFrame) {
  // Header: signature(2) + protocol(2) + len(2) = 6 bytes
  // Footer: signature(2) = 2 bytes
  const frame = new Uint8Array(6 + pebbleFrame.length + 2)
  writeU16BE(frame, 0, 0xfeed)
  writeU16BE(frame, 2, 1) // QemuProtocol_SPP
  writeU16BE(frame, 4, pebbleFrame.length)
  frame.set(pebbleFrame, 6)
  writeU16BE(frame, 6 + pebbleFrame.length, 0xbeef)
  return frame
}

/**
 * Encode menu items as pipe-delimited string (matches encodeItems in screen-actions.js).
 * Format: "id|label\nid|label\n..."
 */
function encodeItems(items) {
  if (!items || items.length === 0) return ''
  return items
    .map((item, i) => {
      const id = (item.id || `item-${i}`).replace(/[^a-z0-9_-]/gi, '_')
      const label = item.label || item.title || `Item ${i + 1}`
      return `${id}|${label}`
    })
    .join('\n')
}

/**
 * Encode scroll drawer actions as pipe-delimited string.
 * Format: "id|label\nid|label\n..."
 */
function encodeMenuActions(actions) {
  if (!actions || actions.length === 0) return ''
  return actions
    .map((action, i) => {
      const id = (action.id || `menu-action-${i}`).replace(/[^a-z0-9_-]/gi, '_')
      const label = action.label || action.title || `Action ${i + 1}`
      return `${id}|${label}`
    })
    .join('\n')
}

/**
 * Encode card actions as pipe-delimited string (matches encodeActions).
 * Format: "slot|id|icon\nslot|id|icon\n..."
 */
function encodeActions(actions) {
  if (!actions || actions.length === 0) return ''
  return actions
    .map((action) => {
      const slot = action.slot || 'select'
      const id = (action.id || 'action').replace(/[^a-z0-9_-]/gi, '_')
      const icon = action.icon || 'check'
      return `${slot}|${id}|${icon}`
    })
    .join('\n')
}

/**
 * Build the complete FEED/BEEF framed packet for rendering a screen on the watch.
 * This is the main entry point — takes a screen definition from the graph
 * and returns bytes ready to inject into the QEMU serial port.
 *
 * @param {Object} screen - screen object from the graph (id, type, title, body, items, actions)
 * @returns {Uint8Array} - complete FEED/BEEF framed packet
 */
export function buildScreenRenderPacket(screen) {
  if (!screen) return null

  const isMenu = screen.type === 'menu'
  const isScroll = screen.type === 'scroll'
  const isDraw = screen.type === 'draw'
  const uiType = isMenu ? UI_TYPE_MENU : isScroll ? UI_TYPE_SCROLL : isDraw ? UI_TYPE_DRAW : UI_TYPE_CARD

  const dict = {
    msgType: MSG_TYPE_RENDER,
    uiType: uiType,
    screenId: screen.id || 'unknown',
    title: (screen.title || 'Screen').slice(0, 30)
  }

  if (isMenu) {
    dict.items = encodeItems(screen.items)
    dict.actions = ''
    dict.body = screen.body ? String(screen.body) : ''
  } else if (isDraw) {
    dict.body = screen.body ? String(screen.body).slice(0, 180) : ''
    dict.actions = ''
    dict.drawing = encodeDrawingPayload(screen.drawing)
  } else {
    dict.body = screen.body ? String(screen.body).slice(0, isScroll ? 1024 : 180) : ''
    dict.actions = isScroll ? encodeMenuActions(screen.actions) : encodeActions(screen.actions)
  }

  const appMsg = buildAppMessage(dict)
  const pebbleFrame = buildPebbleProtocolFrame(appMsg)
  return buildFeedBeefFrame(pebbleFrame)
}

/**
 * Build a FEED/BEEF framed AppRunState(start) packet to launch stewie.
 * This must be sent after PebbleOS boots and before sending screen data.
 * @returns {Uint8Array} - complete FEED/BEEF framed packet
 */
export function buildLaunchStewiePacket() {
  // AppRunState: command(1) + uuid(16)
  // command 1 = start
  const data = new Uint8Array(1 + 16)
  data[0] = 0x01 // start
  data.set(STEWIE_UUID, 1)

  const pebbleFrame = new Uint8Array(4 + data.length)
  writeU16BE(pebbleFrame, 0, data.length)
  writeU16BE(pebbleFrame, 2, ENDPOINT_APP_RUN_STATE)
  pebbleFrame.set(data, 4)

  return buildFeedBeefFrame(pebbleFrame)
}
export function decodeStewieActionMessagesFromChunk(chunk, remainder = new Uint8Array(0)) {
  const { frames, remainder: nextRemainder } = parseFeedBeefFrames(chunk, remainder)
  const actions = []

  for (const frame of frames) {
    if (frame.protocol !== QEMU_PROTOCOL_SPP) {
      continue
    }

    const pebbleFrame = parsePebbleProtocolFrame(frame.payload)
    if (!pebbleFrame || pebbleFrame.endpoint !== ENDPOINT_APP_MESSAGE) {
      continue
    }

    const appMessage = parseAppMessagePayload(pebbleFrame.payload)
    const action = toStewieActionMessage(appMessage)
    if (action) {
      actions.push(action)
    }
  }

  return {
    actions,
    remainder: nextRemainder
  }
}
