'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useGraphEditor from './hooks/use-graph-editor'
import Toolbar from './components/toolbar'
import CanvasPanel from './components/canvas-panel'
import PreviewPanel from './components/preview-panel'
import InspectorPanel from './components/inspector/inspector-panel'
import ImportExportDialog from './components/dialogs/import-export-dialog'
import CommandPalette from './components/command-palette'
import { Toaster, toast } from './components/ui/sonner'

export default function Page() {
  const editor = useGraphEditor()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 })
  const [isPreviewDragging, setIsPreviewDragging] = useState(false)
  const [isPreviewNearDock, setIsPreviewNearDock] = useState(false)
  const previewOffsetRef = useRef(previewOffset)
  const dragStateRef = useRef(null)
  const lastToastKeyRef = useRef(`${editor.notice.type}:${editor.notice.text}`)
  const isPreviewDocked = previewOffset.x === 0 && previewOffset.y === 0
  const isWithinDockZone = useCallback((clientX, clientY) => {
    if (typeof window === 'undefined') return false
    return clientX >= window.innerWidth - 460 && clientY <= 300
  }, [])

  useEffect(() => {
    previewOffsetRef.current = previewOffset
  }, [previewOffset])

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragStateRef.current) return
      const drag = dragStateRef.current
      const nextOffset = {
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY)
      }
      setPreviewOffset(nextOffset)
      setIsPreviewNearDock(
        (Math.abs(nextOffset.x) <= 72 && Math.abs(nextOffset.y) <= 72) ||
        isWithinDockZone(event.clientX, event.clientY)
      )
    }

    function handlePointerEnd(event) {
      if (!dragStateRef.current) return
      const nextOffset = previewOffsetRef.current
      dragStateRef.current = null
      setIsPreviewDragging(false)
      const shouldDock =
        (Math.abs(nextOffset.x) <= 72 && Math.abs(nextOffset.y) <= 72) ||
        isWithinDockZone(event.clientX, event.clientY)
      setIsPreviewNearDock(false)
      if (shouldDock) {
        setPreviewOffset({ x: 0, y: 0 })
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [isWithinDockZone])

  const startPreviewDrag = useCallback((event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsPreviewDragging(true)
    setIsPreviewNearDock(false)
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: previewOffsetRef.current.x,
      originY: previewOffsetRef.current.y
    }
  }, [])

  const resetPreviewDock = useCallback(() => {
    dragStateRef.current = null
    setIsPreviewDragging(false)
    setIsPreviewNearDock(false)
    setPreviewOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const key = `${editor.notice.type}:${editor.notice.text}`
    if (lastToastKeyRef.current === key) {
      return
    }
    lastToastKeyRef.current = key
    if (!editor.notice.text || (editor.notice.type === 'idle' && editor.notice.text === 'Ready')) {
      return
    }
    if (editor.notice.type === 'error') {
      toast.error(editor.notice.text)
      return
    }
    if (editor.notice.type === 'success') {
      toast.success(editor.notice.text)
      return
    }
    toast(editor.notice.text)
  }, [editor.notice])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-bottom)]">
      <Toolbar
        graph={editor.graph}
        screenIds={editor.screenIds}
        edges={editor.edges}
        unmappedCount={editor.unmappedCount}
        canExport={editor.canExport}
        deleteSelectedScreen={editor.deleteSelectedScreen}
        resetLayout={editor.resetLayout}
        setEntryScreenId={editor.setEntryScreenId}
        setShowImportExport={editor.setShowImportExport}
        openCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <main className="relative flex flex-1 min-h-0 overflow-hidden">
        <CanvasPanel
          nodes={editor.nodes}
          edges={editor.edges}
          handleNodesChange={editor.handleNodesChange}
          handleConnect={editor.handleConnect}
          handleEdgesDelete={editor.handleEdgesDelete}
          clearLinkByHandle={editor.clearLinkByHandle}
          setFlowInstance={editor.setFlowInstance}
          setSelectedNodeId={editor.setSelectedNodeId}
          setSelectedScreenId={editor.setSelectedScreenId}
          jumpPreviewTo={editor.jumpPreviewTo}
          addScreen={editor.addScreen}
          addRunTargetNode={editor.addRunTargetNode}
          openCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <div className="pointer-events-none absolute right-4 top-4 bottom-4 z-20 w-[22rem]">
          <div
            className={`pointer-events-auto absolute right-0 top-0 z-30 ${isPreviewDragging ? '' : 'transition-[transform,width] duration-150 ease-out'} ${isPreviewDocked ? 'w-[22rem]' : 'w-[26rem]'} ${isPreviewNearDock ? 'ring-1 ring-ring/60' : ''}`}
            style={{ transform: `translate(${previewOffset.x}px, ${previewOffset.y}px)` }}
          >
            <PreviewPanel
              previewRenderedScreen={editor.previewRenderedScreen}
              previewScreen={editor.previewScreen}
              previewScreenId={editor.previewScreenId}
              previewRevision={editor.previewRevision}
              handlePreviewActionMessage={editor.handlePreviewActionMessage}
              setNotice={editor.setNotice}
              onHandlePointerDown={startPreviewDrag}
              onHandleDoubleClick={resetPreviewDock}
            />
          </div>

          {editor.selectedNodeId && (
            <div className={`pointer-events-auto absolute inset-x-0 bottom-0 overflow-hidden ${isPreviewDocked ? 'top-[24rem]' : 'top-0'}`}>
              <InspectorPanel
                selectedNodeId={editor.selectedNodeId}
                selectedScreen={editor.selectedScreen}
                selectedRunTarget={editor.selectedRunTarget}
                selectedNodeUsages={editor.selectedNodeUsages}
                screenIds={editor.screenIds}
                screenBuilderSpec={editor.screenBuilderSpec}
                graphBuilderSpec={editor.graphBuilderSpec}
                updateScreenField={editor.updateScreenField}
                addMenuItem={editor.addMenuItem}
                removeMenuItem={editor.removeMenuItem}
                updateMenuItem={editor.updateMenuItem}
                addScreenAction={editor.addScreenAction}
                removeScreenAction={editor.removeScreenAction}
                updateScreenAction={editor.updateScreenAction}
                getBindingsDraft={editor.getBindingsDraft}
                updateBindingsDraft={editor.updateBindingsDraft}
                commitBindingsDraft={editor.commitBindingsDraft}
                applyBindingsPreset={editor.applyBindingsPreset}
              />
            </div>
          )}
        </div>
      </main>

      <div className="status-bar">
        scr:{String(editor.screenIds.length).padStart(2, '0')} | lnk:{String(editor.edges.length).padStart(2, '0')} | schema:{editor.graph.schemaVersion}
        {editor.unmappedCount > 0 && <span className="ml-2 text-danger">| unmapped:{String(editor.unmappedCount).padStart(2, '0')}</span>}
      </div>

      <ImportExportDialog
        open={editor.showImportExport}
        onOpenChange={editor.setShowImportExport}
        importText={editor.importText}
        setImportText={editor.setImportText}
        normalizedExportText={editor.normalizedExportText}
        canExport={editor.canExport}
        handleImport={editor.handleImport}
        handleCopyExport={editor.handleCopyExport}
        handleDownloadExport={editor.handleDownloadExport}
        loadCurrentIntoImportBox={editor.loadCurrentIntoImportBox}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        screenIds={editor.screenIds}
        selectedNodeId={editor.selectedNodeId}
        addScreen={editor.addScreen}
        addRunTargetNode={editor.addRunTargetNode}
        focusNode={editor.focusNode}
        resetLayout={editor.resetLayout}
      />

      <Toaster />
    </div>
  )
}
