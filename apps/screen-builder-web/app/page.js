'use client'

import useGraphEditor from './hooks/use-graph-editor'
import Toolbar from './components/toolbar'
import CanvasPanel from './components/canvas-panel'
import PreviewPanel from './components/preview-panel'
import InspectorPanel from './components/inspector/inspector-panel'
import ImportExportDialog from './components/dialogs/import-export-dialog'
import { CreateSlotLinkDialog, CreateMenuActionDialog } from './components/dialogs/create-action-dialog'

export default function Page() {
  const editor = useGraphEditor()

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-bottom)]">
      <Toolbar
        graph={editor.graph}
        screenIds={editor.screenIds}
        edges={editor.edges}
        unmappedCount={editor.unmappedCount}
        canExport={editor.canExport}
        hasBuilderOnlyDrawScreens={editor.hasBuilderOnlyDrawScreens}
        newNodeType={editor.newNodeType}
        setNewNodeType={editor.setNewNodeType}
        newRunTargetId={editor.newRunTargetId}
        setNewRunTargetId={editor.setNewRunTargetId}
        addScreen={editor.addScreen}
        addRunTargetNode={editor.addRunTargetNode}
        deleteSelectedScreen={editor.deleteSelectedScreen}
        resetLayout={editor.resetLayout}
        setEntryScreenId={editor.setEntryScreenId}
        setShowImportExport={editor.setShowImportExport}
      />

      {editor.notice.type !== 'idle' && (
        <div className={`notice ${editor.notice.type} mx-3 mt-1`}>
          {editor.notice.text}
        </div>
      )}

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
        />

        <div className="pointer-events-none absolute right-4 top-4 bottom-4 z-20 flex w-[22rem] flex-col gap-3">
          <div className="pointer-events-auto">
            <PreviewPanel
              previewRenderedScreen={editor.previewRenderedScreen}
              previewScreen={editor.previewScreen}
              previewScreenId={editor.previewScreenId}
              previewRevision={editor.previewRevision}
              handlePreviewActionMessage={editor.handlePreviewActionMessage}
              setNotice={editor.setNotice}
            />
          </div>

          {editor.selectedNodeId && (
            <div className="pointer-events-auto min-h-0 flex-1 overflow-hidden">
              <InspectorPanel
                selectedNodeId={editor.selectedNodeId}
                selectedScreen={editor.selectedScreen}
                selectedRunTarget={editor.selectedRunTarget}
                selectedNodeUsages={editor.selectedNodeUsages}
                screenBuilderSpec={editor.screenBuilderSpec}
                graphBuilderSpec={editor.graphBuilderSpec}
                updateScreenField={editor.updateScreenField}
                addMenuItem={editor.addMenuItem}
                removeMenuItem={editor.removeMenuItem}
                updateMenuItem={editor.updateMenuItem}
                addScreenAction={editor.addScreenAction}
                removeScreenAction={editor.removeScreenAction}
                updateScreenAction={editor.updateScreenAction}
                updateDrawField={editor.updateDrawField}
                addDrawStep={editor.addDrawStep}
                removeDrawStep={editor.removeDrawStep}
                updateDrawStep={editor.updateDrawStep}
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
        {editor.screenIds.length} screens &middot; {editor.edges.length} links
        {editor.unmappedCount > 0 && <span className="ml-2 text-danger">&middot; {editor.unmappedCount} unmapped</span>}
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

      <CreateSlotLinkDialog
        pendingSlotLink={editor.pendingSlotLink}
        setPendingSlotLink={editor.setPendingSlotLink}
        commitSlotLink={editor.commitSlotLink}
        describeCanvasTarget={editor.describeCanvasTarget}
        graphBuilderSpec={editor.graphBuilderSpec}
      />

      <CreateMenuActionDialog
        pendingMenuActionLink={editor.pendingMenuActionLink}
        setPendingMenuActionLink={editor.setPendingMenuActionLink}
        commitMenuActionLink={editor.commitMenuActionLink}
        describeCanvasTarget={editor.describeCanvasTarget}
      />
    </div>
  )
}
