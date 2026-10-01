import { levelColor } from '@/lib/levels'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { request } from '@/lib/api'
import { socket } from '@/services/socket'

type QuarterLevel = {
  quarter: string
  level: number
  name: string
}

export function DisasterControls() {
  const [quarters, setQuarters] = useState<QuarterLevel[]>([])
  const [error, setError] = useState('')

  // Charge le niveau actuel de chaque quartier au chargement de la page
  useEffect(() => {
    request<QuarterLevel[]>('/disasters')
      .then(setQuarters)
      .catch((e) => setError(e.message))
  }, [])

  // Met à jour le quartier dès qu'un niveau change, même depuis un autre navigateur
  useEffect(() => {
    const update = (data: QuarterLevel) =>
      setQuarters((current) =>
        current.map((q) => (q.quarter === data.quarter ? data : q)),
      )

    socket.on('disaster-level-changed', update)
    return () => {
      socket.off('disaster-level-changed', update)
    }
  }, [])

  // Envoie le nouveau niveau avec le token du CD puis met à jour le quartier affiché
  async function changeLevel(quarter: string, level: number) {
    let data: QuarterLevel
    try {
      data = await request<QuarterLevel>(`/disasters/${quarter}`, 'PATCH', {
        level,
      })
    } catch (e) {
      setError((e as Error).message)
      return
    }

    setError('')
    setQuarters((current) =>
      current.map((q) => (q.quarter === quarter ? data : q)),
    )
  }

  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="tracking-widest uppercase">
          Niveaux de crise
        </CardTitle>
        <CardDescription>
          Déclenche directement le niveau de crise de chaque quartier
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {quarters.map((q) => (
          <div
            key={q.quarter}
            className="flex flex-wrap items-center gap-3 border p-3"
          >
            <span className="w-8 text-lg font-bold">{q.quarter}</span>
            <Badge
              className="w-32 rounded-none text-white"
              style={{ backgroundColor: levelColor(q.level) }}
            >
              L{q.level} {q.name}
            </Badge>
            <div className="ml-auto flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={level === q.level ? 'default' : 'outline'}
                  className="rounded-none"
                  disabled={level === q.level}
                  onClick={() => changeLevel(q.quarter, level)}
                >
                  L{level}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
