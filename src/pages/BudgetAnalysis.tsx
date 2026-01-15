import { useBudget } from '../contexts/BudgetContext'

export default function BudgetAnalysis() {
  const { currentView } = useBudget()

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Budget Analysis</h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Budget analysis and projections for <span className="font-semibold">{currentView}</span> budget
        </p>
        <p className="text-sm text-gray-500 mt-2">Content coming soon...</p>
      </div>
    </div>
  )
}
