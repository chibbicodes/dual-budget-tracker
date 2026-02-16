import { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { BudgetType } from '@dual-budget/shared'
import { calculateBudgetSummary, formatCurrency } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useHaptics } from '../../hooks/useHaptics'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

interface MonthEntry {
  key: string
  label: string
  date: Date
  month: string
  householdSummary: { totalIncome: number; totalExpenses: number; net: number }
  businessSummary: { totalIncome: number; totalExpenses: number; net: number }
}

export default function BudgetArchiveScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const haptics = useHaptics()
  const { appData } = useBudget()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const months = useMemo(() => {
    const result: MonthEntry[] = []
    const now = new Date()

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`

      const householdBudget = calculateBudgetSummary(
        appData.transactions,
        appData.categories,
        'household',
        d,
        appData.monthlyBudgets
      )

      const businessBudget = calculateBudgetSummary(
        appData.transactions,
        appData.categories,
        'business',
        d,
        appData.monthlyBudgets
      )

      result.push({
        key: monthStr,
        label,
        date: d,
        month: monthStr,
        householdSummary: {
          totalIncome: householdBudget.totalIncome,
          totalExpenses: householdBudget.totalExpenses,
          net: householdBudget.remainingBudget,
        },
        businessSummary: {
          totalIncome: businessBudget.totalIncome,
          totalExpenses: businessBudget.totalExpenses,
          net: businessBudget.remainingBudget,
        },
      })
    }

    return result
  }, [appData.transactions, appData.categories, appData.monthlyBudgets])

  const renderMonth = ({ item }: { item: MonthEntry }) => {
    const totalIncome =
      item.householdSummary.totalIncome + item.businessSummary.totalIncome
    const totalExpenses =
      item.householdSummary.totalExpenses + item.businessSummary.totalExpenses
    const totalNet = item.householdSummary.net + item.businessSummary.net

    return (
      <Pressable
        style={({ pressed }) => [
          styles.monthCard,
          { backgroundColor: pressed ? colors.borderLight : colors.surface },
        ]}
        onPress={() => {
          haptics.light()
          router.push({
            pathname: '/budget/archive',
            params: { month: item.month },
          })
        }}
      >
        <Text style={[styles.monthLabel, { color: colors.text }]}>{item.label}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: totalNet >= 0 ? colors.success : colors.danger },
              ]}
            >
              {totalNet >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalNet))}
            </Text>
          </View>
        </View>

        {/* Breakdown by type */}
        <View style={[styles.breakdownRow, { borderTopColor: colors.borderLight }]}>
          <View style={styles.breakdownItem}>
            <View style={[styles.typeBadge, { backgroundColor: colors.household }]}>
              <Text style={styles.typeBadgeText}>H</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.textSecondary }]}>
              {formatCurrency(item.householdSummary.totalExpenses)}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.typeBadge, { backgroundColor: colors.business }]}>
              <Text style={styles.typeBadgeText}>B</Text>
            </View>
            <Text style={[styles.breakdownAmount, { color: colors.textSecondary }]}>
              {formatCurrency(item.businessSummary.totalExpenses)}
            </Text>
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={months}
        renderItem={renderMonth}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Start adding transactions to see your budget history.
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
  },
  separator: {
    height: Spacing.sm,
  },
  monthCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  monthLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  breakdownAmount: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
})
