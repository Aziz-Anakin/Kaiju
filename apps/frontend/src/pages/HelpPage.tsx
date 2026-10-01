import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LEVEL_COLORS } from '@/lib/levels'

const LEVELS = [
  { name: 'Watch', text: 'Situation calme, on observe.' },
  { name: 'Alert', text: 'Les réservations s’ouvrent.' },
  { name: 'Emergency', text: 'Les transferts entre quartiers voisins s’ouvrent.' },
  { name: 'Critical', text: 'Le LC peut organiser des transits, le CD peut réquisitionner.' },
  { name: 'Catastrophic', text: 'Toutes les actions sont ouvertes, la rétention peut être abaissée.' },
]

const ROLES = [
  {
    name: 'Quarter Coordinator (QC)',
    text: 'Gère le stock et les demandes de son propre quartier. C’est le rôle créé à l’inscription.',
  },
  {
    name: 'Logistics Coordinator (LC)',
    text: 'Organise des transferts entre quartiers quand la crise est assez haute.',
  },
  {
    name: 'City Director (CD)',
    text: 'Change les niveaux de crise, réquisitionne et abaisse la rétention.',
  },
  {
    name: 'Admin',
    text: 'A tous les droits du CD et gère les comptes.',
  },
]

// Qui peut faire quoi, du niveau 1 au niveau 5 (même matrice que le backend)
const ACTIONS: { label: string; roles: string[] }[] = [
  { label: 'Consulter', roles: ['QC LC CD', 'QC LC CD', 'QC LC CD', 'QC LC CD', 'QC LC CD'] },
  { label: 'Réserver', roles: ['—', 'QC', 'QC', 'QC', 'QC'] },
  { label: 'Transfert entre voisins', roles: ['—', '—', 'QC', 'QC LC', 'QC LC CD'] },
  { label: 'Transit par un tiers', roles: ['—', '—', '—', 'LC', 'LC CD'] },
  { label: 'Réquisition', roles: ['—', '—', '—', 'CD', 'CD'] },
  { label: 'Abaisser la rétention', roles: ['—', '—', '—', '—', 'CD'] },
]

const FAQ = [
  {
    question: 'On me dit que je n’ai pas le droit de faire une action',
    answer:
      'Deux choses peuvent la bloquer : ton rôle, ou le niveau de crise du quartier. Regarde le tableau ci-dessus : le message d’erreur t’indique le niveau à partir duquel l’action s’ouvre. Tu peux demander au City Director de faire évoluer le niveau, ou à un collègue qui a le bon rôle de faire l’action.',
  },
  {
    question: 'Mon transfert est refusé alors que le stock existe',
    answer:
      'Un quartier garde toujours une réserve (la rétention, 30 % de sa dotation de départ). Seules les unités au-dessus de cette réserve peuvent partir. Demande une quantité plus petite ou choisis un autre quartier.',
  },
  {
    question: 'On me dit que je dois demander à un voisin',
    answer:
      'Si un quartier voisin peut donner la quantité demandée, tu dois lui faire la demande à lui : un quartier non voisin ne peut être sollicité que si aucun voisin n’a assez de stock.',
  },
  {
    question: 'Je vois « Stock insuffisant »',
    answer:
      'Il ne reste pas assez d’unités dans le quartier. Le message indique combien il en reste : choisis une quantité plus petite ou une autre période.',
  },
  {
    question: 'Ma session a expiré',
    answer:
      'Clique sur « Déconnexion » en haut à droite, puis reconnecte-toi avec ton email et ton mot de passe.',
  },
]

export default function HelpPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-widest uppercase">Aide</h1>
        <p className="text-sm text-muted-foreground">
          Comprendre comment fonctionne KAIJU et pourquoi une action est parfois refusée
        </p>
      </div>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Le principe</CardTitle>
          <CardDescription>
            Tokyork est attaquée par des Kaiju. Chaque quartier a un stock de ressources
            critiques (personnel médical, véhicules, abris, générateurs…) et KAIJU sert à
            les répartir pendant la crise.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <strong>La carte</strong> montre les 5 quartiers, colorés selon leur niveau de
            crise. <strong>Les ressources</strong> donnent le stock de chaque quartier.
          </p>
          <p>
            <strong>Une réservation</strong> met de côté des ressources de ton quartier sur
            une période. <strong>Un transfert</strong> demande des ressources à un autre
            quartier : directement s’il est voisin, sinon en passant par un quartier de
            transit.
          </p>
          <p>
            Tout se met à jour en temps réel : quand quelqu’un agit, ton écran change sans
            que tu aies à recharger la page.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Les niveaux de crise</CardTitle>
          <CardDescription>
            Chaque quartier a un niveau de 1 à 5. Plus il monte, plus d’actions s’ouvrent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {LEVELS.map((level, index) => (
            <div key={level.name} className="flex items-center gap-3 text-sm">
              <Badge
                className="w-24 justify-center rounded-none text-white"
                style={{ backgroundColor: LEVEL_COLORS[index] }}
              >
                {index + 1} · {level.name}
              </Badge>
              <span>{level.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Qui peut faire quoi</CardTitle>
          <CardDescription>
            Un tiret veut dire que personne n’a le droit à ce niveau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                {LEVELS.map((_, index) => (
                  <TableHead key={index}>Niveau {index + 1}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTIONS.map((action) => (
                <TableRow key={action.label}>
                  <TableCell className="font-semibold">{action.label}</TableCell>
                  {action.roles.map((roles, index) => (
                    <TableCell key={index}>{roles}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            L’admin a toujours au moins les droits du CD.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Les rôles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {ROLES.map((role) => (
            <p key={role.name}>
              <strong>{role.name}</strong> : {role.text}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Les règles des transferts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <strong>Permission.</strong> Ton rôle et le niveau de crise doivent autoriser
            l’action. Un QC ne demande des ressources que pour son propre quartier.
          </p>
          <p>
            <strong>Voisinage.</strong> Entre deux quartiers voisins, le transfert est direct.
            Sinon il passe par un quartier de transit qui touche les deux. Si un voisin peut
            donner la quantité, c’est à lui qu’il faut demander. Xeno, au centre de la ville,
            passe en priorité : un transit qui la traverse attend qu’elle ait reçu ses propres
            ressources.
          </p>
          <p>
            <strong>Rétention.</strong> Chaque quartier garde au moins 30 % de sa dotation de
            départ et ne peut céder que le reste. Au niveau 5, le City Director peut abaisser
            cette réserve à 15 %.
          </p>
          <p>
            Un transfert doit être accepté par le QC du quartier qui donne (et celui du
            quartier de transit s’il y en a un), ou par le CD.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="tracking-widest uppercase">Questions fréquentes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {FAQ.map((item) => (
            <div key={item.question}>
              <p className="font-semibold">{item.question}</p>
              <p className="text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
