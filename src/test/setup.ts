import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// Integration tests render lazily-loaded routes; under a busy test run the
// first import of a page can take over a second. Allow up to 3 s for
// findBy*/waitFor (they still resolve as soon as the UI is ready).
configure({ asyncUtilTimeout: 3000 })

// jsdom doesn't implement <dialog>'s modal API: toggle the `open` attribute so
// components using it can be tested (focus trapping is the browser's job).
function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
function closeDialog(this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = closeDialog
}

// jsdom has no matchMedia: answer min-width queries as a 1280px-wide desktop
// unless a test sets `window.innerWidth` (e.g. 390 for a phone layout).
function matchMediaStub(query: string): MediaQueryList {
  const min = /min-width:\s*([\d.]+)(px|rem)/.exec(query)
  const minPx = min ? Number(min[1]) * (min[2] === 'rem' ? 16 : 1) : 0
  const width = window.innerWidth || 1280
  return {
    matches: width >= minPx,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = matchMediaStub
}

// jsdom has no object URLs (used for image previews before upload).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => {}
}
