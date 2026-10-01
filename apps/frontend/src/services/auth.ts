import { request } from '@/lib/api'

// Connecte l'officier et garde son token dans le navigateur
export async function login(email: string, password: string) {
  const data = await request('/auth/login', 'POST', { email, password })
  localStorage.setItem('token', data.access_token)
}

// Les 5 quartiers de la ville, affichés dans le select d'inscription
export type Quarter = { id: number; code: string; name: string }

export function getQuarters(): Promise<Quarter[]> {
  return request('/quarters')
}

// Chaque compte créé depuis le site est un Quarter Coordinator, rattaché au quartier choisi
export function register(name: string, email: string, password: string, quarterId: number) {
  return request('/auth/register', 'POST', { name, email, password, role: 'QC', quarterId })
}

export function logout() {
  localStorage.removeItem('token')
}

const ROLE_NAMES: Record<string, string> = {
  QC: 'Quarter Coordinator',
  LC: 'Logistics Coordinator',
  CD: 'City Director',
  ADMIN: 'Admin',
}

// Lit l'officier connecté dans le token, ou renvoie null si personne n'est connecté
export function getCurrentUser() {
  const token = localStorage.getItem('token')
  if (!token) {
    return null
  }

  const payload = JSON.parse(
    atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
  )
  return {
    id: payload.sub as number,
    email: payload.email as string,
    role: payload.role as string,
    roleName: ROLE_NAMES[payload.role] ?? payload.role,
  }
}
