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
import { getMyQuarter } from '@/services/reservations'
import { createTransfer } from '@/services/transfers'

const QUARTERS = ['A', 'E', 'W', 'X', 'Z']

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

export function TransferForm({ onCreated, onError }: Props) {
  const user = getCurrentUser()!
  const [quarter, setQuarter] = useState<{ code: string; name: string } | null>(
    null,
  )
  const [loaded, setLoaded] = useState(false)

  // Charge le quartier de l'officier qui sera celui qui reçoit les ressources
  useEffect(() => {
    getMyQuarter(user.id)
      .then(setQuarter)
      .catch((e) => onError(e.message))
      .finally(() => setLoaded(true))
  }, [user.id, onError])

  // Envoie la demande de transfert vers le quartier de l'officier puis recharge la liste
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    try {
      await createTransfer({
        fromQuarter: String(form.get('fromQuarter')),
        toQuarter: quarter ? quarter.code : String(form.get('toQuarter')),
        resource: String(form.get('resource')),
        quantity: Number(form.get('quantity')),
        transitQuarter: (() => {
          const transit = String(form.get('transitQuarter') ?? 'auto')
          return transit === 'auto' ? undefined : transit
        })(),
      })
      onCreated()
    } catch (e) {
      onError((e as Error).message)
    }
  }

  const canPickQuarters = loaded && !quarter

  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="tracking-widest uppercase">
          Nouvelle demande de transfert
        </CardTitle>
        <CardDescription>
          {canPickQuarters
            ? 'Organise un transfert entre deux quartiers, avec un transit si besoin'
            : 'Demande une ressource à un autre quartier pour ton quartier'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <Field>
            <FieldLabel htmlFor="fromQuarter">Quartier qui donne</FieldLabel>
            <Select
              key={quarter?.code}
              id="fromQuarter"
              name="fromQuarter"
              defaultValue={QUARTERS.find((code) => code !== quarter?.code)}
              className="rounded-none"
            >
              {QUARTERS.filter((code) => code !== quarter?.code).map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="toQuarter">Quartier qui reçoit</FieldLabel>
            {canPickQuarters ? (
              <Select
                id="toQuarter"
                name="toQuarter"
                defaultValue="E"
                className="rounded-none"
              >
                {QUARTERS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </Select>
            ) : (
              <Input
                id="toQuarter"
                value={quarter ? `${quarter.code} · ${quarter.name}` : ''}
                className="rounded-none"
                readOnly
              />
            )}
          </Field>
          {canPickQuarters && (
            <Field>
              <FieldLabel htmlFor="transitQuarter">Quartier de transit</FieldLabel>
              <Select
                id="transitQuarter"
                name="transitQuarter"
                defaultValue="auto"
                className="rounded-none"
              >
                <SelectItem value="auto">Automatique</SelectItem>
                {QUARTERS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </Select>
            </Field>
          )}
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
          <Button
            type="submit"
            className="self-end rounded-none text-xs font-semibold tracking-widest uppercase"
          >
            Demander
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
