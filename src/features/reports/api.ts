import { api, unwrap } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import type { paths } from '@/lib/api/types'

/** Every report endpoint (the dashboard has its own page). */
export type ReportPath = Exclude<
  Extract<keyof paths, `/api/reports/${string}`>,
  '/api/reports/dashboard/'
>
export type ReportQuery = Record<string, string | number>
export type ReportRow = Record<string, unknown>
export interface ReportData {
  period?: { from: string; to: string }
  generated_at?: string
  note?: string
  results: ReportRow[]
  [extra: string]: unknown
}

export const reportKeys = {
  all: ['reports'] as const,
  one: (path: ReportPath, query: ReportQuery) => ['reports', path, query] as const,
}

// Each report has its own response type; the report page reads them through
// one generic shape described by its column definitions.
export const fetchReport = (path: ReportPath, query: ReportQuery) =>
  unwrap(
    api.GET(path as '/api/reports/sales/summary/', {
      params: { query: query as never },
    }),
  ) as Promise<ReportData>

/**
 * Download the report as CSV or PDF (REP-016/017). The endpoint needs the auth
 * header, so fetch it as a blob and save it under the server's file name.
 */
export async function downloadReport(path: ReportPath, query: ReportQuery, format: 'csv' | 'pdf') {
  const { data, error, response } = await api.GET(path as '/api/reports/sales/summary/', {
    params: { query: { ...query, export: format } as never },
    parseAs: 'blob',
  })
  if (error !== undefined || !response.ok || !data) {
    throw new ApiError(response.status, error)
  }
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `report.${format}`
  const url = URL.createObjectURL(data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return name
}
