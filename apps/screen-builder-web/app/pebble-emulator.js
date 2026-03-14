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
  const [state, setState] = useState(EMULATOR_STATES.IDLE)
  const [status, setStatus] = useState(autoboot ? 'Starting...' : 'Click Boot to start')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const screenRef = useRef(screen)
  const bootedRef = useRef(false)
  const sendTimerRef = useRef(null)
  const bootSettleTimerRef = useRef(null)
  const readyFallbackTimerRef = useRef(null)
  const controlRemainderRef = useRef(new Uint8Array(0))
  const onLogRef = useRef(onLog)
  const onButtonClickRef = useRef(onButtonClick)
  const onActionMessageRef = useRef(onActionMessage)
  const autobootedRef = useRef(false)

  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { onLogRef.current = onLog }, [onLog])
  useEffect(() => { onButtonClickRef.current = onButtonClick }, [onButtonClick])
  useEffect(() => { onActionMessageRef.current = onActionMessage }, [onActionMessage])

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
      { type: 'inject', data: Array.from(packet) }, '*'
    )
    return true
  }, [])

  const sendScreenPacket = useCallback((nextScreen, logLine) => {
    if (!nextScreen) return false
    const packet = buildScreenRenderPacket(nextScreen)
    if (!packet) return false
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
    console.log(`[emulator] Stewie ready (${reason})`)
  }, [clearReadyFallback, sendScreenPacket])

  // When screen changes and emulator is ready, send it (debounced)
  useEffect(() => {
    if (state !== EMULATOR_STATES.READY || !bootedRef.current || !screen) return
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current)
    sendTimerRef.current = setTimeout(() => {
      sendScreenPacket(screen, `Sent screen "${screen.id}" to emulator`)
    }, 300)
    return () => { if (sendTimerRef.current) clearTimeout(sendTimerRef.current) }
  }, [screen, state, sendScreenPacket])

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current)
      clearBootTimers()
    }
  }, [clearBootTimers])

  const boot = useCallback(() => {
    if (state !== EMULATOR_STATES.IDLE && state !== EMULATOR_STATES.ERROR) return
    resetBootState()
    setState(EMULATOR_STATES.LOADING)
    setStatus('Loading emulator...')
    if (iframeRef.current) {
      iframeRef.current.contentWindow.postMessage({ type: 'boot' }, '*')
    }
  }, [resetBootState, state])

  const postButton = useCallback((button, action = 'click') => {
    if (!button) return
    iframeRef.current?.contentWindow?.postMessage({ type: 'button', button, action }, '*')
  }, [])

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
          setState(EMULATOR_STATES.BOOTING)
          setStatus('Booting PebbleOS (~25s)...')
          console.log('[emulator] Display active, waiting for PebbleOS to boot...')
          bootSettleTimerRef.current = setTimeout(() => {
            if (iframeRef.current?.contentWindow) {
              const launchPacket = buildLaunchStewiePacket()
              console.log('[emulator] Launching stewie...')
              iframeRef.current.contentWindow.postMessage(
                { type: 'inject', data: Array.from(launchPacket) }, '*'
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
          setState(EMULATOR_STATES.ERROR)
          setStatus(`Error: ${data.text}`)
          break
        case 'emulator-booting':
          setState(EMULATOR_STATES.BOOTING)
          setStatus('Booting PebbleOS...')
          break
        case 'emulator-control-bytes': {
          const bytes = new Uint8Array(Array.isArray(data.data) ? data.data : [])
          const decoded = decodeStewieActionMessagesFromChunk(bytes, controlRemainderRef.current)
          controlRemainderRef.current = decoded.remainder
          decoded.actions.forEach((actionMessage) => {
            if (actionMessage.type === ACTION_TYPES.READY) {
              markStewieReady('native')
            }
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
  }, [clearBootTimers, clearReadyFallback, markStewieReady, resetBootState])

  const sendCurrentScreen = useCallback(() => {
    if (!screenRef.current) return
    if (!bootedRef.current) {
      console.log('[emulator] Force-launching stewie before sending screen')
      injectToEmulator(buildLaunchStewiePacket())
      clearReadyFallback()
      readyFallbackTimerRef.current = setTimeout(() => {
        markStewieReady('manual')
      }, APP_READY_FALLBACK_MS)
      return
    }
    sendScreenPacket(screenRef.current, `Sent screen "${screenRef.current.id}" to emulator`)
  }, [clearReadyFallback, injectToEmulator, markStewieReady, sendScreenPacket])

  const showsHoldSelectDrawer =
    !!screen &&
    screen.type === 'scroll' &&
    Array.isArray(screen.actions) &&
    screen.actions.length > 0

  return (
    <div className="emulator-container">
      <div className="emulator-header">
        <div>
          <div className="emulator-status">
            <span className={`emulator-dot ${state}`} />
            <span className="emulator-status-text">{status}</span>
          </div>
          <div className="emulator-meta">
            {activeScreenId || 'no-screen'} {revisionLabel ? `· rev ${revisionLabel}` : ''}
          </div>
          {showsHoldSelectDrawer && (
            <div className="emulator-meta">
              select action menu: `Enter` or middle button
            </div>
          )}
        </div>
        <div className="button-row">
          {(state === EMULATOR_STATES.IDLE || state === EMULATOR_STATES.ERROR) && (
            <button type="button" onClick={boot}>Boot</button>
          )}
          {state === EMULATOR_STATES.READY && (
            <button type="button" onClick={sendCurrentScreen}>Send Screen</button>
          )}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="emulator-watch"
        tabIndex={0}
        onKeyDown={(e) => {
          let btn = null
          if (e.key === 'ArrowLeft' || e.key === 'Escape') btn = 'back'
          else if (e.key === 'ArrowUp') btn = 'up'
          else if (e.key === 'ArrowRight' || e.key === 'Enter') btn = 'select'
          else if (e.key === 'ArrowDown') btn = 'down'
          if (btn) {
            e.preventDefault()
            postButton(btn)
          }
        }}
      >
        <div className="emu-btn-col emu-btn-left">
          <button type="button" className="emu-btn" title="Back (Left / Esc)"
            onClick={() => postButton('back')}>
            &larr;
          </button>
        </div>

        <div className="emulator-display">
          <iframe
            ref={iframeRef}
            src="/emulator/embed.html"
            className="emulator-iframe"
            allow="cross-origin-isolated"
            title="Pebble Emulator"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

        <div className="emu-btn-col emu-btn-right">
          <button type="button" className="emu-btn" title="Up (Arrow Up)"
            onClick={() => postButton('up')}>
            &uarr;
          </button>
          <button
            type="button"
            className="emu-btn"
            title="Select (Right / Enter)"
            onClick={() => postButton('select')}
          >
            &bull;
          </button>
          <button type="button" className="emu-btn" title="Down (Arrow Down)"
            onClick={() => postButton('down')}>
            &darr;
          </button>
        </div>
      </div>
    </div>
  )
}
