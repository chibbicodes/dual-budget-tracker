import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { format, addMonths, subMonths, startOfMonth, parseISO } from 'date-fns'
import {
  calculateBudgetSummary,
  getProjectedMonthlyIncome,
  getAllBuckets,
  formatCurrency,
} from '@dual-budget/shared'
import type { BudgetType, Category, MonthlyBudget } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useBudget } from '../../contexts/BudgetContext'
import { SummaryCard } from '../../components/SummaryCard'
import { BudgetRow } from '../../components/BudgetRow'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function BudgetScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const {
    appData,
    addMonthlyBudget,
    updateMonthlyBudget,
    getMonthlyBudget,
  } = useBudget()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(subMonths(prev, 1)))
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(addMonths(prev, 1)))
  }, [])

  const monthString = useMemo(() => format(selectedMonth, 'yyyy-MM'), [selectedMonth])

  const summary = useMemo(
    () =>
      calculateBudgetSummary(
        appData.transactions,
        appData.categories,
        budgetType,
        selectedMonth,
        appData.monthlyBudgets
      ),
    [appData.transactions, appData.categories, budgetType, selectedMonth, appData.monthlyBudgets]
  )

  const projectedIncome = useMemo(
    () =>
      getProjectedMonthlyIncome(
        appData.incomeSources,
        budgetType,
        selectedMonth
      ),
    [appData.incomeSources, budgetType, selectedMonth]
  )

  const totalBudgeted = useMemo(() => {
    return appData.categories
      .filter(
        (c) =>
          c.budgetType === budgetType &&
          c.isActive &&
          !c.isIncomeCategory &&
          !c.excludeFromBudget
      )
      .reduce((sum, cat) => {
        const override = appData.monthlyBudgets.find(
          (mb) => mb.month === monthString && mb.categoryId === cat.id
        )
        return sum + (override ? override.amount : cat.monthlyBudget)
      }, 0)
  }, [appData.categories, appData.monthlyBudgets, budgetType, monthString])

  const remainingInBudget = totalBudgeted - summary.totalExpenses

  // Suggested budget logic: 6-month historical average
  // Fixed categories: use previous month actual
  // Variable categories: use historical percentage of remaining income after fixed
  const suggestedBudgets = useMemo(() => {
    const suggestions = new Map<string, number>()
    const relevantCategories = appData.categories.filter(
      (c) =>
        c.budgetType === budgetType &&
        c.isActive &&
        !c.isIncomeCategory &&
        !c.excludeFromBudget
    )

    // Gather 6 months of historical data
    const historicalMonths: Date[] = []
    for (let i = 1; i <= 6; i++) {
      historicalMonths.push(startOfMonth(subMonths(selectedMonth, i)))
    }

    // Calculate historical spending per category
    const historicalByCategory = new Map<string, number[]>()
    const historicalTotalByMonth: number[] = []

    historicalMonths.forEach((histMonth) => {
      const histStart = startOfMonth(histMonth)
      const histEnd = new Date(histStart.getFullYear(), histStart.getMonth() + 1, 0, 23, 59, 59)
      let monthTotal = 0

      relevantCategories.forEach((cat) => {
        const catTransactions = appData.transactions.filter((t) => {
          const transDate = parseISO(t.date)
          return (
            t.budgetType === budgetType &&
            t.categoryId === cat.id &&
            t.amount < 0 &&
            transDate >= histStart &&
            transDate <= histEnd
          )
        })
        const spent = Math.abs(
          catTransactions.reduce((s, t) => s + t.amount, 0)
        )
        const existing = historicalByCategory.get(cat.id) || []
        existing.push(spent)
        historicalByCategory.set(cat.id, existing)
        monthTotal += spent
      })

      historicalTotalByMonth.push(monthTotal)
    })

    // Previous month data for fixed categories
    const prevMonth = startOfMonth(subMonths(selectedMonth, 1))
    const prevMonthStart = startOfMonth(prevMonth)
    const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0, 23, 59, 59)

    // Calculate fixed total first
    let fixedTotal = 0
    const fixedCategories = relevantCategories.filter((c) => c.isFixedExpense)
    fixedCategories.forEach((cat) => {
      const prevTransactions = appData.transactions.filter((t) => {
        const transDate = parseISO(t.date)
        return (
          t.budgetType === budgetType &&
          t.categoryId === cat.id &&
          t.amount < 0 &&
          transDate >= prevMonthStart &&
          transDate <= prevMonthEnd
        )
      })
      const prevActual = Math.abs(
        prevTransactions.reduce((s, t) => s + t.amount, 0)
      )
      suggestions.set(cat.id, prevActual)
      fixedTotal += prevActual
    })

    // Remaining income after fixed expenses
    const remainingAfterFixed = Math.max(0, projectedIncome - fixedTotal)

    // Historical total for variable categories only
    const variableCategories = relevantCategories.filter((c) => !c.isFixedExpense)
    const historicalVariableTotal =
      historicalTotalByMonth.length > 0
        ? historicalTotalByMonth.reduce((s, v) => s + v, 0) / historicalTotalByMonth.length
        : 0

    // Variable: use historical percentage of remaining income
    variableCategories.forEach((cat) => {
      const catHistory = historicalByCategory.get(cat.id) || []
      const nonZeroHistory = catHistory.filter((v) => v > 0)
      if (nonZeroHistory.length > 0 && historicalVariableTotal > 0) {
        const avgSpent =
          nonZeroHistory.reduce((s, v) => s + v, 0) / nonZeroHistory.length
        const historicalPct = avgSpent / historicalVariableTotal
        suggestions.set(cat.id, historicalPct * remainingAfterFixed)
      } else {
        suggestions.set(cat.id, 0)
      }
    })

    return suggestions
  }, [
    appData.categories,
    appData.transactions,
    budgetType,
    selectedMonth,
    projectedIncome,
  ])

  // Total suggested for percentage calculations
  const totalSuggested = useMemo(() => {
    let total = 0
    suggestedBudgets.forEach((v) => {
      total += v
    })
    return total
  }, [suggestedBudgets])

  // Total actual spent across all displayed categories
  const totalSpent = summary.totalExpenses

  // Buckets for current budget type
  const allBuckets = useMemo(() => getAllBuckets(), [])
  const buckets = budgetType === 'household' ? allBuckets.household : allBuckets.business

  // Build bucket data
  const bucketData = useMemo(() => {
    return buckets.map((bucket) => {
      const bucketCategories = appData.categories.filter(
        (c) =>
          c.budgetType === budgetType &&
          c.bucketId === bucket.id &&
          c.isActive &&
          !c.isIncomeCategory &&
          !c.excludeFromBudget
      )

      let bucketBudgeted = 0
      let bucketActual = 0

      const categoryData = bucketCategories.map((cat) => {
        const override = appData.monthlyBudgets.find(
          (mb) => mb.month === monthString && mb.categoryId === cat.id
        )
        const budgeted = override ? override.amount : cat.monthlyBudget

        const catTransactions = appData.transactions.filter((t) => {
          const transDate = parseISO(t.date)
          const mStart = startOfMonth(selectedMonth)
          const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0, 23, 59, 59)
          return (
            t.budgetType === budgetType &&
            t.categoryId === cat.id &&
            t.amount < 0 &&
            transDate >= mStart &&
            transDate <= mEnd
          )
        })
        const actual = Math.abs(
          catTransactions.reduce((s, t) => s + t.amount, 0)
        )

        bucketBudgeted += budgeted
        bucketActual += actual

        const suggested = suggestedBudgets.get(cat.id) || 0

        return {
          category: cat,
          budgeted,
          actual,
          suggested,
        }
      })

      return {
        bucket,
        categories: categoryData,
        bucketBudgeted,
        bucketActual,
      }
    })
  }, [
    buckets,
    appData.categories,
    appData.transactions,
    appData.monthlyBudgets,
    budgetType,
    selectedMonth,
    monthString,
    suggestedBudgets,
  ])

  const handleEditBudgeted = useCallback(
    (cat: Category) => {
      const existing = getMonthlyBudget(monthString, cat.id)
      const currentAmount = existing ? existing.amount : cat.monthlyBudget

      if (Platform.OS === 'ios') {
        Alert.prompt(
          `Edit Budget: ${cat.name}`,
          `Enter new monthly budget amount for ${format(selectedMonth, 'MMMM yyyy')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: (value?: string) => {
                const parsed = parseFloat(value || '0')
                if (isNaN(parsed) || parsed < 0) return
                if (existing) {
                  updateMonthlyBudget(existing.id, { amount: parsed })
                } else {
                  addMonthlyBudget({
                    month: monthString,
                    budgetType,
                    categoryId: cat.id,
                    amount: parsed,
                  })
                }
              },
            },
          ],
          'plain-text',
          String(currentAmount)
        )
      } else {
        // Android fallback: use a simple Alert with predefined choices
        Alert.alert(
          `Edit Budget: ${cat.name}`,
          `Current budget: ${formatCurrency(currentAmount)}\n\nTo edit budget amounts on Android, please use the category management screen.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Go to Categories',
              onPress: () => router.push('/category/manage'),
            },
          ]
        )
      }
    },
    [monthString, selectedMonth, budgetType, getMonthlyBudget, addMonthlyBudget, updateMonthlyBudget, router]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Budget Type Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[
              styles.toggleButton,
              budgetType === 'household' && {
                backgroundColor: colors.household,
              },
            ]}
            onPress={() => setBudgetType('household')}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    budgetType === 'household' ? '#ffffff' : colors.textSecondary,
                },
              ]}
            >
              Household
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              budgetType === 'business' && {
                backgroundColor: colors.business,
              },
            ]}
            onPress={() => setBudgetType('business')}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    budgetType === 'business' ? '#ffffff' : colors.textSecondary,
                },
              ]}
            >
              Business
            </Text>
          </Pressable>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <Pressable
            onPress={handlePreviousMonth}
            style={[styles.monthArrow, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.monthArrowText, { color: colors.primary }]}>
              {'<'}
            </Text>
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {format(selectedMonth, 'MMMM yyyy')}
          </Text>
          <Pressable
            onPress={handleNextMonth}
            style={[styles.monthArrow, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.monthArrowText, { color: colors.primary }]}>
              {'>'}
            </Text>
          </Pressable>
        </View>

        {/* Summary Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          <SummaryCard
            label="Expected Income"
            amount={projectedIncome}
            color={colors.primary}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Total Budgeted"
            amount={totalBudgeted}
            color={colors.purple}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Actual Income"
            amount={summary.totalIncome}
            color={colors.success}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Actual Spent"
            amount={summary.totalExpenses}
            color={colors.danger}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Remaining"
            amount={remainingInBudget}
            color={remainingInBudget >= 0 ? colors.success : colors.danger}
            compact
          />
        </ScrollView>

        {/* Bucket Sections */}
        {bucketData.map(({ bucket, categories: catData, bucketBudgeted, bucketActual }) => {
          if (catData.length === 0) return null
          const bucketRemaining = bucketBudgeted - bucketActual
          return (
            <View
              key={bucket.id}
              style={[styles.bucketSection, { backgroundColor: colors.surface }]}
            >
              {/* Bucket Header */}
              <View style={[styles.bucketHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bucketName, { color: colors.text }]}>
                  {bucket.name}
                </Text>
                <View style={styles.bucketSummary}>
                  <Text style={[styles.bucketStat, { color: colors.purple }]}>
                    Budgeted: {formatCurrency(bucketBudgeted)}
                  </Text>
                  <Text
                    style={[
                      styles.bucketStat,
                      {
                        color:
                          bucketRemaining >= 0 ? colors.success : colors.danger,
                      },
                    ]}
                  >
                    {formatCurrency(bucketActual)} / {formatCurrency(bucketBudgeted)}
                  </Text>
                </View>
              </View>

              {/* Category Rows */}
              {catData.map(({ category, budgeted, actual, suggested }) => (
                <BudgetRow
                  key={category.id}
                  name={category.name}
                  isFixed={category.isFixedExpense}
                  suggested={suggested}
                  budgeted={budgeted}
                  actual={actual}
                  totalSuggested={totalSuggested}
                  totalBudgeted={totalBudgeted}
                  totalSpent={totalSpent}
                  onPressBudgeted={() => handleEditBudgeted(category)}
                />
              ))}
            </View>
          )
        })}

        {/* Links */}
        <View style={styles.linksRow}>
          <Pressable
            style={[styles.linkButton, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/category/manage')}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Manage Categories
            </Text>
          </Pressable>
          <View style={styles.linkSpacer} />
          <Pressable
            style={[styles.linkButton, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/budget/archive')}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Budget Archive
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  monthArrow: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginHorizontal: Spacing.lg,
  },
  cardsRow: {
    paddingBottom: Spacing.md,
  },
  cardSpacer: {
    width: Spacing.sm,
  },
  bucketSection: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  bucketHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  bucketName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  bucketSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bucketStat: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  linksRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  linkSpacer: {
    width: Spacing.sm,
  },
  linkButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  linkText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
})
