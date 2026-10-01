import { useEffect, useState } from 'react'
import { ReservationForm } from '@/components/reservation-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  cancelReservation,
  confirmReservation,
  getReservations,
  type Reservation,
} from '@/services/reservations'
import { socket } from '@/services/socket'

const STATUS_NAMES = {
  PENDING: 'En attente',
  CONFIRMED: 'Validée',
  CANCELLED: 'Annulée',
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [error, setError] = useState('')

  // Recharge la liste des réservations depuis le backend
  function loadReservations() {
    getReservations()
      .then((data) => {
        setReservations(data)
        setError('')
      })
      .catch((e) => setError(e.message))
  }

  // Recharge la liste dès que le backend annonce un changement de réservation
  useEffect(() => {
    loadReservations()
    socket.on('reservation-changed', loadReservations)
    return () => {
      socket.off('reservation-changed', loadReservations)
    }
  }, [])

  // Valide ou annule une réservation puis recharge la liste
  async function runAction(action: (id: number) => Promise<unknown>, id: number) {
    try {
      await action(id)
      loadReservations()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold uppercase">Réservations</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ReservationForm onCreated={loadReservations} onError={setError} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quartier</TableHead>
            <TableHead>Ressource</TableHead>
            <TableHead>Quantité</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Aucune réservation pour le moment
              </TableCell>
            </TableRow>
          )}
          {reservations.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-bold">{r.quarter.code}</TableCell>
              <TableCell>{r.resourceType.name}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>
                {new Date(r.startDate).toLocaleDateString('fr-FR')} →{' '}
                {new Date(r.endDate).toLocaleDateString('fr-FR')}
              </TableCell>
              <TableCell>
                <Badge
                  variant={r.status === 'CONFIRMED' ? 'default' : 'secondary'}
                  className="rounded-none"
                >
                  {STATUS_NAMES[r.status]}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  size="sm"
                  className="rounded-none"
                  disabled={r.status !== 'PENDING'}
                  onClick={() => runAction(confirmReservation, r.id)}
                >
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none"
                  disabled={r.status === 'CANCELLED'}
                  onClick={() => runAction(cancelReservation, r.id)}
                >
                  Annuler
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
