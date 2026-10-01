import { Calendar } from '@/components/calendar'

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold uppercase">Calendrier</h1>
      <Calendar />
    </div>
  )
}
