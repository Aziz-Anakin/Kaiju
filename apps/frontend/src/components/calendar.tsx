import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { getReservations, type Reservation } from '@/services/reservations'
import { socket } from '@/services/socket'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_CHIPS = 3

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

// Les réservations actives, tenues à jour quand quelqu'un en crée ou en change une
function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    function load() {
      getReservations()
        .then((data) => {
          setReservations(data.filter((r) => r.status !== 'CANCELLED'))
          setError('')
        })
        .catch((e) => setError(e.message))
    }
    load()
    socket.on('reservation-changed', load)
    return () => {
      socket.off('reservation-changed', load)
    }
  }, [])

  return { reservations, error }
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="size-3 bg-primary" /> Confirmée
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3 border border-dashed border-primary bg-primary/15" />{' '}
        En attente
      </span>
    </div>
  )
}

export function Calendar({ compact = false }: { compact?: boolean }) {
  const { reservations, error } = useReservations()
  const [month, setMonth] = useState(startOfDay(new Date()))

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const today = startOfDay(new Date())

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(year, monthIndex, i + 1),
    ),
  ]

  function reservationsOf(day: Date) {
    return reservations.filter(
      (r) =>
        startOfDay(new Date(r.startDate)) <= day &&
        day <= startOfDay(new Date(r.endDate)),
    )
  }

  const monthCount = reservations.filter(
    (r) =>
      new Date(r.startDate) <= new Date(year, monthIndex + 1, 0, 23, 59) &&
      new Date(r.endDate) >= new Date(year, monthIndex, 1),
  ).length

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === monthIndex

  const nav = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'icon'}
        className="rounded-none"
        aria-label="Mois précédent"
        onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'icon'}
        className="rounded-none"
        aria-label="Mois suivant"
        onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
      >
        <ChevronRightIcon />
      </Button>
      {!compact && (
        <Button
          variant="outline"
          className="rounded-none"
          disabled={isCurrentMonth}
          onClick={() => setMonth(startOfDay(new Date()))}
        >
          Aujourd'hui
        </Button>
      )}
    </div>
  )

  const title = (
    <div>
      <p
        className={`font-bold tracking-wide uppercase ${compact ? 'text-sm' : 'text-2xl'}`}
      >
        {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
      </p>
      <p className="text-xs text-muted-foreground">
        {monthCount} réservation{monthCount > 1 ? 's' : ''} ce mois-ci
      </p>
    </div>
  )

  if (compact) {
    return (
      <div className="flex flex-col gap-3 border p-4">
        <div className="flex items-start justify-between gap-2">
          {title}
          {nav}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="grid grid-cols-7 gap-px text-center">
          {DAYS.map((day) => (
            <div
              key={day}
              className="pb-1 text-[10px] font-bold text-muted-foreground uppercase"
            >
              {day.slice(0, 1)}
            </div>
          ))}
          {cells.map((day, index) => {
            if (!day) return <div key={index} />
            const items = reservationsOf(day)
            const isToday = sameDay(day, today)
            const confirmed = items.some((r) => r.status === 'CONFIRMED')
            return (
              <div
                key={index}
                title={items
                  .map((r) => `${r.quarter.code} · ${r.quantity} ${r.resourceType.name}`)
                  .join('\n')}
                className={`flex h-9 flex-col items-center justify-center text-xs ${
                  isToday ? 'bg-primary font-bold text-primary-foreground' : ''
                }`}
              >
                {day.getDate()}
                <span
                  className={`mt-0.5 size-1.5 rounded-full ${
                    items.length === 0
                      ? 'bg-transparent'
                      : isToday
                        ? 'bg-primary-foreground'
                        : confirmed
                          ? 'bg-primary'
                          : 'border border-primary'
                  }`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Legend />
          <Link
            to="/calendar"
            className="text-xs font-semibold tracking-wide uppercase underline-offset-4 hover:underline"
          >
            Voir tout
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {title}
        {nav}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-7 border-t border-l">
        {DAYS.map((day) => (
          <div
            key={day}
            className="border-r border-b bg-sidebar p-2 text-center text-xs font-bold tracking-widest uppercase"
          >
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) {
            return (
              <div key={index} className="min-h-28 border-r border-b bg-muted/20" />
            )
          }
          const items = reservationsOf(day)
          const isToday = sameDay(day, today)
          const weekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div
              key={index}
              className={`min-h-28 border-r border-b p-1.5 ${
                isToday ? 'bg-primary/10' : weekend ? 'bg-muted/20' : ''
              }`}
            >
              <div className="mb-1.5">
                <span
                  className={`inline-flex size-6 items-center justify-center text-xs font-bold ${
                    isToday ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, MAX_CHIPS).map((r) => (
                  <div
                    key={r.id}
                    title={`${r.quarter.name} · ${r.quantity} ${r.resourceType.name} (${
                      r.status === 'CONFIRMED' ? 'confirmée' : 'en attente'
                    })`}
                    className={`truncate px-1.5 py-0.5 text-xs ${
                      r.status === 'CONFIRMED'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-dashed border-primary bg-primary/15'
                    }`}
                  >
                    <span className="font-bold">{r.quarter.code}</span> ·{' '}
                    {r.quantity} {r.resourceType.name}
                  </div>
                ))}
                {items.length > MAX_CHIPS && (
                  <span className="px-1 text-xs font-semibold text-muted-foreground">
                    +{items.length - MAX_CHIPS} autres
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Legend />
    </div>
  )
}
