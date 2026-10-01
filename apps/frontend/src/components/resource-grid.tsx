import { levelColor } from '@/lib/levels'
import { useEffect, useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getResourceMatrix, type ResourceMatrix } from '@/services/resources'
import { socket } from '@/services/socket'

// Palette d'état : un seuil, un nom, une couleur. Le chiffre reste affiché dans
// chaque case, la couleur ne porte donc jamais l'information toute seule.
const STATUS = [
  { from: 0.7, label: 'Nominal', color: '#0ca30c' },
  { from: 0.4, label: 'Sous tension', color: '#fab219' },
  { from: 0.15, label: 'Critique', color: '#ec835a' },
  { from: 0, label: 'Rupture', color: '#d03b3b' },
]

// Le niveau de crise reste du texte : la couleur de cette page est réservée
// au niveau de stock, sans quoi les deux échelles de rouge se confondraient.
const CRISIS = ['Veille', 'Alerte', 'Urgence', 'Critique', 'Catastrophe']

const ratioOf = (quantity: number, initial: number) =>
  initial > 0 ? quantity / initial : 0

const statusOf = (ratio: number) =>
  STATUS.find((entry) => ratio >= entry.from) ?? STATUS[STATUS.length - 1]

const percent = (ratio: number) => `${Math.round(ratio * 100)} %`

function StatTile({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <Card className="gap-0">
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <CardContent className="pt-4">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div
      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: `${color}2e` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(ratio, 0) * 100}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function ResourceGrid() {
  const [matrix, setMatrix] = useState<ResourceMatrix | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'scarcity' | 'name'>('scarcity')
  const [focus, setFocus] = useState<{ row: number; code: string } | null>(null)

  useEffect(() => {
    let running = true

    const load = () =>
      getResourceMatrix()
        .then((data) => running && setMatrix(data))
        .catch((e) => running && setError(e.message))

    // Recharge le tableau dès que le backend annonce un changement de stock
    load()
    socket.on('stock-changed', load)

    return () => {
      running = false
      socket.off('stock-changed', load)
    }
  }, [])

  const rows = useMemo(() => {
    if (!matrix) {
      return []
    }

    const needle = search.trim().toLowerCase()
    const filtered = matrix.rows.filter((row) =>
      row.name.toLowerCase().includes(needle),
    )

    return filtered.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : ratioOf(a.quantity, a.initialQuantity) -
          ratioOf(b.quantity, b.initialQuantity),
    )
  }, [matrix, search, sort])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!matrix) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>
  }

  const quantity = matrix.rows.reduce((sum, row) => sum + row.quantity, 0)
  const initial = matrix.rows.reduce((sum, row) => sum + row.initialQuantity, 0)
  const strained = matrix.rows.filter(
    (row) => ratioOf(row.quantity, row.initialQuantity) < 0.4,
  ).length
  const broken = matrix.rows.reduce(
    (count, row) =>
      count +
      matrix.quarters.filter((column) => {
        const cell = row.stock[column.code]
        return cell && ratioOf(cell.quantity, cell.initialQuantity) < 0.15
      }).length,
    0,
  )
  const inCrisis = matrix.quarters.filter((column) => column.level >= 4).length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock de la ville"
          value={percent(ratioOf(quantity, initial))}
          detail={`${quantity} unités sur ${initial}`}
          color={statusOf(ratioOf(quantity, initial)).color}
        />
        <StatTile
          label="Ressources sous tension"
          value={`${strained}`}
          detail="moins de 40 % de la dotation"
          color={strained > 0 ? '#fab219' : '#0ca30c'}
        />
        <StatTile
          label="Cases en rupture"
          value={`${broken}`}
          detail="moins de 15 % dans un quartier"
          color={broken > 0 ? '#d03b3b' : '#0ca30c'}
        />
        <StatTile
          label="Quartiers en crise"
          value={`${inCrisis}`}
          detail="niveau 4 ou 5"
          color={inCrisis > 0 ? '#ec835a' : '#0ca30c'}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 md:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrer une ressource"
                className="pl-9"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs tracking-widest text-muted-foreground uppercase">
                Trier par
              </span>
              <Button
                size="sm"
                variant={sort === 'scarcity' ? 'default' : 'outline'}
                onClick={() => setSort('scarcity')}
              >
                Pénurie
              </Button>
              <Button
                size="sm"
                variant={sort === 'name' ? 'default' : 'outline'}
                onClick={() => setSort('name')}
              >
                Nom
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto" onMouseLeave={() => setFocus(null)}>
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="w-56 border-b px-3 pb-3 align-bottom text-xs tracking-widest text-muted-foreground uppercase">
                    Ressource
                  </th>
                  {matrix.quarters.map((column) => (
                      <th
                        key={column.code}
                        className={`border-b px-3 pb-3 align-bottom ${
                          focus?.code === column.code ? 'bg-foreground/5' : ''
                        }`}
                      >
                        <span className="block text-lg leading-tight font-bold">
                          {column.code}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {column.name}
                        </span>
                        <span
                          className="block text-[11px] font-semibold tracking-wide"
                          style={{ color: levelColor(column.level) }}
                        >
                          L{column.level} · {CRISIS[column.level - 1]}
                        </span>
                      </th>
                  ))}
                  <th className="border-b px-3 pb-3 align-bottom">
                    <span className="block text-lg leading-tight font-bold">
                      Ville
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      tous quartiers
                    </span>
                    <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">
                      total
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const total = ratioOf(row.quantity, row.initialQuantity)
                  const active = focus?.row === row.resourceTypeId

                  return (
                    <tr
                      key={row.resourceTypeId}
                      className={active ? 'bg-foreground/5' : ''}
                    >
                      <th
                        scope="row"
                        className="border-b px-3 py-2 align-middle text-sm font-medium"
                      >
                        {row.name}
                      </th>

                      {matrix.quarters.map((column) => {
                        const cell = row.stock[column.code]
                        const ratio = cell
                          ? ratioOf(cell.quantity, cell.initialQuantity)
                          : 0
                        const status = statusOf(ratio)

                        return (
                          <td
                            key={column.code}
                            title={`${row.name} · ${column.name} : ${cell?.quantity ?? 0} sur ${cell?.initialQuantity ?? 0} (${percent(ratio)}) — ${status.label}`}
                            onMouseEnter={() =>
                              setFocus({
                                row: row.resourceTypeId,
                                code: column.code,
                              })
                            }
                            className={`border-b px-3 py-2 ${
                              focus?.code === column.code
                                ? 'bg-foreground/5'
                                : ''
                            } ${
                              active && focus?.code === column.code
                                ? 'ring-1 ring-foreground/25'
                                : ''
                            }`}
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-mono text-base tabular-nums">
                                {cell?.quantity ?? 0}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                /{cell?.initialQuantity ?? 0}
                              </span>
                            </span>
                            <Bar ratio={ratio} color={status.color} />
                          </td>
                        )
                      })}

                      <td className="border-b px-3 py-2">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-base font-semibold tabular-nums">
                            {row.quantity}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            /{row.initialQuantity}
                          </span>
                        </span>
                        <Bar ratio={total} color={statusOf(total).color} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune ressource ne correspond à « {search} ».
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Niveau de stock
            </span>
            {STATUS.map((entry, index) => (
              <span
                key={entry.label}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.label}
                <span className="text-muted-foreground/70">
                  {index === 0
                    ? '≥ 70 %'
                    : `${Math.round(entry.from * 100)}–${Math.round(STATUS[index - 1].from * 100)} %`}
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
