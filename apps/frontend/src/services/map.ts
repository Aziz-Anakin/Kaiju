import { request } from '@/lib/api'

export type QuarterLevel = {
  quarter: string
  level: number
  name: string
}

export type InventoryEntry = {
  resourceTypeId: number
  resourceType: string
  initialQuantity: number
  quantity: number
}

export function getDisasterLevels(): Promise<QuarterLevel[]> {
  return request('/disasters')
}

export function getQuarterInventory(code: string): Promise<InventoryEntry[]> {
  return request(`/quarters/${code}/inventory`)
}
