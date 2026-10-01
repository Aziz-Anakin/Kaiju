import { ResourceGrid } from '@/components/resource-grid'

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-widest uppercase">
          Ressources
        </h1>
        <p className="text-sm text-muted-foreground">
          Stock disponible par quartier · relevé toutes les 10 s
        </p>
      </div>
      <ResourceGrid />
    </div>
  )
}
