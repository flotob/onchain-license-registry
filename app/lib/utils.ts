// Tremor Raw cx [v0.0.0]

import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focusInput [v0.0.2]
// Updated to use semantic color tokens

export const focusInput = [
  // base
  "focus:ring-2",
  // ring color
  "focus:ring-accent-muted",
  // border color
  "focus:border-accent",
]

// Tremor Raw focusRing [v0.0.1]
// Updated to use semantic color tokens

export const focusRing = [
  // base
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  // outline color
  "outline-accent",
]

// Tremor Raw hasErrorInput [v0.0.1]

export const hasErrorInput = [
  // base
  "ring-2",
  // border color
  "border-destructive",
  // ring color
  "ring-destructive/20",
]
