import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCurrentUser, getQuarters, type Quarter } from '@/services/auth'
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type Role,
  type User,
} from '@/services/users'

const ROLES: { value: Role; label: string }[] = [
  { value: 'QC', label: 'Quarter Coordinator' },
  { value: 'LC', label: 'Logistics Coordinator' },
  { value: 'CD', label: 'City Director' },
  { value: 'ADMIN', label: 'Admin' },
]

export default function UsersPage() {
  const me = getCurrentUser()!
  const [users, setUsers] = useState<User[]>([])
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [newRole, setNewRole] = useState<Role>('LC')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    getQuarters()
      .then(setQuarters)
      .catch((e) => setError(e.message))
  }, [load])

  const quarterOf = (id: number | null) =>
    quarters.find((quarter) => quarter.id === id)?.code ?? '—'

  // Crée un compte avec le rôle choisi, un QC doit avoir un quartier
  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError('')

    try {
      await createUser({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        role: newRole,
        quarterId: newRole === 'QC' ? Number(form.get('quarterId')) : undefined,
      })
      formElement.reset()
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Passe un compte à un autre rôle, un QC garde son quartier actuel ou prend le premier
  async function changeRole(user: User, role: Role) {
    setError('')
    try {
      await updateUser(
        user.id,
        role,
        role === 'QC' ? (user.quarterId ?? quarters[0]?.id) : undefined,
      )
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(user: User) {
    if (!window.confirm(`Supprimer le compte ${user.email} ?`)) return
    setError('')
    try {
      await deleteUser(user.id)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="text-xs tracking-widest uppercase">
            Nouveau compte
          </CardTitle>
          <CardDescription>Crée un compte avec le rôle de ton choix</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <Field>
              <FieldLabel htmlFor="name">Nom</FieldLabel>
              <Input id="name" name="name" className="rounded-none" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                className="rounded-none"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                className="rounded-none"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="role">Rôle</FieldLabel>
              <Select
                id="role"
                value={newRole}
                onValueChange={(value) => setNewRole(value as Role)}
                className="rounded-none"
              >
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            {newRole === 'QC' && (
              <Field>
                <FieldLabel htmlFor="quarterId">Quartier</FieldLabel>
                <Select
                  key={quarters.length}
                  id="quarterId"
                  name="quarterId"
                  defaultValue={String(quarters[0]?.id ?? '')}
                  className="rounded-none"
                  required
                >
                  {quarters.map((quarter) => (
                    <SelectItem key={quarter.id} value={String(quarter.id)}>
                      {quarter.name} ({quarter.code})
                    </SelectItem>
                  ))}
                </Select>
              </Field>
            )}
            <div className="flex items-end">
              <Button type="submit" className="rounded-none">
                Créer le compte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="text-xs tracking-widest uppercase">
            Comptes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Quartier</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{quarterOf(user.quarterId)}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => changeRole(user, value as Role)}
                      className="w-56 rounded-none"
                      disabled={user.id === me.id}
                    >
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none"
                      disabled={user.id === me.id}
                      onClick={() => remove(user)}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
