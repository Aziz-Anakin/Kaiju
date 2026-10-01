import { request } from '@/lib/api'

export type Transfer = {
  id: number
  quantity: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED'
  createdAt: string
  fromQuarter: { code: string; name: string }
  toQuarter: { code: string; name: string }
  // Quartier traversé quand les deux autres ne sont pas voisins
  transitQuarter: { code: string; name: string } | null
  // Premier accord reçu sur un transit, qui en demande deux
  approvedById: number | null
  resourceType: { name: string }
}

export type NewTransfer = {
  fromQuarter: string
  toQuarter: string
  resource: string
  quantity: number
  transitQuarter?: string
}

export function getTransfers(): Promise<Transfer[]> {
  return request('/transfers')
}

export function createTransfer(transfer: NewTransfer) {
  return request('/transfers', 'POST', transfer)
}

export function approveTransfer(id: number) {
  return request(`/transfers/${id}/approve`, 'PATCH')
}

export function rejectTransfer(id: number) {
  return request(`/transfers/${id}/reject`, 'PATCH')
}
