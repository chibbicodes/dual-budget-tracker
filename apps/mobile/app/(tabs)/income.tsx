import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns'
import {
  getProjectedMonthlyIncome,
  getExpectedAmountForMonth,
  incomeSourceToLegacy,
  formatCurrency,
} from '@dual-budget/shared'
import type {
  BudgetType,
  IncomeSource,
  IncomeFrequency,
  HouseholdIncomeType,
  BusinessIncomeType,
} from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useBudget } from '../../contexts/BudgetContext'
import { SummaryCard } from '../../components/SummaryCard'
import { EmptyState } from '../../components/EmptyState'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  irregular: 'Irregular',
}

const HOUSEHOLD_TYPE_LABELS: Record<HouseholdIncomeType, string> = {
  salary: 'Employment',
  freelance: 'Freelance',
  investment: 'Investment',
  other: 'Other',
}

const BUSINESS_TYPE_LABELS: Record<BusinessIncomeType, string> = {
  client_revenue: 'Client Revenue',
  product_sales: 'Product Sales',
  services: 'Services',
  other: 'Other',
}

function getIncomeTypeLabel(
  incomeType: string,
  budgetType: BudgetType
): string {
  if (budgetType === 'household') {
    return HOUSEHOLD_TYPE_LABELS[incomeType as HouseholdIncomeType] || incomeType
  }
  return BUSINESS_TYPE_LABELS[incomeType as BusinessIncomeType] || incomeType
}

