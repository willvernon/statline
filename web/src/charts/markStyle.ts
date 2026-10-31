import { useSyncExternalStore } from 'react'

// Logos or dots on the scatters. One preference for every chart, remembered per
// browser. Storage can throw (private mode, blocked site data), so it degrades
// to an in-memory value.

export type MarkStyle = 'logos' | 'dots'

const KEY = 'statline.marks'
const listeners = new Set<() => void>()
let current: MarkStyle = read()

function read(): MarkStyle {
  try {
    return localStorage.getItem(KEY) === 'dots' ? 'dots' : 'logos'
  } catch {
    return 'logos'
  }
}

export function setMarkStyle(v: MarkStyle) {
  current = v
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // Keep the in-memory value.
  }
  for (const l of listeners) l()
}

export function useMarkStyle(): MarkStyle {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => 'logos',
  )
}
