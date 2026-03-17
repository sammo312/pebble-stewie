'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ACTION_TYPES,
  buildLaunchStewiePacket,
  buildScreenRenderPacket,
  decodeStewieActionMessagesFromChunk
} from './pebble-protocol'

const EMULATOR_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  BOOTING: 'booting',
  READY: 'ready',
  ERROR: 'error'
}

// PebbleOS needs ~25-30 seconds to fully boot after display becomes active.
const BOOT_SETTLE_MS = 25000
const APP_READY_FALLBACK_MS = 8000

function sanitizeText(value, fallback = '---') {
  if (!value) return fallback
  return String(value).replace(/\s+/g, ' ').trim().toUpperCase() || fallback
}

function buildMeter(progress, width = 18) {
  const clamped = Math.max(0, Math.min(1, progress))
  const filled = Math.round(clamped * width)
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}]`
}

function getStageInfo(state, status) {
  if (state === EMULATOR_STATES.ERROR) {
    return { label: 'FAIL', progress: 1 }
  }
  if (state === EMULATOR_STATES.READY) {
    return { label: 'READY', progress: 1 }
  }
  if (state === EMULATOR_STATES.LOADING) {
    return { label: 'LOAD', progress: 0.2 }
  }
  if (state === EMULATOR_STATES.BOOTING) {
    if (/launching/i.test(status)) {
      return { label: 'APP', progress: 0.88 }
    }
    if (/booting/i.test(status)) {
      return { label: 'OS', progress: 0.62 }
    }
    return { label: 'BOOT', progress: 0.72 }
  }
  return { label: 'IDLE', progress: 0 }
}

function describeActionType(type) {
  switch (type) {
    case ACTION_TYPES.READY:
      return 'READY'
    case ACTION_TYPES.SELECT:
      return 'SELECT'
    case ACTION_TYPES.BACK:
      return 'BACK'
    case ACTION_TYPES.VOICE:
      return 'VOICE'
    default:
      return `TYPE${type || 0}`
  }
}

function describeButton(button) {
  switch (button) {
    case 'up':
      return 'UP'
    case 'select':
      return 'OK'
    case 'down':
      return 'DN'
    case 'back':
      return 'BK'
    default:
      return sanitizeText(button)
  }
}

function hashPacket(packet) {
  if (!packet || packet.length === 0) return ''
  let hash = 2166136261
  for (let i = 0; i < packet.length; i += 1) {
    hash ^= packet[i]
    hash = Math.imul(hash, 16777619)
  }
  return `${packet.length}:${hash >>> 0}`
}

export default function PebbleEmulator({
  screen,
  autoboot,
  onLog,
  onButtonClick,
  onActionMessage,
  activeScreenId,
  revisionLabel
}) {
  const iframeRef = useRef(null)
  const pressedButtonsRef = useRef(new Set())
  const [state, setState] = useState(EMULATOR_STATES.IDLE)
  const [status, setStatus] = useState(autoboot ? 'Starting...' : 'Click Boot to start')
  const [latestConsoleEvent, setLatestConsoleEvent] = useState('---')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const screenRef = useRef(screen)
  const bootedRef = useRef(false)
  const sendTimerRef = useRef(null)
  const bootSettleTimerRef = useRef(null)
  const readyFallbackTimerRef = useRef(null)
  const controlRemainderRef = useRef(new Uint8Array(0))
  const lastSentPacketHashRef = useRef('')
  const onLogRef = useRef(onLog)
  const onButtonClickRef = useRef(onButtonClick)
  const onActionMessageRef = useRef(onActionMessage)
  const autobootedRef = useRef(false)

  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { onLogRef.current = onLog }, [onLog])
  useEffect(() => { onButtonClickRef.current = onButtonClick }, [onButtonClick])
  useEffect(() => { onActionMessageRef.current = onActionMessage }, [onActionMessage])

  const setConsoleEvent = useCallback((line) => {
    setLatestConsoleEvent(sanitizeText(line, '---'))
  }, [])

  const releaseAllButtons = useCallback(() => {
    if (!pressedButtonsRef.current.size) return
    pressedButtonsRef.current.forEach((button) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'button', button, action: 'up' }, '*')
    })
    pressedButtonsRef.current.clear()
  }, [])

  const clearBootTimers = useCallback(() => {
    if (bootSettleTimerRef.current) {
      clearTimeout(bootSettleTimerRef.current)
      bootSettleTimerRef.current = null
    }
    if (readyFallbackTimerRef.current) {
      clearTimeout(readyFallbackTimerRef.current)
      readyFallbackTimerRef.current = null
    }
  }, [])

  const resetBootState = useCallback(() => {
    clearBootTimers()
    bootedRef.current = false
    controlRemainderRef.current = new Uint8Array(0)
    lastSentPacketHashRef.current = ''
  }, [clearBootTimers])

  const clearReadyFallback = useCallback(() => {
    if (readyFallbackTimerRef.current) {
      clearTimeout(readyFallbackTimerRef.current)
      readyFallbackTimerRef.current = null
    }
  }, [])

  const injectToEmulator = useCallback((packet) => {
    if (!iframeRef.current?.contentWindow || !packet) return false
    iframeRef.current.contentWindow.postMessage(
      { type: 'inject', data: packet }, '*'
    )
    return true
  }, [])

  const sendScreenPacket = useCallback((nextScreen, logLine) => {
    if (!nextScreen) return false
    const packet = buildScreenRenderPacket(nextScreen)
    if (!packet) return false
    const packetHash = hashPacket(packet)
    if (packetHash && packetHash === lastSentPacketHashRef.current) {
      return false
    }
    lastSentPacketHashRef.current = packetHash
    injectToEmulator(packet)
    if (logLine) {
      onLogRef.current?.(logLine)
    }
    return true
  }, [injectToEmulator])

  const markStewieReady = useCallback((reason = 'native') => {
    const wasBooted = bootedRef.current
    clearReadyFallback()
    if (bootSettleTimerRef.current) {
      clearTimeout(bootSettleTimerRef.current)
      bootSettleTimerRef.current = null
    }
    if (wasBooted) {
      setState(EMULATOR_STATES.READY)
      setStatus('Ready')
      if (reason === 'native' && screenRef.current) {
        sendScreenPacket(screenRef.current, `Re-sent screen "${screenRef.current.id}" after native ready`)
      }
      return
    }

    bootedRef.current = true
    setState(EMULATOR_STATES.READY)
    setStatus('Ready')
  }, [clearReadyFallback, sendScreenPacket])

  // When screen changes and emulator is ready, send it (debounced)
  useEffect(() => {
    if (state !== EMULATOR_STATES.READY || !bootedRef.current || !screen) return
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current)
    sendTimerRef.current = setTimeout(() => {
      sendScreenPacket(screen, `Sent screen "${screen.id}" to emulator`)
    }, 32)
    return () => { if (sendTimerRef.current) clearTimeout(sendTimerRef.current) }
  }, [screen, state, sendScreenPacket])

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current)
      clearBootTimers()
      releaseAllButtons()
    }
  }, [clearBootTimers, releaseAllButtons])

  const boot = useCallback(() => {
    if (state !== EMULATOR_STATES.IDLE && state !== EMULATOR_STATES.ERROR) return
    resetBootState()
    setLatestConsoleEvent('BOOT REQUEST')
    setState(EMULATOR_STATES.LOADING)
    setStatus('Loading emulator...')
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage({ type: 'boot' }, '*')
    }
  }, [resetBootState, state])

  const postButton = useCallback((button, action = 'click') => {
    if (!button) return
    if (action === 'down' || action === 'click' || action === 'long') {
      setConsoleEvent(`BTN ${describeButton(button)}`)
    }
    if (action === 'down') {
      pressedButtonsRef.current.add(button)
    } else if (action === 'up') {
      pressedButtonsRef.current.delete(button)
    } else if (action === 'click' || action === 'long') {
      pressedButtonsRef.current.delete(button)
    }
    iframeRef.current?.contentWindow?.postMessage({ type: 'button', button, action }, '*')
  }, [setConsoleEvent])

  const buttonPressProps = useCallback((button) => ({
    onMouseDown: (event) => {
      event.preventDefault()
      postButton(button, 'down')
    },
    onMouseUp: () => postButton(button, 'up'),
    onMouseLeave: () => postButton(button, 'up'),
    onTouchStart: (event) => {
      event.preventDefault()
      postButton(button, 'down')
    },
    onTouchEnd: () => postButton(button, 'up'),
    onTouchCancel: () => postButton(button, 'up')
  }), [postButton])

  // Autoboot once the iframe is definitely loaded.
  useEffect(() => {
    if (!autoboot || autobootedRef.current || !iframeLoaded) return
    autobootedRef.current = true
    resetBootState()
    setState(EMULATOR_STATES.LOADING)
    setStatus('Loading emulator...')
    iframeRef.current?.contentWindow?.postMessage({ type: 'boot' }, '*')
  }, [autoboot, iframeLoaded, resetBootState])

  // Listen for messages from the emulator iframe
  useEffect(() => {
    function handleMessage(event) {
      const data = event.data
      if (!data || typeof data !== 'object') return

      switch (data.type) {
        case 'emulator-status':
          setStatus(data.text)
          break
        case 'emulator-ready':
          resetBootState()
          setConsoleEvent('DISPLAY READY')
          setState(EMULATOR_STATES.BOOTING)
          setStatus('Booting PebbleOS (~25s)...')
          bootSettleTimerRef.current = setTimeout(() => {
            if (iframeRef.current?.contentWindow) {
              const launchPacket = buildLaunchStewiePacket()
              iframeRef.current.contentWindow.postMessage(
                { type: 'inject', data: launchPacket }, '*'
              )
              setStatus('Launching stewie...')
              clearReadyFallback()
              readyFallbackTimerRef.current = setTimeout(() => {
                markStewieReady('fallback')
              }, APP_READY_FALLBACK_MS)
            }
          }, BOOT_SETTLE_MS)
          break
        case 'emulator-frame':
          break
        case 'emulator-error':
          clearBootTimers()
          setConsoleEvent(`ERROR ${data.text}`)
          setState(EMULATOR_STATES.ERROR)
          setStatus(`Error: ${data.text}`)
          break
        case 'emulator-booting':
          setState(EMULATOR_STATES.BOOTING)
          setStatus('Booting PebbleOS...')
          break
        case 'emulator-control-bytes': {
          const bytes =
            data.data instanceof Uint8Array
              ? data.data
              : new Uint8Array(Array.isArray(data.data) ? data.data : [])
          const decoded = decodeStewieActionMessagesFromChunk(bytes, controlRemainderRef.current)
          controlRemainderRef.current = decoded.remainder
          decoded.actions.forEach((actionMessage) => {
            if (actionMessage.type === ACTION_TYPES.READY) {
              markStewieReady('native')
            }
            setConsoleEvent(
              `ACT ${describeActionType(actionMessage.type)} ${actionMessage.itemId || actionMessage.screenId || actionMessage.text || ''}`.trim()
            )
            onActionMessageRef.current?.(actionMessage)
          })
          break
        }
        case 'emulator-button':
          onButtonClickRef.current?.(data.button, data.action)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [clearBootTimers, clearReadyFallback, markStewieReady, resetBootState, setConsoleEvent])

  const sendCurrentScreen = useCallback(() => {
    if (!screenRef.current) return
    if (!bootedRef.current) {
      console.log('[emulator] Force-launching stewie before sending screen')
      setConsoleEvent('SEND WAITING')
      injectToEmulator(buildLaunchStewiePacket())
      clearReadyFallback()
      readyFallbackTimerRef.current = setTimeout(() => {
        markStewieReady('manual')
      }, APP_READY_FALLBACK_MS)
      return
    }
    setConsoleEvent(`SEND ${screenRef.current.id}`)
    sendScreenPacket(screenRef.current, `Sent screen "${screenRef.current.id}" to emulator`)
  }, [clearReadyFallback, injectToEmulator, markStewieReady, sendScreenPacket, setConsoleEvent])

  const showsHoldSelectDrawer =
    !!screen &&
    screen.type === 'scroll' &&
    Array.isArray(screen.actions) &&
    screen.actions.length > 0

  const stage = getStageInfo(state, status)
  const readout = [
    `EMU   ${sanitizeText(state)}`,
    `TASK  ${buildMeter(stage.progress)} ${stage.label}`,
    `STAT  ${sanitizeText(status, 'WAITING')}`,
    `SCR   ${sanitizeText(activeScreenId || 'none')}`,
    `REV   ${sanitizeText(revisionLabel || 'none')}`,
    `EVT   ${latestConsoleEvent}`
  ]

  if (showsHoldSelectDrawer) {
    readout.push('MENU  SELECT OPENS ACTIONS')
  }

  return (
    <div className="emulator-container">
      <div className="emulator-header">
        <div className="emulator-console">
          <pre className="emulator-readout">{readout.join('\n')}</pre>
        </div>
        <div className="button-row">
          {(state === EMULATOR_STATES.IDLE || state === EMULATOR_STATES.ERROR) && (
            <button type="button" onClick={boot}>Boot</button>
          )}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="emulator-watch"
        tabIndex={0}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            releaseAllButtons()
          }
        }}
        onKeyDown={(e) => {
          let btn = null
          if (e.key === 'ArrowLeft' || e.key === 'Escape') btn = 'back'
          else if (e.key === 'ArrowUp') btn = 'up'
          else if (e.key === 'ArrowRight' || e.key === 'Enter') btn = 'select'
          else if (e.key === 'ArrowDown') btn = 'down'
          if (btn) {
            e.preventDefault()
            if (!e.repeat) {
              postButton(btn, 'down')
            }
          }
        }}
        onKeyUp={(e) => {
          let btn = null
          if (e.key === 'ArrowLeft' || e.key === 'Escape') btn = 'back'
          else if (e.key === 'ArrowUp') btn = 'up'
          else if (e.key === 'ArrowRight' || e.key === 'Enter') btn = 'select'
          else if (e.key === 'ArrowDown') btn = 'down'
          if (btn) {
            e.preventDefault()
            postButton(btn, 'up')
          }
        }}
      >
        <div className="emu-btn-col emu-btn-left">
          <button type="button" className="emu-btn" title="Back (Left / Esc)"
            {...buttonPressProps('back')}>
            BK
          </button>
        </div>

        <div className="emulator-display">
          <iframe
            ref={iframeRef}
            src="/emulator/embed.html?v=20260314e"
            className="emulator-iframe"
            allow="cross-origin-isolated"
            title="Pebble Emulator"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

        <div className="emu-btn-col emu-btn-right">
          <button type="button" className="emu-btn" title="Up (Arrow Up)"
            {...buttonPressProps('up')}>
            UP
          </button>
          <button
            type="button"
            className="emu-btn"
            title="Select (Right / Enter)"
            {...buttonPressProps('select')}
          >
            OK
          </button>
          <button type="button" className="emu-btn" title="Down (Arrow Down)"
            {...buttonPressProps('down')}>
            DN
          </button>
        </div>
      </div>
    </div>
  )
}