export default function IncomeScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const { appData, updateIncomeSource } = useBudget()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const [refreshing, setRefreshing] = useState(false)

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(subMonths(prev, 1)))
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(addMonths(prev, 1)))
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  // Projected monthly income from income sources
  const projectedIncome = useMemo(
    () =>
      getProjectedMonthlyIncome(
        appData.incomeSources,
        budgetType,
        selectedMonth
      ),
    [appData.incomeSources, budgetType, selectedMonth]
  )

  // Actual income from transactions this month (excluding transfers)
  const EXCLUDED_NAMES = useMemo(() => ['transfer', 'transfer/payment'], [])

  const incomeTransactions = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    return appData.transactions.filter((t) => {
      const transDate = parseISO(t.date)
      if (
        t.budgetType !== budgetType ||
        t.amount <= 0 ||
        transDate < monthStart ||
        transDate > monthEnd
      ) {
        return false
      }
      const category = appData.categories.find((c) => c.id === t.categoryId)
      const categoryName = category?.name?.toLowerCase() || ''
      if (EXCLUDED_NAMES.includes(categoryName) || categoryName.includes('exclude from')) {
        return false
      }
      return true
    })
  }, [appData.transactions, appData.categories, budgetType, selectedMonth, EXCLUDED_NAMES])

  const actualIncome = useMemo(
    () => incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  )

  // All income sources for the selected budget type
  const allSources = useMemo(
    () => appData.incomeSources.filter((s) => s.budgetType === budgetType),
    [appData.incomeSources, budgetType]
  )

  // Per-source breakdown: expected and actual for the month
  const sourceBreakdown = useMemo(() => {
    return allSources.map((source) => {
      // Expected for this month (uses firstOccurrenceAmount when applicable)
      let expectedForMonth = 0
      if (source.isActive) {
        const legacy = incomeSourceToLegacy(source)
        expectedForMonth = getExpectedAmountForMonth(legacy, selectedMonth)
      }

      // Actual received: transactions linked to this income source
      const actualForSource = incomeTransactions
        .filter((t) => t.incomeSourceId === source.id)
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        source,
        expected: expectedForMonth,
        actual: actualForSource,
      }
    }).sort((a, b) => {
      // Active sources first, then by name
      if (a.source.isActive !== b.source.isActive) return a.source.isActive ? -1 : 1
      return a.source.name.localeCompare(b.source.name)
    })
  }, [allSources, incomeTransactions, selectedMonth])

  // Uncategorized income: transactions with positive amount but no income source
  const uncategorizedIncome = useMemo(() => {
    const sourceIds = new Set(allSources.map((s) => s.id))
    return incomeTransactions.filter(
      (t) => !t.incomeSourceId || !sourceIds.has(t.incomeSourceId)
    )
  }, [incomeTransactions, allSources])

  const uncategorizedTotal = useMemo(
    () => uncategorizedIncome.reduce((sum, t) => sum + t.amount, 0),
    [uncategorizedIncome]
  )

  const handleToggleActive = useCallback(
    (source: IncomeSource) => {
      updateIncomeSource(source.id, { isActive: !source.isActive })
    },
    [updateIncomeSource]
  )

  const handleEditSource = useCallback(
    (source: IncomeSource) => {
      router.push(`/income/${source.id}`)
    },
    [router]
  )

  const handleAddIncome = useCallback(() => {
    router.push('/income/add')
  }, [router])

  const getCategoryName = useCallback(
    (categoryId: string) => {
      const cat = appData.categories.find((c) => c.id === categoryId)
      return cat ? cat.name : 'Uncategorized'
    },
    [appData.categories]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
                    budgetType === 'household'
                      ? '#ffffff'
                      : colors.textSecondary,
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
                    budgetType === 'business'
                      ? '#ffffff'
                      : colors.textSecondary,
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
            label="Projected Monthly"
            amount={projectedIncome}
            color={colors.primary}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Actual Received"
            amount={actualIncome}
            color={colors.success}
            compact
          />
          <View style={styles.cardSpacer} />
          <SummaryCard
            label="Difference"
            amount={actualIncome - projectedIncome}
            color={
              actualIncome - projectedIncome >= 0
                ? colors.success
                : colors.danger
            }
            compact
          />
        </ScrollView>

        {/* Income Breakdown by Source */}
        {sourceBreakdown.length === 0 ? (
          <EmptyState
            title="No Income Sources"
            message={`You haven't added any ${budgetType} income sources yet. Tap the + button to add your first income source.`}
          />
        ) : (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Income by Source
            </Text>

            {/* Header Row */}
            <View style={[styles.breakdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerText, styles.headerName, { color: colors.textSecondary }]}>
                Source
              </Text>
              <Text style={[styles.headerText, styles.headerNum, { color: colors.textSecondary }]}>
                Expected
              </Text>
              <Text style={[styles.headerText, styles.headerNum, { color: colors.textSecondary }]}>
                Actual
              </Text>
              <View style={styles.headerToggle} />
            </View>

            {sourceBreakdown.map((item, index) => {
              const diff = item.actual - item.expected
              return (
                <Pressable
                  key={item.source.id}
                  style={[
                    styles.breakdownRow,
                    index < sourceBreakdown.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => handleEditSource(item.source)}
                >
                  <View style={styles.breakdownName}>
                    <Text
                      style={[
                        styles.sourceName,
                        {
                          color: item.source.isActive
                            ? colors.text
                            : colors.textSecondary,
                        },
                        !item.source.isActive && styles.sourceNameInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.source.name}
                    </Text>
                    <Text style={[styles.sourceFrequency, { color: colors.textSecondary }]}>
                      {FREQUENCY_LABELS[item.source.frequency]}
                      {item.source.clientSource ? ` \u00B7 ${item.source.clientSource}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.breakdownAmount, { color: colors.primary }]}>
                    {formatCurrency(item.expected)}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownAmount,
                      { color: item.actual > 0 ? colors.success : colors.textSecondary },
                    ]}
                  >
                    {formatCurrency(item.actual)}
                  </Text>
                  <Switch
                    value={item.source.isActive}
                    onValueChange={() => handleToggleActive(item.source)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primaryLight,
                    }}
                    thumbColor={
                      item.source.isActive ? colors.primary : colors.textSecondary
                    }
                    style={styles.toggleSwitch}
                  />
                </Pressable>
              )
            })}
          </View>
        )}

        {/* Uncategorized Income */}
        {uncategorizedIncome.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.uncategorizedHeader}>
              <Text style={[styles.sectionTitle, { color: colors.warning, marginBottom: 0 }]}>
                Unlinked Income
              </Text>
              <Text style={[styles.uncategorizedTotal, { color: colors.warning }]}>
                {formatCurrency(uncategorizedTotal)}
              </Text>
            </View>
            <Text style={[styles.uncategorizedHint, { color: colors.textSecondary }]}>
              These income transactions are not linked to any income source.
            </Text>
            {uncategorizedIncome.map((t, index) => (
              <View
                key={t.id}
                style={[
                  styles.uncategorizedRow,
                  index < uncategorizedIncome.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.uncategorizedInfo}>
                  <Text style={[styles.uncategorizedDesc, { color: colors.text }]} numberOfLines={1}>
                    {t.description}
                  </Text>
                  <Text style={[styles.uncategorizedMeta, { color: colors.textSecondary }]}>
                    {format(parseISO(t.date), 'MMM d')} \u00B7 {getCategoryName(t.categoryId)}
                  </Text>
                </View>
                <Text style={[styles.uncategorizedAmount, { color: colors.success }]}>
                  {formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
        onPress={handleAddIncome}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
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
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.xs,
  },
  headerText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerName: {
    flex: 1,
  },
  headerNum: {
    width: 72,
    textAlign: 'right',
  },
  headerToggle: {
    width: 51,
    marginLeft: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  breakdownName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  sourceName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  sourceNameInactive: {
    textDecorationLine: 'line-through',
  },
  sourceFrequency: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  breakdownAmount: {
    width: 72,
    textAlign: 'right',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  toggleSwitch: {
    marginLeft: Spacing.sm,
  },
  uncategorizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  uncategorizedTotal: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  uncategorizedHint: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  uncategorizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  uncategorizedInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  uncategorizedDesc: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  uncategorizedMeta: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  uncategorizedAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  fabPressed: {
    backgroundColor: '#1d4ed8',
    transform: [{ scale: 0.95 }],
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
})
