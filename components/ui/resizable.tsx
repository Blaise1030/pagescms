"use client"

import * as React from "react"
import { Group, Panel, Separator, usePanelRef as usePrimitivePanelRef } from "react-resizable-panels"
import type { GroupProps, PanelProps, SeparatorProps, PanelImperativeHandle } from "react-resizable-panels"

import { cn } from "@/lib/utils"

function usePanelRef() {
  return React.useRef<PanelImperativeHandle>(null)
}

function ResizablePanelGroup({
  className,
  orientation,
  ...props
}: Omit<GroupProps, "orientation"> & {
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={orientation ?? "horizontal"}
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  panelRef,
  onResize,
  defaultSize,
  ...props
}: Omit<PanelProps, "onResize" | "defaultSize"> & {
  panelRef?: React.RefObject<PanelImperativeHandle | null>
  onResize?: (size: { asPercentage: number }) => void
  defaultSize?: number | string
}) {
  const resolved = typeof defaultSize === "string" ? parseFloat(defaultSize) : defaultSize
  return (
    <Panel
      data-slot="resizable-panel"
      panelRef={panelRef}
      defaultSize={resolved}
      onResize={(size) => onResize?.({ asPercentage: size })}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      )}
    </Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup, usePanelRef }
