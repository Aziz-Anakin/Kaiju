import type { InventoryEntry } from '@/services/map'

import { request } from '@/lib/api'

export type QuarterColumn = {
  code: string
  name: string
  level: number
}

export type ResourceRow = {
  resourceTypeId: number
  name: string
  stock: Record<string, { quantity: number; initialQuantity: number }>
  quantity: number
  initialQuantity: number
}

export type ResourceMatrix = {
  quarters: QuarterColumn[]
  rows: ResourceRow[]
}

// Une colonne par quartier, une ligne par ressource, remplies avec l'inventaire
// de chaque quartier plus le total ville.
export async function getResourceMatrix(): Promise<ResourceMatrix> {
  const [quarters, levels] = await Promise.all([
    request<{ code: string; name: string }[]>('/quarters'),
    request<{ quarter: string; level: number }[]>('/disasters'),
  ])

  const columns = quarters.map((quarter) => ({
    code: quarter.code,
    name: quarter.name,
    level: levels.find((entry) => entry.quarter === quarter.code)?.level ?? 1,
  }))

  const inventories = await Promise.all(
    columns.map((column) =>
      request<InventoryEntry[]>(`/quarters/${column.code}/inventory`),
    ),
  )

  const rows = new Map<number, ResourceRow>()

  inventories.forEach((inventory, index) => {
    for (const entry of inventory) {
      const row = rows.get(entry.resourceTypeId) ?? {
        resourceTypeId: entry.resourceTypeId,
        name: entry.resourceType,
        stock: {},
        quantity: 0,
        initialQuantity: 0,
      }

      row.stock[columns[index].code] = {
        quantity: entry.quantity,
        initialQuantity: entry.initialQuantity,
      }
      row.quantity += entry.quantity
      row.initialQuantity += entry.initialQuantity
      rows.set(entry.resourceTypeId, row)
    }
  })

  return { quarters: columns, rows: [...rows.values()] }
}
