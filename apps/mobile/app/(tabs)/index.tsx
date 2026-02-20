import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native'
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'
import {
  calculateBudgetSummary,
  getProjectedMonthlyIncome,
  getTopSpendingCategories,
  formatCurrency,
} from '@dual-budget/shared'
import type { BudgetType } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useBudget } from '../../contexts/BudgetContext'
import { SummaryCard } from '../../components/SummaryCard'
import { QuickAddFAB } from '../../components/QuickAddFAB'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function DashboardScreen() {
  const { colors } = useTheme()
  const { appData } = useBudget()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(subMonths(prev, 1)))
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(addMonths(prev, 1)))
  }, [])

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
    const monthString = format(selectedMonth, 'yyyy-MM')
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
  }, [appData.categories, appData.monthlyBudgets, budgetType, selectedMonth])

  const topCategories = useMemo(() => {
    const EXCLUDED_NAMES = ['transfer', 'transfer/payment']
    const filtered = getTopSpendingCategories(
      appData.transactions,
      appData.categories,
      budgetType,
      10
    ).filter((item) => {
      const name = item.category.name.toLowerCase()
      if (EXCLUDED_NAMES.includes(name)) return false
      if (name.includes('exclude from')) return false
      if (item.category.excludeFromBudget) return false
      return true
    })
    return filtered.slice(0, 5)
  }, [appData.transactions, appData.categories, budgetType])

  const remainingInBudget = totalBudgeted - summary.totalExpenses

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
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Total Budgeted"
            amount={totalBudgeted}
            color={colors.purple}
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Actual Income"
            amount={summary.totalIncome}
            color={colors.success}
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Actual Spent"
            amount={summary.totalExpenses}
            color={colors.danger}
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Remaining"
            amount={remainingInBudget}
            color={remainingInBudget >= 0 ? colors.success : colors.danger}
          />
        </ScrollView>

        {/* Accounts Overview */}
        {appData.accounts.filter((a) => a.budgetType === budgetType && !a.deletedAt).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Accounts
            </Text>
            {appData.accounts
              .filter((a) => a.budgetType === budgetType && !a.deletedAt)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((account, index, arr) => (
                <View
                  key={account.id}
                  style={[
                    styles.accountRow,
                    index < arr.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                >
                  <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text
                    style={[
                      styles.accountBalance,
                      { color: account.balance >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {formatCurrency(account.balance)}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {/* Top Spending Categories */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Spending Categories
          </Text>
          {topCategories.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No spending data for this month yet.
            </Text>
          ) : (
            topCategories.map((item, index) => (
              <View
                key={item.category.id}
                style={[
                  styles.spendingRow,
                  index < topCategories.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.spendingLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.rankText, { color: colors.primary }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.spendingInfo}>
                    <Text
                      style={[styles.spendingName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.category.name}
                    </Text>
                    <Text style={[styles.spendingCount, { color: colors.textSecondary }]}>
                      {item.transactionCount} transaction{item.transactionCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.spendingAmount, { color: colors.danger }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <QuickAddFAB />
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
  section: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  spendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  spendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rankText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  spendingInfo: {
    flex: 1,
  },
  spendingName: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  spendingCount: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  spendingAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
  },
  accountName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.md,
  },
  accountBalance: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
})
