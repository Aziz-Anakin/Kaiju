import { Calendar } from '@/components/calendar'
import { CityMap } from '@/components/city-map'

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold uppercase">Tableau de bord</h1>
      <CityMap />
      <div className="max-w-md">
        <Calendar compact />
      </div>
    </div>
  )
}
