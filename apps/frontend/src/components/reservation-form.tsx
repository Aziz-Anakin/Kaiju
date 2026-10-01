import { useEffect, useState } from 'react'
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
import { getCurrentUser } from '@/services/auth'
import { createReservation, getMyQuarter } from '@/services/reservations'

const RESOURCES = [
  'Medical personnel',
  'Rescue teams',
  'Transport vehicles',
  'Emergency shelters',
  'Food & water supplies',
  'Communication equipment',
  'Power generators',
  'Engineering crews',
  'Security units',
  'Hazmat equipment',
]

type Props = {
  onCreated: () => void
  onError: (message: string) => void
}

export function ReservationForm({ onCreated, onError }: Props) {
  const user = getCurrentUser()!
  const [quarter, setQuarter] = useState<{ code: string; name: string } | null>(
    null,
  )
  const [loaded, setLoaded] = useState(false)

  // Charge le quartier de l'officier connecté pour réserver uniquement dedans
  useEffect(() => {
    getMyQuarter(user.id)
      .then(setQuarter)
      .catch((e) => onError(e.message))
      .finally(() => setLoaded(true))
  }, [user.id, onError])

  // Envoie la réservation dans le quartier de l'officier puis recharge la liste
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    try {
      await createReservation({
        userId: user.id,
        quarter: quarter!.code,
        resource: String(form.get('resource')),
        quantity: Number(form.get('quantity')),
        startDate: String(form.get('startDate')),
        endDate: String(form.get('endDate')),
      })
      onCreated()
    } catch (e) {
      onError((e as Error).message)
    }
  }

  // Un officier sans quartier comme le LC ou le CD ne peut pas réserver
  if (loaded && !quarter) {
    return (
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">
            Nouvelle réservation
          </CardTitle>
          <CardDescription>
            Seul un Quarter Coordinator peut réserver dans son quartier
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="tracking-widest uppercase">
          Nouvelle réservation
        </CardTitle>
        <CardDescription>
          Réserve une ressource dans ton propre quartier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <Field>
            <FieldLabel htmlFor="quarter">Quartier</FieldLabel>
            <Input
              id="quarter"
              value={quarter ? `${quarter.code} · ${quarter.name}` : ''}
              className="rounded-none"
              readOnly
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="resource">Ressource</FieldLabel>
            <Select
              id="resource"
              name="resource"
              defaultValue={RESOURCES[0]}
              className="rounded-none"
            >
              {RESOURCES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="quantity">Quantité</FieldLabel>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              className="rounded-none"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="startDate">Début</FieldLabel>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              className="rounded-none"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="endDate">Fin</FieldLabel>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              className="rounded-none"
              required
            />
          </Field>
          <Button
            type="submit"
            className="self-end rounded-none text-xs font-semibold tracking-widest uppercase"
          >
            Réserver
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
