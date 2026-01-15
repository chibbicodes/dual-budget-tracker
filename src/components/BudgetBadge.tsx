import type { BudgetType } from '../types'

interface BudgetBadgeProps {
  budgetType: BudgetType
  size?: 'sm' | 'md' | 'lg'
}

export default function BudgetBadge({ budgetType, size = 'sm' }: BudgetBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  const colorClasses =
    budgetType === 'household'
      ? 'bg-blue-100 text-blue-700 border-blue-300'
      : 'bg-green-100 text-green-700 border-green-300'

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${sizeClasses[size]} ${colorClasses}`}
    >
      {budgetType === 'household' ? 'Household' : 'Business'}
    </span>
  )
}
