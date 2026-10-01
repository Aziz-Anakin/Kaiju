import { useEffect, useState } from 'react'
import { TransferForm } from '@/components/transfer-form'
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
import { getCurrentUser } from '@/services/auth'
import { socket } from '@/services/socket'
import { getMyQuarter } from '@/services/reservations'
import {
  approveTransfer,
  getTransfers,
  rejectTransfer,
  type Transfer,
} from '@/services/transfers'

const STATUS_NAMES = {
  PENDING: 'En attente',
  APPROVED: 'Acceptée',
  REJECTED: 'Refusée',
  DELIVERED: 'Livrée',
}

export default function TransfersPage() {
  const user = getCurrentUser()!
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [error, setError] = useState('')
  const [myQuarterCode, setMyQuarterCode] = useState('')

  // Récupère le quartier de l'officier pour savoir à quelles demandes il peut répondre
  useEffect(() => {
    getMyQuarter(user.id)
      .then((quarter) => setMyQuarterCode(quarter?.code ?? ''))
      .catch((e) => setError(e.message))
  }, [user.id])

  // Le QC du quartier qui donne, celui du quartier traversé, ou le CD
  function canAnswer(transfer: Transfer) {
    return (
      user.role === 'CD' ||
      user.role === 'ADMIN' ||
      transfer.fromQuarter.code === myQuarterCode ||
      transfer.transitQuarter?.code === myQuarterCode
    )
  }

  // Un transit attend deux accords : on montre qu'il en a déjà reçu un
  function statusLabel(transfer: Transfer) {
    if (
      transfer.status === 'PENDING' &&
      transfer.transitQuarter &&
      transfer.approvedById
    ) {
      return 'En attente (1 accord sur 2)'
    }
    return STATUS_NAMES[transfer.status]
  }

  // Recharge la liste des transferts depuis le backend
  function loadTransfers() {
    getTransfers()
      .then((data) => {
        setTransfers(data)
        setError('')
      })
      .catch((e) => setError(e.message))
  }

  // Recharge la liste dès que le backend annonce un changement de transfert
  useEffect(() => {
    loadTransfers()
    socket.on('transfer-changed', loadTransfers)
    return () => {
      socket.off('transfer-changed', loadTransfers)
    }
  }, [])

  // Accepte ou refuse une demande puis recharge la liste
  async function runAction(
    action: (id: number) => Promise<unknown>,
    id: number,
  ) {
    try {
      await action(id)
      loadTransfers()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold uppercase">Transferts</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <TransferForm onCreated={loadTransfers} onError={setError} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>De</TableHead>
            <TableHead>Vers</TableHead>
            <TableHead>Via</TableHead>
            <TableHead>Ressource</TableHead>
            <TableHead>Quantité</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                Aucun transfert pour le moment
              </TableCell>
            </TableRow>
          )}
          {transfers.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-bold">{t.fromQuarter.code}</TableCell>
              <TableCell className="font-bold">{t.toQuarter.code}</TableCell>
              <TableCell className="text-muted-foreground">
                {t.transitQuarter?.code ?? '—'}
              </TableCell>
              <TableCell>{t.resourceType.name}</TableCell>
              <TableCell>{t.quantity}</TableCell>
              <TableCell>
                {new Date(t.createdAt).toLocaleDateString('fr-FR')}
              </TableCell>
              <TableCell>
                <Badge
                  variant={t.status === 'PENDING' ? 'secondary' : 'default'}
                  className="rounded-none"
                >
                  {statusLabel(t)}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                {canAnswer(t) && (
                  <>
                    <Button
                      size="sm"
                      className="rounded-none"
                      disabled={t.status !== 'PENDING'}
                      onClick={() => runAction(approveTransfer, t.id)}
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-none"
                      disabled={t.status !== 'PENDING'}
                      onClick={() => runAction(rejectTransfer, t.id)}
                    >
                      Refuser
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
