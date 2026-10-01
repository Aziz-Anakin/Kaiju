import { useEffect, useState } from 'react'
import { LogOutIcon, TriangleAlertIcon, UserIcon, XIcon } from 'lucide-react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getCurrentUser, logout } from '@/services/auth'
import { socket } from '@/services/socket'

type Conflict = { quarter: string; resource: string; transferIds: number[] }

// Liens du menu de gauche, chacun ouvre une page à droite
const links = [
  { to: '/', label: 'Tableau de bord' },
  { to: '/resources', label: 'Ressources' },
  { to: '/reservations', label: 'Réservations' },
  { to: '/transfers', label: 'Transferts' },
  { to: '/calendar', label: 'Calendrier' },
  { to: '/help', label: 'Aide' },
]

// Liens réservés au City Director, que l'admin a aussi
const directorLinks = [{ to: '/disasters', label: 'Niveaux de crise' }]

// Lien réservé à l'admin
const adminLinks = [{ to: '/users', label: 'Comptes' }]

export function AppLayout() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const [conflict, setConflict] = useState<Conflict | null>(null)

  useEffect(() => {
    function showConflict(data: Conflict) {
      setConflict(data)
    }
    socket.on('transfer-conflict', showConflict)
    return () => {
      socket.off('transfer-conflict', showConflict)
    }
  }, [])

  // Sans officier connecté on renvoie directement vers la page de connexion
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-sidebar px-6">
        <img src="/logo.webp" alt="Logo KAIJU" className="size-10 rounded-full" />
        <span className="text-xl font-bold tracking-widest">KAIJU</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserIcon className="size-4" />
            {user.email}
            <Badge className="rounded-none">{user.roleName}</Badge>
          </div>
          <Button
            variant="outline"
            className="rounded-none text-xs tracking-widest uppercase"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOutIcon />
            Déconnexion
          </Button>
        </div>
      </header>
      {conflict && (
        <div className="flex items-center gap-3 border-b bg-destructive px-6 py-3 text-sm font-semibold text-white">
          <TriangleAlertIcon className="size-5" />
          <span>
            Conflit : {conflict.transferIds.length} demandes visent {conflict.resource} du
            quartier {conflict.quarter} (transferts n°{conflict.transferIds.join(', n°')})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto rounded-none hover:bg-white/20"
            onClick={() => setConflict(null)}
          >
            <XIcon />
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 flex-col gap-1 border-r bg-sidebar p-3">
          {[
            ...links,
            ...(user.role === 'CD' || user.role === 'ADMIN' ? directorLinks : []),
            ...(user.role === 'ADMIN' ? adminLinks : []),
          ].map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-semibold tracking-wide uppercase ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
