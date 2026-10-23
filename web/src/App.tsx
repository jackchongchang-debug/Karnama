import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectView from './pages/ProjectView'
import CalendarPage from './pages/CalendarPage'
import Notes from './pages/Notes'
import Templates from './pages/Templates'
import Settings from './pages/Settings'
import MyTasks from './pages/MyTasks'
import { useReminders } from './lib/reminders'

export default function App() {
  useReminders()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<MyTasks />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="notes" element={<Notes />} />
        <Route path="templates" element={<Templates />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
