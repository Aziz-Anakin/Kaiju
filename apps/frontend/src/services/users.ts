import { request } from '@/lib/api'

export type Role = 'QC' | 'LC' | 'CD' | 'ADMIN'

export type User = {
  id: number
  email: string
  name: string
  role: Role
  quarterId: number | null
}

export type NewUser = {
  email: string
  name: string
  password: string
  role: Role
  quarterId?: number
}

export const getUsers = (): Promise<User[]> => request('/users')

export const createUser = (user: NewUser): Promise<User> =>
  request('/users', 'POST', user)

export const updateUser = (
  id: number,
  role: Role,
  quarterId?: number,
): Promise<User> => request(`/users/${id}`, 'PATCH', { role, quarterId })

export const deleteUser = (id: number) => request(`/users/${id}`, 'DELETE')
