"use client"

import { Toaster as Sonner, toast } from "sonner"

function Toaster(props) {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      expand={false}
      visibleToasts={4}
      toastOptions={{
        className:
          "select-none rounded-none border border-border bg-card font-mono text-xs uppercase tracking-[0.12em] text-card-foreground shadow-none",
        descriptionClassName: "font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground",
        actionButtonStyle: {
          borderRadius: 0,
          border: "1px solid var(--border)",
          background: "var(--secondary)",
          color: "var(--secondary-foreground)",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em"
        },
        cancelButtonStyle: {
          borderRadius: 0,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--foreground)",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.12em"
        }
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
