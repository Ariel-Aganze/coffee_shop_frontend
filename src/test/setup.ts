import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

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
