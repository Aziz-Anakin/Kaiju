import { request } from '@/lib/api'

export type Reservation = {
  id: number
  quantity: number
  startDate: string
  endDate: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  quarter: { code: string; name: string }
  resourceType: { name: string }
}

export type NewReservation = {
  userId: number
  quarter: string
  resource: string
  quantity: number
  startDate: string
  endDate: string
}

// Retrouve le quartier de l'officier connecté, ou null s'il n'en a pas comme le LC et le CD
export async function getMyQuarter(userId: number) {
  const user = await request(`/users/${userId}`)
  if (!user.quarterId) {
    return null
  }

  const quarters: { id: number; code: string; name: string }[] =
    await request('/quarters')
  return quarters.find((q) => q.id === user.quarterId) ?? null
}

export function getReservations(): Promise<Reservation[]> {
  return request('/reservations')
}

export function createReservation(reservation: NewReservation) {
  return request('/reservations', 'POST', reservation)
}

export function confirmReservation(id: number) {
  return request(`/reservations/${id}/confirm`, 'PATCH')
}

export function cancelReservation(id: number) {
  return request(`/reservations/${id}/cancel`, 'PATCH')
}
