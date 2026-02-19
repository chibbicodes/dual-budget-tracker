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
  getExpectedDatesForMonth,
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

interface IncomeGroup {
  type: string
  label: string
  sources: IncomeSource[]
}

function groupSourcesByType(
  sources: IncomeSource[],
  budgetType: BudgetType
): IncomeGroup[] {
  const groups = new Map<string, IncomeSource[]>()

  sources.forEach((source) => {
    const type = source.incomeType
    if (!groups.has(type)) {
      groups.set(type, [])
    }
    groups.get(type)!.push(source)
  })

  return Array.from(groups.entries())
    .map(([type, groupSources]) => ({
      type,
      label: getIncomeTypeLabel(type, budgetType),
      sources: groupSources.sort((a, b) => {
        // Active sources first, then alphabetically
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
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
    // Data is reactive from context; simulate a brief refresh
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
  const actualIncome = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    const EXCLUDED_NAMES = ['transfer', 'transfer/payment']
    return appData.transactions
      .filter((t) => {
        const transDate = parseISO(t.date)
        if (
          t.budgetType !== budgetType ||
          t.amount <= 0 ||
          transDate < monthStart ||
          transDate > monthEnd
        ) {
          return false
        }
        // Exclude transfer categories from income calculation
        const category = appData.categories.find((c) => c.id === t.categoryId)
        const categoryName = category?.name?.toLowerCase() || ''
        if (EXCLUDED_NAMES.includes(categoryName) || categoryName.includes('exclude from')) {
          return false
        }
        return true
      })
      .reduce((sum, t) => sum + t.amount, 0)
  }, [appData.transactions, appData.categories, budgetType, selectedMonth])

  // All income sources for the selected budget type
  const allSources = useMemo(
    () => appData.incomeSources.filter((s) => s.budgetType === budgetType),
    [appData.incomeSources, budgetType]
  )

  // Active income sources only (for expected dates computation)
  const activeSources = useMemo(
    () => allSources.filter((s) => s.isActive),
    [allSources]
  )

  // Group sources by income type
  const groupedSources = useMemo(
    () => groupSourcesByType(allSources, budgetType),
    [allSources, budgetType]
  )

  // Pre-compute expected dates for each source
  const expectedDatesMap = useMemo(() => {
    const map = new Map<string, Date[]>()
    allSources.forEach((source) => {
      const legacy = incomeSourceToLegacy(source)
      const dates = getExpectedDatesForMonth(legacy, selectedMonth)
      map.set(source.id, dates)
    })
    return map
  }, [allSources, selectedMonth])

  const handleToggleActive = useCallback(
    (source: IncomeSource) => {
      updateIncomeSource(source.id, { isActive: !source.isActive })
    },
    [updateIncomeSource]
  )

  const handleAddIncome = useCallback(() => {
    router.push('/income/add')
  }, [router])

  const nextExpectedDateLabel = useCallback(
    (source: IncomeSource): string | null => {
      const dates = expectedDatesMap.get(source.id)
      if (dates && dates.length > 0) {
        // Find the next upcoming date (or the first one)
        const now = new Date()
        const upcoming = dates.find((d) => d >= now) || dates[0]
        return format(upcoming, 'MMM d, yyyy')
      }
      if (source.nextExpectedDate) {
        return format(parseISO(source.nextExpectedDate), 'MMM d, yyyy')
      }
      return null
    },
    [expectedDatesMap]
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

        {/* Income Sources Grouped by Type */}
        {groupedSources.length === 0 ? (
          <EmptyState
            title="No Income Sources"
            message={`You haven't added any ${budgetType} income sources yet. Tap the + button to add your first income source.`}
          />
        ) : (
          groupedSources.map((group) => (
            <View
              key={group.type}
              style={[styles.groupSection, { backgroundColor: colors.surface }]}
            >
              {/* Group Header */}
              <View
                style={[
                  styles.groupHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.groupTitle, { color: colors.text }]}>
                  {group.label}
                </Text>
                <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                  {group.sources.length} source
                  {group.sources.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Source Rows */}
              {group.sources.map((source, index) => {
                const nextDate = nextExpectedDateLabel(source)
                return (
                  <View
                    key={source.id}
                    style={[
                      styles.sourceRow,
                      index < group.sources.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                      },
                    ]}
                  >
                    <View style={styles.sourceInfo}>
                      {/* Name + Inactive Badge */}
                      <View style={styles.sourceNameRow}>
                        <Text
                          style={[
                            styles.sourceName,
                            {
                              color: source.isActive
                                ? colors.text
                                : colors.textSecondary,
                            },
                            !source.isActive && styles.sourceNameInactive,
                          ]}
                          numberOfLines={1}
                        >
                          {source.name}
                        </Text>
                        {!source.isActive && (
                          <View
                            style={[
                              styles.inactiveBadge,
                              { backgroundColor: colors.warningLight },
                            ]}
                          >
                            <Text
                              style={[
                                styles.inactiveBadgeText,
                                { color: colors.warning },
                              ]}
                            >
                              Inactive
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Frequency */}
                      <Text
                        style={[
                          styles.sourceFrequency,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {FREQUENCY_LABELS[source.frequency]}
                        {source.clientSource ? ` \u00B7 ${source.clientSource}` : ''}
                      </Text>

                      {/* Amount + Next Expected Date */}
                      <View style={styles.sourceDetailsRow}>
                        <Text
                          style={[styles.sourceAmount, { color: colors.success }]}
                        >
                          {formatCurrency(source.expectedAmount)}
                        </Text>
                        {nextDate && (
                          <Text
                            style={[
                              styles.sourceNextDate,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Next: {nextDate}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Active/Inactive Toggle */}
                    <Switch
                      value={source.isActive}
                      onValueChange={() => handleToggleActive(source)}
                      trackColor={{
                        false: colors.border,
                        true: colors.primaryLight,
                      }}
                      thumbColor={
                        source.isActive ? colors.primary : colors.textSecondary
                      }
                    />
                  </View>
                )
              })}
            </View>
          ))
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
  groupSection: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  groupTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  groupCount: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  sourceInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  sourceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sourceName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  sourceNameInactive: {
    textDecorationLine: 'line-through',
  },
  inactiveBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  inactiveBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  sourceFrequency: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  sourceDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginRight: Spacing.md,
  },
  sourceNextDate: {
    fontSize: FontSize.sm,
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
