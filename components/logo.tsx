import React from "react"

interface LogoProps {
  className?: string
  iconOnly?: boolean
}

export default function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Sleek, geometric flower & ledger icon */}
      <svg
        className="h-5 w-5 shrink-0 text-zinc-950 dark:text-zinc-50 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Core geometric grid */}
        <circle cx="12" cy="12" r="3" className="stroke-zinc-400 dark:stroke-zinc-600" strokeDasharray="1.5 1.5" />

        {/* Abstract structural petals (representing financial segments converging) */}
        <path d="M12 2a4 4 0 0 1 4 4v6H8V6a4 4 0 0 1 4-4z" />
        <path d="M12 22a4 4 0 0 1-4-4v-6h8v6a4 4 0 0 1-4 4z" />
        <path d="M2 12a4 4 0 0 1 4-4h6v8H6a4 4 0 0 1-4-4z" />
        <path d="M22 12a4 4 0 0 1-4 4h-6v-8h6a4 4 0 0 1 4 4z" />
      </svg>

      {!iconOnly && (
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-50">
          Chrysal <span className="font-normal text-zinc-400 dark:text-zinc-500">FinOps</span>
        </span>
      )}
    </div>
  )
}
