import { useBudget } from '../contexts/BudgetContext'
import { useMemo, useState } from 'react'
import {calculateBudgetSummary, formatCurrency } from '../utils/calculations'
import { getAllBuckets } from '../data/defaultCategories'
import { Edit, Check, X, AlertCircle, Plus, Trash2, Settings2, Archive, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, parseISO } from 'date-fns'
import { exportToCSV, exportToPDF } from '../utils/export'
import ExportButtons from '../components/ExportButtons'
import type { BudgetType, Category, BucketId } from '../types'
import Modal from '../components/Modal'
import { useNavigate } from 'react-router-dom'

export default function Budget() {
  const { currentView, appData, updateCategory, addCategory, deleteCategory, addMonthlyBudget, updateMonthlyBudget, getMonthlyBudget, updateSettings } = useBudget()
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBucketEditModalOpen, setIsBucketEditModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<{ id: string; name: string; percentage?: number } | null>(null)
  const [bucketEditForm, setBucketEditForm] = useState({ name: '', percentage: 0 })
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())
  const navigate = useNavigate()

  // Budget page doesn't support combined view
  if (currentView === 'combined') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-600 mt-2">
            Please select a specific budget (Household or Business) to view and manage budgets
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">
                Combined View Not Available
              </h3>
              <p className="text-yellow-700 mt-2">
                Budget planning must be done separately for Household and Business budgets.
                Use the budget selector above to switch to a specific budget.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const budgetType = currentView as BudgetType

  // Helper function to get customized bucket name and percentage
  const getBucketDisplayInfo = (bucketId: BucketId) => {
    const allBuckets = getAllBuckets()
    const bucket = (budgetType === 'household' ? allBuckets.household : allBuckets.business).find(
      (b) => b.id === bucketId
    )
    if (!bucket) return { name: bucketId, percentage: undefined }

    const customization = appData.settings.bucketCustomization
    if (!customization) return { name: bucket.name, percentage: bucket.targetPercentage }

    // Get customized name and percentage based on bucket ID
    let customName = bucket.name
    let customPercentage = bucket.targetPercentage

    if (budgetType === 'household') {
      if (bucketId === 'needs' && customization.householdNeedsName) {
        customName = customization.householdNeedsName
      }
      if (bucketId === 'wants' && customization.householdWantsName) {
        customName = customization.householdWantsName
      }
      if (bucketId === 'savings' && customization.householdSavingsName) {
        customName = customization.householdSavingsName
      }
      // For household, percentages are stored in householdTargets, not bucketCustomization
      if (bucketId === 'needs') customPercentage = appData.settings.householdTargets.needsPercentage
      if (bucketId === 'wants') customPercentage = appData.settings.householdTargets.wantsPercentage
      if (bucketId === 'savings') customPercentage = appData.settings.householdTargets.savingsPercentage
    } else {
      if (bucketId === 'travel_performance') {
        if (customization.businessTravelPerformanceName) customName = customization.businessTravelPerformanceName
        if (customization.businessTravelPerformancePercentage !== undefined) customPercentage = customization.businessTravelPerformancePercentage
      } else if (bucketId === 'craft_business') {
        if (customization.businessCraftBusinessName) customName = customization.businessCraftBusinessName
        if (customization.businessCraftBusinessPercentage !== undefined) customPercentage = customization.businessCraftBusinessPercentage
      } else if (bucketId === 'online_marketing') {
        if (customization.businessOnlineMarketingName) customName = customization.businessOnlineMarketingName
        if (customization.businessOnlineMarketingPercentage !== undefined) customPercentage = customization.businessOnlineMarketingPercentage
      } else if (bucketId === 'professional_services') {
        if (customization.businessProfessionalServicesName) customName = customization.businessProfessionalServicesName
        if (customization.businessProfessionalServicesPercentage !== undefined) customPercentage = customization.businessProfessionalServicesPercentage
      } else if (bucketId === 'administrative') {
        if (customization.businessAdministrativeName) customName = customization.businessAdministrativeName
        if (customization.businessAdministrativePercentage !== undefined) customPercentage = customization.businessAdministrativePercentage
      } else if (bucketId === 'personnel') {
        if (customization.businessPersonnelName) customName = customization.businessPersonnelName
        if (customization.businessPersonnelPercentage !== undefined) customPercentage = customization.businessPersonnelPercentage
      }
    }

    return { name: customName, percentage: customPercentage }
  }

  // Generate month options (3 months prior to 3 months future)
  const monthOptions = useMemo(() => {
    const options = []
    const currentDate = new Date()
    for (let i = -3; i <= 3; i++) {
      const monthDate = addMonths(currentDate, i)
      options.push({
        date: monthDate,
        label: format(monthDate, 'MMMM yyyy'),
        value: format(monthDate, 'yyyy-MM'),
      })
    }
    return options
  }, [])

  // Get month string for selected month (YYYY-MM format)
  const selectedMonthString = useMemo(
    () => format(selectedMonth, 'yyyy-MM'),
    [selectedMonth]
  )

  // Calculate budget summary for selected month
  const budgetSummary = useMemo(
    () => calculateBudgetSummary(appData.transactions, appData.categories, budgetType, selectedMonth, appData.monthlyBudgets),
    [appData.transactions, appData.categories, budgetType, selectedMonth, appData.monthlyBudgets]
  )

  // Calculate suggested budgets based on last 6 months of spending
  // Uses calculateBudgetSummary for each historical month — same function that
  // computes the budget page numbers — so the data is guaranteed to match.
  const suggestedBudgets = useMemo(() => {
    const suggestions = new Map<string, number>()
    const categories = appData.categories.filter(
      (c) => c.budgetType === budgetType && c.isActive && !c.isIncomeCategory && !c.excludeFromBudget
    )

    // Get budget summaries for each of the last 6 months (relative to selected month)
    const historicalSummaries: Array<{
      month: string
      totalIncome: number
      totalExpenses: number
      categoryActuals: Map<string, number>
    }> = []

    for (let i = 1; i <= 6; i++) {
      const monthDate = subMonths(startOfMonth(selectedMonth), i)
      const summary = calculateBudgetSummary(
        appData.transactions,
        appData.categories,
        budgetType,
        monthDate,
        appData.monthlyBudgets
      )

      const categoryActuals = new Map<string, number>()
      summary.bucketBreakdown.forEach((bucket) => {
        bucket.categories.forEach((cat) => {
          categoryActuals.set(cat.categoryId, cat.actual)
        })
      })

      historicalSummaries.push({
        month: format(monthDate, 'yyyy-MM'),
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        categoryActuals,
      })
    }

    // ===== DIAGNOSTIC: Trace the data pipeline =====
    console.group('🔍 SUGGESTED BUDGET DIAGNOSTIC')

    // Show what calculateBudgetSummary returns for each historical month
    console.log('Selected month:', format(selectedMonth, 'yyyy-MM'))
    console.log('Budget type:', budgetType)
    console.log('Total transactions in appData:', appData.transactions.length)
    console.log('Categories being evaluated:', categories.length)

    // Pick a sample variable category to trace
    const sampleVariable = categories.find((c) => !c.isFixedExpense)
    const sampleFixed = categories.find((c) => c.isFixedExpense)
    if (sampleVariable) console.log('Sample VARIABLE category:', sampleVariable.name, '| id:', sampleVariable.id, '| bucket:', sampleVariable.bucketId, '| isFixedExpense:', sampleVariable.isFixedExpense)
    if (sampleFixed) console.log('Sample FIXED category:', sampleFixed.name, '| id:', sampleFixed.id, '| bucket:', sampleFixed.bucketId, '| isFixedExpense:', sampleFixed.isFixedExpense)

    // Show raw historical data for each month
    historicalSummaries.forEach((s) => {
      console.group(`Month: ${s.month}`)
      console.log('totalIncome:', s.totalIncome, '| totalExpenses:', s.totalExpenses)
      if (sampleVariable) {
        console.log(`  ${sampleVariable.name} actual:`, s.categoryActuals.get(sampleVariable.id) ?? 'NOT IN MAP')
      }
      if (sampleFixed) {
        console.log(`  ${sampleFixed.name} actual:`, s.categoryActuals.get(sampleFixed.id) ?? 'NOT IN MAP')
      }
      // Show all non-zero category actuals
      const nonZero: string[] = []
      s.categoryActuals.forEach((val, key) => {
        if (val > 0) {
          const cat = appData.categories.find((c) => c.id === key)
          nonZero.push(`${cat?.name || key}: $${val.toFixed(2)}`)
        }
      })
      console.log('  Non-zero actuals:', nonZero.length > 0 ? nonZero.join(', ') : 'NONE')
      console.groupEnd()
    })

    // Also check: what does the CURRENT month's budget summary show?
    console.log('Current month budgetSummary.totalIncome:', budgetSummary.totalIncome)
    console.log('Current month budgetSummary.totalExpenses:', budgetSummary.totalExpenses)

    // Check raw transactions: are expenses negative or positive?
    const sampleExpenseTransactions = appData.transactions
      .filter((t) => t.budgetType === budgetType)
      .slice(0, 10)
    console.log('Sample transactions (first 10):')
    sampleExpenseTransactions.forEach((t) => {
      const cat = appData.categories.find((c) => c.id === t.categoryId)
      console.log(`  ${t.date} | ${t.description?.substring(0, 30)} | amount: ${t.amount} | category: ${cat?.name} | isIncome: ${cat?.isIncomeCategory}`)
    })

    console.groupEnd()
    // ===== END DIAGNOSTIC =====

    // Projected income: current month's actual income, or average of historical income
    const monthsWithIncome = historicalSummaries.filter((s) => s.totalIncome > 0)
    const avgIncome =
      monthsWithIncome.length > 0
        ? monthsWithIncome.reduce((sum, s) => sum + s.totalIncome, 0) / monthsWithIncome.length
        : 0
    const projectedIncome = budgetSummary.totalIncome > 0 ? budgetSummary.totalIncome : avgIncome

    // ===== DIAGNOSTIC: Income pipeline =====
    console.group('🔍 INCOME & SPENDING PIPELINE')
    console.log('avgIncome:', avgIncome)
    console.log('budgetSummary.totalIncome (current month):', budgetSummary.totalIncome)
    console.log('projectedIncome:', projectedIncome)
    if (projectedIncome <= 0) console.log('⚠️ EARLY RETURN: projectedIncome <= 0')
    console.groupEnd()
    // ===== END DIAGNOSTIC =====

    if (projectedIncome <= 0) {
      return suggestions
    }

    // Step 1: Category average spending (excluding months with $0 in that category)
    const categoryAvgs = new Map<string, number>()
    categories.forEach((category) => {
      let totalSpent = 0
      let monthsCount = 0
      historicalSummaries.forEach((s) => {
        const spent = s.categoryActuals.get(category.id) || 0
        if (spent > 0) {
          totalSpent += spent
          monthsCount++
        }
      })
      categoryAvgs.set(category.id, monthsCount > 0 ? totalSpent / monthsCount : 0)
    })

    // Step 2: Average total monthly spending
    const monthsWithSpending = historicalSummaries.filter((s) => s.totalExpenses > 0)
    const avgTotalMonthlySpending =
      monthsWithSpending.length > 0
        ? monthsWithSpending.reduce((sum, s) => sum + s.totalExpenses, 0) / monthsWithSpending.length
        : 0

    // Step 3: Historical percentage of spending for each variable category
    const categoryHistPct = new Map<string, number>()
    if (avgTotalMonthlySpending > 0) {
      categories.forEach((category) => {
        if (!category.isFixedExpense) {
          const avg = categoryAvgs.get(category.id) || 0
          categoryHistPct.set(category.id, avg / avgTotalMonthlySpending)
        }
      })
    }

    // ===== DIAGNOSTIC: Steps 1-3 =====
    console.group('🔍 STEPS 1-3: Averages & Percentages')
    if (sampleVariable) {
      console.log(`Step 1 - ${sampleVariable.name} categoryAvg:`, categoryAvgs.get(sampleVariable.id))
    }
    if (sampleFixed) {
      console.log(`Step 1 - ${sampleFixed.name} categoryAvg:`, categoryAvgs.get(sampleFixed.id))
    }
    console.log('Step 2 - avgTotalMonthlySpending:', avgTotalMonthlySpending)
    console.log('Step 2 - monthsWithSpending count:', monthsWithSpending.length)
    if (sampleVariable) {
      console.log(`Step 3 - ${sampleVariable.name} histPct:`, categoryHistPct.get(sampleVariable.id) ?? 'NOT SET (avgTotalMonthlySpending was 0)')
    }
    console.groupEnd()
    // ===== END DIAGNOSTIC =====

    // Fixed expenses: suggested = historical average, or fall back to budgeted amount
    // Also accumulate fixed totals per bucket for step 5
    const fixedTotalsByBucket = new Map<string, number>()

    categories.forEach((category) => {
      if (category.isFixedExpense) {
        const histAvg = categoryAvgs.get(category.id) || 0
        const monthlyBudget = getMonthlyBudget(selectedMonthString, category.id)
        const budgetedAmount = monthlyBudget?.amount ?? category.monthlyBudget
        const suggested = histAvg > 0 ? histAvg : budgetedAmount
        suggestions.set(category.id, Math.round(suggested * 100) / 100)

        const existing = fixedTotalsByBucket.get(category.bucketId) || 0
        fixedTotalsByBucket.set(category.bucketId, existing + suggested)
      }
    })

    // ===== DIAGNOSTIC: Fixed expenses =====
    console.group('🔍 FIXED EXPENSES per bucket')
    fixedTotalsByBucket.forEach((total, bucketId) => {
      console.log(`  Bucket "${bucketId}": fixedTotal = $${total.toFixed(2)}`)
    })
    if (sampleFixed) {
      const histAvg = categoryAvgs.get(sampleFixed.id) || 0
      const mb = getMonthlyBudget(selectedMonthString, sampleFixed.id)
      const budgetedAmount = mb?.amount ?? sampleFixed.monthlyBudget
      console.log(`  ${sampleFixed.name}: histAvg=${histAvg}, budgetedAmount=${budgetedAmount}, suggested=${histAvg > 0 ? histAvg : budgetedAmount}`)
    }
    console.groupEnd()
    // ===== END DIAGNOSTIC =====

    // Steps 4-6: For each bucket, allocate remaining amount to variable categories
    const bucketIds = new Set(categories.map((c) => c.bucketId))

    bucketIds.forEach((bucketId) => {
      const bucketInfo = getBucketDisplayInfo(bucketId)
      const bucketPct = (bucketInfo.percentage || 0) / 100

      // Step 4: Bucket amount = projected income × bucket percentage
      const bucketAmount = projectedIncome * bucketPct

      // Step 5: Remaining = bucket amount - fixed expenses in this bucket
      const fixedInBucket = fixedTotalsByBucket.get(bucketId) || 0
      const remainingForVariable = Math.max(bucketAmount - fixedInBucket, 0)

      const variableInBucket = categories.filter(
        (c) => c.bucketId === bucketId && !c.isFixedExpense
      )

      // ===== DIAGNOSTIC: Bucket allocation =====
      console.group(`🔍 BUCKET "${bucketId}" allocation`)
      console.log(`  bucketPct: ${bucketPct * 100}%`)
      console.log(`  bucketAmount: $${bucketAmount.toFixed(2)} (projectedIncome $${projectedIncome.toFixed(2)} × ${bucketPct * 100}%)`)
      console.log(`  fixedInBucket: $${fixedInBucket.toFixed(2)}`)
      console.log(`  remainingForVariable: $${remainingForVariable.toFixed(2)}`)
      console.log(`  variableInBucket count: ${variableInBucket.length}`)
      if (remainingForVariable <= 0) console.log(`  ⚠️ REMAINING <= 0: Variable categories in this bucket will get $0`)
      console.groupEnd()
      // ===== END DIAGNOSTIC =====

      if (variableInBucket.length === 0 || remainingForVariable <= 0) return

      // Step 6: Proportional allocation based on historical spending share
      const totalHistPctInBucket = variableInBucket.reduce(
        (sum, c) => sum + (categoryHistPct.get(c.id) || 0), 0
      )

      if (totalHistPctInBucket > 0) {
        variableInBucket.forEach((category) => {
          const histPct = categoryHistPct.get(category.id) || 0
          const proportionalShare = histPct / totalHistPctInBucket
          const suggested = proportionalShare * remainingForVariable
          suggestions.set(category.id, Math.round(suggested * 100) / 100)
        })
      } else {
        // No historical spending data — fall back to budgeted amounts or equal split
        const fallbackSuggestions = new Map<string, number>()
        let totalFallback = 0
        variableInBucket.forEach((category) => {
          const mb = getMonthlyBudget(selectedMonthString, category.id)
          const amount = mb?.amount ?? category.monthlyBudget
          fallbackSuggestions.set(category.id, amount)
          totalFallback += amount
        })

        if (totalFallback > 0 && totalFallback > remainingForVariable) {
          variableInBucket.forEach((category) => {
            const raw = fallbackSuggestions.get(category.id) || 0
            const normalized = (raw / totalFallback) * remainingForVariable
            suggestions.set(category.id, Math.round(normalized * 100) / 100)
          })
        } else if (totalFallback > 0) {
          variableInBucket.forEach((category) => {
            const raw = fallbackSuggestions.get(category.id) || 0
            suggestions.set(category.id, Math.round(raw * 100) / 100)
          })
        } else {
          const equalShare = remainingForVariable / variableInBucket.length
          variableInBucket.forEach((category) => {
            suggestions.set(category.id, Math.round(equalShare * 100) / 100)
          })
        }
      }
    })

    return suggestions
  }, [appData.transactions, appData.categories, budgetType, selectedMonth, selectedMonthString, budgetSummary.totalIncome, getMonthlyBudget, appData.settings.bucketCustomization, appData.settings.householdTargets, appData.monthlyBudgets])

  // Get buckets for this budget type
  const buckets = useMemo(() => {
    const allBuckets = getAllBuckets()
    return budgetType === 'household' ? allBuckets.household : allBuckets.business
  }, [budgetType])

  // Filter buckets to show based on view
  // Household: only needs, wants, savings
  // Business: all 6 business expense buckets
  const visibleBucketIds = useMemo<BucketId[]>(() => {
    if (budgetType === 'household') {
      return ['needs', 'wants', 'savings']
    } else {
      return ['travel_performance', 'craft_business', 'online_marketing', 'professional_services', 'administrative', 'personnel']
    }
  }, [budgetType])

  // Calculate total budgeted amount for selected month
  const totalBudgeted = useMemo(() => {
    return appData.categories
      .filter((c) => c.budgetType === budgetType && c.isActive && !c.isIncomeCategory && !c.excludeFromBudget)
      .reduce((sum, c) => {
        const monthlyBudget = getMonthlyBudget(selectedMonthString, c.id)
        return sum + (monthlyBudget?.amount ?? c.monthlyBudget)
      }, 0)
  }, [appData.categories, budgetType, selectedMonthString, getMonthlyBudget])

  const handleStartEdit = (categoryId: string, currentBudget: number) => {
    setEditingCategory(categoryId)
    setEditValue(currentBudget.toString())
  }

  const handleSaveEdit = (categoryId: string) => {
    const newBudget = parseFloat(editValue)
    if (!isNaN(newBudget) && newBudget >= 0) {
      // Check if a monthly budget already exists
      const existingMonthlyBudget = getMonthlyBudget(selectedMonthString, categoryId)

      if (existingMonthlyBudget) {
        // Update existing monthly budget
        updateMonthlyBudget(existingMonthlyBudget.id, { amount: newBudget })
      } else {
        // Create new monthly budget
        addMonthlyBudget({
          month: selectedMonthString,
          budgetType,
          categoryId,
          amount: newBudget,
        })
      }
    }
    setEditingCategory(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditValue('')
  }

  const handleOpenEditModal = (category: Category) => {
    setSelectedCategory(category)
    setIsEditModalOpen(true)
  }

  const handleDeleteCategory = (categoryId: string) => {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      deleteCategory(categoryId)
    }
  }

  const handleOpenBucketEdit = (bucketId: BucketId) => {
    const { name, percentage } = getBucketDisplayInfo(bucketId)
    setSelectedBucket({ id: bucketId, name, percentage })
    setBucketEditForm({ name, percentage: percentage || 0 })
    setIsBucketEditModalOpen(true)
  }

  const handleSaveBucketEdit = () => {
    if (!selectedBucket || !bucketEditForm.name.trim()) {
      alert('Please enter a bucket name')
      return
    }

    const bucketId = selectedBucket.id
    const updates: any = {}

    if (budgetType === 'household') {
      // For household, update both name and percentage
      updates.bucketCustomization = { ...appData.settings.bucketCustomization }
      updates.householdTargets = { ...appData.settings.householdTargets }

      if (bucketId === 'needs') {
        updates.bucketCustomization.householdNeedsName = bucketEditForm.name
        updates.householdTargets.needsPercentage = bucketEditForm.percentage
      } else if (bucketId === 'wants') {
        updates.bucketCustomization.householdWantsName = bucketEditForm.name
        updates.householdTargets.wantsPercentage = bucketEditForm.percentage
      } else if (bucketId === 'savings') {
        updates.bucketCustomization.householdSavingsName = bucketEditForm.name
        updates.householdTargets.savingsPercentage = bucketEditForm.percentage
      }
    } else {
      // For business, update name and percentage in bucketCustomization
      updates.bucketCustomization = { ...appData.settings.bucketCustomization }

      if (bucketId === 'travel_performance') {
        updates.bucketCustomization.businessTravelPerformanceName = bucketEditForm.name
        updates.bucketCustomization.businessTravelPerformancePercentage = bucketEditForm.percentage
      } else if (bucketId === 'craft_business') {
        updates.bucketCustomization.businessCraftBusinessName = bucketEditForm.name
        updates.bucketCustomization.businessCraftBusinessPercentage = bucketEditForm.percentage
      } else if (bucketId === 'online_marketing') {
        updates.bucketCustomization.businessOnlineMarketingName = bucketEditForm.name
        updates.bucketCustomization.businessOnlineMarketingPercentage = bucketEditForm.percentage
      } else if (bucketId === 'professional_services') {
        updates.bucketCustomization.businessProfessionalServicesName = bucketEditForm.name
        updates.bucketCustomization.businessProfessionalServicesPercentage = bucketEditForm.percentage
      } else if (bucketId === 'administrative') {
        updates.bucketCustomization.businessAdministrativeName = bucketEditForm.name
        updates.bucketCustomization.businessAdministrativePercentage = bucketEditForm.percentage
      } else if (bucketId === 'personnel') {
        updates.bucketCustomization.businessPersonnelName = bucketEditForm.name
        updates.bucketCustomization.businessPersonnelPercentage = bucketEditForm.percentage
      }
    }

    updateSettings(updates)
    setIsBucketEditModalOpen(false)
    setSelectedBucket(null)
    setBucketEditForm({ name: '', percentage: 0 })
  }

  // Export handlers
  const handleExportCSV = () => {
    // Flatten bucket breakdown into category details for export
    const exportData: any[] = []
    budgetSummary.bucketBreakdown.forEach(bucket => {
      bucket.categories.forEach(categoryBreakdown => {
        const category = appData.categories.find(c => c.id === categoryBreakdown.categoryId)
        if (category) {
          exportData.push({
            Category: category.name,
            Bucket: bucket.bucketName,
            'Budget Amount': categoryBreakdown.budgeted,
            'Spent Amount': categoryBreakdown.actual,
            'Remaining': categoryBreakdown.overUnder,
            'Percent Used': `${categoryBreakdown.percentUsed.toFixed(1)}%`,
            Status: categoryBreakdown.percentUsed > 100.9 ? 'Over Budget' : categoryBreakdown.percentUsed >= 99 ? 'On Budget' : categoryBreakdown.percentUsed >= 90 ? 'Near Limit' : 'On Track'
          })
        }
      })
    })

    const filename = `budget-${budgetType}-${selectedMonthString}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    // Flatten bucket breakdown into category details for export
    const exportData: any[] = []
    budgetSummary.bucketBreakdown.forEach(bucket => {
      bucket.categories.forEach(categoryBreakdown => {
        const category = appData.categories.find(c => c.id === categoryBreakdown.categoryId)
        if (category) {
          exportData.push({
            category: category.name,
            bucket: bucket.bucketName,
            budgeted: formatCurrency(categoryBreakdown.budgeted),
            spent: formatCurrency(categoryBreakdown.actual),
            remaining: formatCurrency(categoryBreakdown.overUnder),
            percentUsed: `${categoryBreakdown.percentUsed.toFixed(1)}%`
          })
        }
      })
    })

    const filename = `budget-${budgetType}-${selectedMonthString}`
    const title = `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget - ${format(selectedMonth, 'MMMM yyyy')}`

    exportToPDF(
      exportData,
      filename,
      title,
      ['Category', 'Bucket', 'Budgeted', 'Spent', 'Remaining', '% Used'],
      ['category', 'bucket', 'budgeted', 'spent', 'remaining', 'percentUsed']
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {budgetType === 'household' ? 'Household' : 'Business'} Budget
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your monthly budget by category
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={budgetSummary.bucketBreakdown.every(b => b.categories.length === 0)}
          />
          <button
            onClick={() => navigate('/budget-archive')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Archive className="h-5 w-5" />
            View Archive
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Category
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Budget Month:</label>
            <select
              value={selectedMonthString}
              onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Income</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(budgetSummary.totalIncome)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Budgeted</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCurrency(totalBudgeted)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Actual Spent</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(budgetSummary.totalExpenses)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Remaining</p>
          <p
            className={`text-2xl font-bold mt-2 ${
              budgetSummary.remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(budgetSummary.remainingBudget)}
          </p>
        </div>
      </div>

      {/* Bucket Breakdown */}
      {budgetSummary.bucketBreakdown
        .filter((bucket) => visibleBucketIds.includes(bucket.bucketId))
        .map((bucket) => {
        const categoriesInBucket = appData.categories.filter(
          (c) => c.budgetType === budgetType && c.bucketId === bucket.bucketId && !c.isIncomeCategory && !c.excludeFromBudget
        )

        const bucketDisplayInfo = getBucketDisplayInfo(bucket.bucketId)

        return (
          <div key={bucket.bucketId} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Bucket Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{bucketDisplayInfo.name}</h2>
                    <button
                      onClick={() => handleOpenBucketEdit(bucket.bucketId)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit bucket"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Budgeted: {formatCurrency(bucket.totalBudgeted)} • {bucket.percentOfIncome.toFixed(1)}% of income
                    {bucketDisplayInfo.percentage !== undefined && (
                      <span className="text-gray-500"> (Target: {bucketDisplayInfo.percentage}%)</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">
                    {formatCurrency(bucket.actualAmount)} spent
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      bucket.overUnder >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {bucket.overUnder >= 0 ? 'Under' : 'Over'} by {formatCurrency(Math.abs(bucket.overUnder))}
                  </p>
                </div>
              </div>

              {/* Bucket Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{bucket.percentOfIncome.toFixed(1)}% of income</span>
                  <span>
                    {bucket.totalBudgeted > 0
                      ? ((bucket.actualAmount / bucket.totalBudgeted) * 100).toFixed(1)
                      : 0}
                    % of budget
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      bucket.actualAmount > bucket.totalBudgeted
                        ? 'bg-red-500'
                        : budgetType === 'household'
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (bucket.actualAmount / bucket.totalBudgeted) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Category List */}
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Category
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Suggested
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Budgeted
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Spent
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Remaining
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Progress
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoriesInBucket.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No active categories in this bucket
                      </td>
                    </tr>
                  ) : (
                    categoriesInBucket.map((category) => {
                      const categoryBreakdown = bucket.categories.find(
                        (c) => c.categoryId === category.id
                      )

                      // Get budget amount for this month (use monthly budget if exists, otherwise default)
                      const monthlyBudget = getMonthlyBudget(selectedMonthString, category.id)
                      const budgeted = monthlyBudget?.amount ?? category.monthlyBudget
                      const suggested = suggestedBudgets.get(category.id) || 0
                      const actual = categoryBreakdown?.actual || 0
                      const remaining = budgeted - actual
                      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0

                      return (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="py-4">
                            <div className="flex items-center">
                              <div>
                                <p className="font-medium text-gray-900">{category.name}</p>
                                {category.isFixedExpense && (
                                  <span className="text-xs text-blue-600">Fixed</span>
                                )}
                                {category.taxDeductibleByDefault && (
                                  <span className="text-xs text-green-600 ml-2">Tax Deductible</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <p className="text-sm text-purple-600 font-medium">
                              {formatCurrency(suggested)}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            {editingCategory === category.id ? (
                              <div className="flex items-center justify-end">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveEdit(category.id)
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit()
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(budgeted)}
                              </p>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <p className="text-sm text-red-600">
                              {formatCurrency(actual)}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            <p
                              className={`text-sm font-medium ${
                                remaining >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(remaining)}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    percentUsed > 100.9
                                      ? 'bg-red-500'
                                      : percentUsed >= 99
                                      ? 'bg-green-500'
                                      : percentUsed >= 90
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(percentUsed, 100)}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`text-xs font-medium ${
                                  percentUsed > 100.9
                                    ? 'text-red-600'
                                    : percentUsed >= 99
                                    ? 'text-green-600'
                                    : percentUsed >= 90
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {percentUsed.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            {editingCategory === category.id ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleSaveEdit(category.id)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Save"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-red-600 hover:text-red-800"
                                  title="Cancel"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() =>
                                    handleStartEdit(category.id, category.monthlyBudget)
                                  }
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Quick edit budget amount"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(category)}
                                  className="text-gray-600 hover:text-gray-800"
                                  title="Edit category details"
                                >
                                  <Settings2 className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete category"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click the <Edit className="inline h-4 w-4" /> icon for quick budget edits,
          <Settings2 className="inline h-4 w-4 mx-1" /> icon to edit full category details, or the
          <Trash2 className="inline h-4 w-4 mx-1" /> icon to delete categories.
        </p>
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Category"
      >
        <CategoryForm
          budgetType={budgetType}
          buckets={buckets}
          onSubmit={(data) => {
            addCategory(data)
            setIsAddModalOpen(false)
          }}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedCategory(null)
        }}
        title="Edit Category"
      >
        {selectedCategory && (
          <CategoryForm
            budgetType={budgetType}
            buckets={buckets}
            category={selectedCategory}
            onSubmit={(data) => {
              updateCategory(selectedCategory.id, data)
              setIsEditModalOpen(false)
              setSelectedCategory(null)
            }}
            onCancel={() => {
              setIsEditModalOpen(false)
              setSelectedCategory(null)
            }}
          />
        )}
      </Modal>

      {/* Edit Bucket Modal */}
      <Modal
        isOpen={isBucketEditModalOpen}
        onClose={() => {
          setIsBucketEditModalOpen(false)
          setSelectedBucket(null)
          setBucketEditForm({ name: '', percentage: 0 })
        }}
        title="Edit Bucket"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveBucketEdit(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bucket Name
            </label>
            <input
              type="text"
              value={bucketEditForm.name}
              onChange={(e) => setBucketEditForm({ ...bucketEditForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Essential Needs, Fun Money"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Percentage of Income
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={bucketEditForm.percentage}
                onChange={(e) => setBucketEditForm({ ...bucketEditForm, percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50"
                min="0"
                max="100"
                step="0.1"
                required
              />
              <span className="text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: {budgetType === 'household' ? 'Needs 50%, Wants 30%, Savings 20%' : 'Distribute based on your business model'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsBucketEditModalOpen(false)
                setSelectedBucket(null)
                setBucketEditForm({ name: '', percentage: 0 })
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Category Form Component
interface CategoryFormProps {
  budgetType: BudgetType
  buckets: Array<{ id: BucketId; name: string }>
  category?: Category
  onSubmit: (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function CategoryForm({ budgetType, buckets, category, onSubmit, onCancel }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    bucketId: category?.bucketId || buckets[0]?.id || '',
    monthlyBudget: category?.monthlyBudget?.toString() || '0',
    isFixedExpense: category?.isFixedExpense || false,
    taxDeductibleByDefault: category?.taxDeductibleByDefault || false,
    isActive: category?.isActive ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: formData.name,
      budgetType,
      bucketId: formData.bucketId as BucketId,
      monthlyBudget: parseFloat(formData.monthlyBudget) || 0,
      isFixedExpense: formData.isFixedExpense,
      isActive: formData.isActive,
      taxDeductibleByDefault: formData.taxDeductibleByDefault,
      icon: '',
      autoCategorization: category?.autoCategorization || [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Groceries, Office Supplies"
          required
        />
      </div>

      {/* Bucket Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bucket *
        </label>
        <select
          value={formData.bucketId}
          onChange={(e) => setFormData({ ...formData, bucketId: e.target.value as BucketId })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.name}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monthly Budget *
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.monthlyBudget}
          onChange={(e) => setFormData({ ...formData, monthlyBudget: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          required
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isFixedExpense}
            onChange={(e) => setFormData({ ...formData, isFixedExpense: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Fixed Expense (amount doesn't vary month to month)
          </span>
        </label>

        {budgetType === 'business' && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.taxDeductibleByDefault}
              onChange={(e) =>
                setFormData({ ...formData, taxDeductibleByDefault: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Tax Deductible by Default
            </span>
          </label>
        )}

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Active (show in budget and transaction forms)
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {category ? 'Save Changes' : 'Add Category'}
        </button>
      </div>
    </form>
  )
}
