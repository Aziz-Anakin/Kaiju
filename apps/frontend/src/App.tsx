import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import CalendarPage from '@/pages/CalendarPage'
import DashboardPage from '@/pages/DashboardPage'
import DisastersPage from '@/pages/DisastersPage'
import HelpPage from '@/pages/HelpPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ReservationsPage from '@/pages/ReservationsPage'
import ResourcesPage from '@/pages/ResourcesPage'
import TransfersPage from '@/pages/TransfersPage'
import UsersPage from '@/pages/UsersPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/disasters" element={<DisastersPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
    </Routes>
  )
}

export default App
