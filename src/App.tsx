import { Routes, Route } from 'react-router-dom'
import { BudgetProvider } from './contexts/BudgetContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import DueDates from './pages/DueDates'
import Budget from './pages/Budget'
import BudgetArchive from './pages/BudgetArchive'
import BudgetAnalysis from './pages/BudgetAnalysis'
import Transactions from './pages/Transactions'
import Income from './pages/Income'
import BusinessReports from './pages/BusinessReports'
import Settings from './pages/Settings'
import Welcome from './pages/Welcome'

function App() {
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
          <Route path="business-reports" element={<BusinessReports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="welcome" element={<Welcome />} />
        </Route>
      </Routes>
    </BudgetProvider>
  )
}

export default App
