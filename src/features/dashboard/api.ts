import { api, unwrap } from '@/lib/api/client'
import type { Schema } from '@/lib/api/types'

export type Dashboard = Schema<'Dashboard'>
export type DashBranch = Schema<'_DashBranch'>
export type DashProduct = Schema<'_DashProduct'>
export type DashTrendDay = Schema<'_DashTrendDay'>

export interface DashboardParams {
  from: string
  to: string
  branch: number | null
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  view: (p: DashboardParams) => ['dashboard', p] as const,
}

export const fetchDashboard = ({ from, to, branch }: DashboardParams) =>
  unwrap(
    api.GET('/api/reports/dashboard/', {
      params: { query: { from, to, ...(branch ? { branch } : {}) } },
    }),
  )
