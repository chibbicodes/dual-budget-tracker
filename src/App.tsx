import { Routes, Route } from 'react-router-dom'
import { BudgetProvider } from './contexts/BudgetContext'
import { ProfileProvider, useProfile } from './contexts/ProfileContext'
import Layout from './components/Layout'
import ProfileSelector from './components/ProfileSelector'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import DueDates from './pages/DueDates'
import Budget from './pages/Budget'
import BudgetArchive from './pages/BudgetArchive'
import BudgetAnalysis from './pages/BudgetAnalysis'
import Transactions from './pages/Transactions'
import Income from './pages/Income'
import Projects from './pages/Projects'
import BusinessReports from './pages/BusinessReports'
import Settings from './pages/Settings'
import Welcome from './pages/Welcome'

function AppContent() {
  const { activeProfile, isLoading } = useProfile()

  // Show loading state while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show profile selector if no active profile
  if (!activeProfile) {
    return <ProfileSelector />
  }

  // Show main app with active profile
  return (
    <BudgetProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="due-dates" element={<DueDates />} />
          <Route path="budget" element={<Budget />} />
          <Route path="budget-archive" element={<BudgetArchive />} />
          <Route path="budget-analysis" element={<BudgetAnalysis />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="income" element={<Income />} />
          <Route path="projects" element={<Projects />} />
          <Route path="business-reports" element={<BusinessReports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="welcome" element={<Welcome />} />
        </Route>
      </Routes>
    </BudgetProvider>
  )
}

function App() {
  return (
    <ProfileProvider>
      <AppContent />
    </ProfileProvider>
  )
}

export default App
