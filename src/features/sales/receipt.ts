/**
 * Receipts (POS-015, POS-016). The PDF endpoint needs the auth header, so the
 * browser can't simply open its URL: fetch it as a blob, then print it from a
 * hidden frame or save it as a file.
 */
import { api, unwrap } from '@/lib/api/client'

export const fetchReceiptPdf = (saleId: number) =>
  unwrap(
    api.GET('/api/sales/{id}/receipt/', {
      params: { path: { id: saleId }, query: { export: 'pdf' } },
      parseAs: 'blob',
    }),
  ) as Promise<Blob>

/** Opens the print dialog for the receipt (falls back to a new tab). */
export async function printReceipt(saleId: number) {
  const url = URL.createObjectURL(await fetchReceiptPdf(saleId))
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.src = url
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, '_blank', 'noopener') // some browsers block printing PDFs in frames
    }
    // Leave time for the print dialog to read the document.
    setTimeout(cleanup, 60_000)
  })
  document.body.append(frame)
}

export async function downloadReceipt(saleId: number, transactionNumber: string) {
  const url = URL.createObjectURL(await fetchReceiptPdf(saleId))
  const link = document.createElement('a')
  link.href = url
  link.download = `receipt-${transactionNumber}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
