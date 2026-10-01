import { LEVEL_COLORS } from '@/lib/levels'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import mapImage from '@/assets/tokyork-map.webp'
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  QUARTER_CODES,
  QUARTERS,
  type QuarterCode,
} from '@/data/tokyork-map'
import {
  getDisasterLevels,
  getQuarterInventory,
  type InventoryEntry,
  type QuarterLevel,
} from '@/services/map'
import { socket } from '@/services/socket'

const LEVELS = ['Veille', 'Alerte', 'Urgence', 'Critique', 'Catastrophe']

// Cartouches de la carte source, recouverts pour rester synchronisés avec l'API
const TITLE_BOX = { x: 8, y: 3, w: 566, h: 90 }
const LEGEND_BOX = { x: 7, y: 907, w: 280, h: 170 }
const PLATE = { w: 196, h: 126 }

export function CityMap() {
  const [levels, setLevels] = useState<QuarterLevel[]>([])
  const [active, setActive] = useState<QuarterCode | null>(null)
  const [inventories, setInventories] = useState<
    Partial<Record<QuarterCode, InventoryEntry[]>>
  >({})
  const [inventoryError, setInventoryError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let running = true

    const load = () =>
      getDisasterLevels()
        .then((data) => running && setLevels(data))
        .catch((e) => running && setError(e.message))

    // Recharge les niveaux dès que le backend annonce un changement
    load()
    socket.on('disaster-level-changed', load)

    return () => {
      running = false
      socket.off('disaster-level-changed', load)
    }
  }, [])

  // Recharge le stock du quartier dont le backend annonce un changement
  useEffect(() => {
    const refresh = ({ quarter }: { quarter: QuarterCode }) =>
      getQuarterInventory(quarter).then((data) =>
        setInventories((current) => ({ ...current, [quarter]: data })),
      )

    socket.on('stock-changed', refresh)
    return () => {
      socket.off('stock-changed', refresh)
    }
  }, [])

  const show = useCallback(
    (code: QuarterCode) => {
      setActive(code)
      if (inventories[code]) {
        return
      }

      getQuarterInventory(code)
        .then((data) =>
          setInventories((current) => ({ ...current, [code]: data })),
        )
        .catch((e) => setInventoryError(e.message))
    },
    [inventories],
  )

  const levelOf = (code: QuarterCode) =>
    levels.find((entry) => entry.quarter === code)?.level ?? 1

  const activeQuarter = active ? QUARTERS[active] : null
  const activeInventory = active ? inventories[active] : undefined

  return (
    <Card className="kaiju-map">
      <style>{`
        .kaiju-map {
          --level-1: ${LEVEL_COLORS[0]};
          --level-2: ${LEVEL_COLORS[1]};
          --level-3: ${LEVEL_COLORS[2]};
          --level-4: ${LEVEL_COLORS[3]};
          --level-5: ${LEVEL_COLORS[4]};
          --plate: rgba(15, 17, 20, 0.86);
          --cartouche: #fcfcfb;
          --cartouche-line: rgba(11, 11, 11, 0.55);
          --ink: #0b0b0b;
          --ink-soft: #52514e;
        }
        .dark .kaiju-map {
          --cartouche: #1a1a19;
          --cartouche-line: rgba(255, 255, 255, 0.35);
          --ink: #ffffff;
          --ink-soft: #c3c2b7;
        }
        .dark .kaiju-map .kaiju-photo { filter: brightness(0.7) saturate(0.85); }
        .kaiju-land { isolation: isolate; }
        .kaiju-relief { mix-blend-mode: multiply; }
        .kaiju-map svg text { font-family: system-ui, sans-serif; }
        .kaiju-hit { cursor: pointer; outline: none; }
      `}</style>

      <CardContent className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="mx-auto h-auto w-full rounded-md border"
            style={{
              maxWidth: `calc((100svh - 14rem) * ${MAP_WIDTH / MAP_HEIGHT})`,
            }}
            role="img"
            aria-label="Carte de Tokyork, cinq quartiers colorés par niveau de crise"
          >
            <defs>
              <clipPath id="kaiju-clip">
                {QUARTER_CODES.map((code) => (
                  <polygon key={code} points={QUARTERS[code].points} />
                ))}
              </clipPath>
            </defs>

            <image
              className="kaiju-photo"
              href={mapImage}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
            />

            <g className="kaiju-land">
              {QUARTER_CODES.map((code) => (
                <polygon
                  key={code}
                  points={QUARTERS[code].points}
                  fill={`var(--level-${levelOf(code)})`}
                />
              ))}
              {/* le relief ne fait qu'assombrir : la teinte du niveau reste exacte */}
              <image
                className="kaiju-relief"
                href={mapImage}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                clipPath="url(#kaiju-clip)"
                opacity={0.3}
              />
            </g>

            {QUARTER_CODES.map((code) => {
              const isActive = active === code
              const isNeighbor = activeQuarter?.neighbors.includes(code) ?? false

              return (
                <g key={code} pointerEvents="none">
                  {isActive && (
                    <>
                      <polygon
                        points={QUARTERS[code].points}
                        fill="#ffffff"
                        opacity={0.07}
                      />
                      <polygon
                        points={QUARTERS[code].points}
                        fill="none"
                        stroke="#0b0b0b"
                        strokeWidth={13}
                        strokeOpacity={0.45}
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                  <polygon
                    points={QUARTERS[code].points}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={isActive ? 6 : isNeighbor ? 5 : 3}
                    strokeDasharray={isNeighbor ? '16 12' : undefined}
                    strokeLinejoin="round"
                    opacity={isActive || isNeighbor ? 1 : 0.8}
                  />
                </g>
              )
            })}

            {QUARTER_CODES.map((code) => (
              <polygon
                key={code}
                className="kaiju-hit"
                points={QUARTERS[code].points}
                fill="none"
                pointerEvents="all"
                tabIndex={0}
                role="button"
                aria-label={`${QUARTERS[code].name}, niveau ${levelOf(code)}`}
                onMouseEnter={() => show(code)}
                onFocus={() => show(code)}
              >
                <title>
                  {QUARTERS[code].name} — niveau {levelOf(code)}{' '}
                  {LEVELS[levelOf(code) - 1]}
                </title>
              </polygon>
            ))}

            <g pointerEvents="none">
              {QUARTER_CODES.map((code) => {
                const { label, name } = QUARTERS[code]
                const level = levelOf(code)

                return (
                  <g key={code}>
                    <rect
                      x={label.x - PLATE.w / 2}
                      y={label.y - PLATE.h / 2}
                      width={PLATE.w}
                      height={PLATE.h}
                      rx={10}
                      fill="var(--plate)"
                      stroke="#ffffff"
                      strokeWidth={active === code ? 3 : 1.5}
                      strokeOpacity={active === code ? 1 : 0.35}
                    />
                    <text
                      x={label.x}
                      y={label.y - 16}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={46}
                      fontWeight={700}
                    >
                      {code}
                    </text>
                    <text
                      x={label.x}
                      y={label.y + 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={22}
                      opacity={0.85}
                    >
                      {name}
                    </text>
                    <text
                      x={label.x}
                      y={label.y + 44}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={21}
                      fontWeight={600}
                    >
                      L{level} · {LEVELS[level - 1]}
                    </text>
                  </g>
                )
              })}
            </g>

            <g pointerEvents="none">
              <rect
                x={TITLE_BOX.x}
                y={TITLE_BOX.y}
                width={TITLE_BOX.w}
                height={TITLE_BOX.h}
                rx={8}
                fill="var(--cartouche)"
                stroke="var(--cartouche-line)"
                strokeWidth={2}
              />
              <text
                x={32}
                y={52}
                fill="var(--ink)"
                fontSize={38}
                fontWeight={700}
                letterSpacing={1.5}
              >
                CARTE DE TOKYORK
              </text>
              <text x={32} y={80} fill="var(--ink-soft)" fontSize={19}>
                Niveau de crise en temps réel · survolez un quartier
              </text>
            </g>

            <g>
              <rect
                x={LEGEND_BOX.x}
                y={LEGEND_BOX.y}
                width={LEGEND_BOX.w}
                height={LEGEND_BOX.h}
                rx={8}
                fill="var(--cartouche)"
                stroke="var(--cartouche-line)"
                strokeWidth={2}
              />
              <text
                x={28}
                y={940}
                fill="var(--ink)"
                fontSize={20}
                fontWeight={700}
                letterSpacing={1.6}
              >
                NIVEAU DE CRISE
              </text>
              {LEVELS.map((label, index) => (
                <g key={label}>
                  <rect
                    x={28}
                    y={968 + index * 24 - 13}
                    width={26}
                    height={16}
                    rx={3}
                    fill={`var(--level-${index + 1})`}
                  />
                  <text
                    x={66}
                    y={968 + index * 24}
                    fill="var(--ink-soft)"
                    fontSize={21}
                  >
                    L{index + 1} · {label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        <aside className="w-full border-t pt-4 xl:w-80 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
          {active && activeQuarter ? (
            <>
              <p className="text-2xl font-bold">{activeQuarter.name}</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Quartier {active} · niveau {levelOf(active)}{' '}
                {LEVELS[levelOf(active) - 1]} ·{' '}
                {activeQuarter.seaAccess ? 'accès maritime' : 'enclavé'}
              </p>

              <p className="mb-1 text-xs tracking-widest text-muted-foreground uppercase">
                Voisins directs
              </p>
              <p className="mb-4 font-mono text-sm">
                {activeQuarter.neighbors.join(' · ')}
              </p>

              <p className="mb-1 text-xs tracking-widest text-muted-foreground uppercase">
                Ressources
              </p>
              {activeInventory ? (
                <ul className="flex flex-col text-sm">
                  {activeInventory.map((entry) => (
                    <li
                      key={entry.resourceTypeId}
                      className="flex justify-between gap-4 border-b py-1"
                    >
                      <span className="truncate">{entry.resourceType}</span>
                      <span className="font-mono tabular-nums">
                        {entry.quantity}/{entry.initialQuantity}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {inventoryError || 'Chargement…'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Survolez un quartier pour afficher son niveau de crise, ses voisins
              et ses ressources.
            </p>
          )}
        </aside>
      </CardContent>
    </Card>
  )
}
