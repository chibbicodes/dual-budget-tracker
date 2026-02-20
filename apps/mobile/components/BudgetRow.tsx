import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { formatCurrency } from '@dual-budget/shared'
import { Spacing, FontSize, BorderRadius } from '../constants/theme'

interface BudgetRowProps {
  name: string
  isFixed?: boolean
  suggested: number
  budgeted: number
  actual: number
  totalSuggested: number
  totalBudgeted: number
  totalSpent: number
  onPressBudgeted?: () => void
}

export function BudgetRow({
  name,
  isFixed,
  suggested,
  budgeted,
  actual,
  totalSuggested,
  totalBudgeted,
  totalSpent,
  onPressBudgeted,
}: BudgetRowProps) {
  const { colors } = useTheme()
  const remaining = budgeted - actual
  const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0
  const suggestedPct = totalSuggested > 0 ? ((suggested / totalSuggested) * 100).toFixed(1) : '0.0'
  const budgetedPct = totalBudgeted > 0 ? ((budgeted / totalBudgeted) * 100).toFixed(1) : '0.0'
  const spentPct = totalSpent > 0 && actual > 0 ? ((actual / totalSpent) * 100).toFixed(1) : '0.0'

  const barColor =
    percentUsed > 100.9
      ? colors.danger
      : percentUsed >= 90
      ? colors.warning
      : colors.success

  return (
    <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.nameCol}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        {isFixed && (
          <Text style={[styles.badge, { color: colors.primary }]}>Fixed</Text>
        )}
      </View>

      <View style={styles.numbersRow}>
        <View style={styles.numCol}>
          <Text style={[styles.numLabel, { color: colors.textSecondary }]}>Suggested</Text>
          <Text style={[styles.num, { color: colors.purple }]}>
            {formatCurrency(suggested)}
          </Text>
          <Text style={[styles.pct, { color: colors.purple }]}>({suggestedPct}%)</Text>
        </View>

        <Pressable style={styles.numCol} onPress={onPressBudgeted}>
          <Text style={[styles.numLabel, { color: colors.textSecondary }]}>Budgeted</Text>
          <Text style={[styles.num, { color: colors.text, textDecorationLine: onPressBudgeted ? 'underline' : 'none' }]}>
            {formatCurrency(budgeted)}
          </Text>
          <Text style={[styles.pct, { color: colors.textSecondary }]}>({budgetedPct}%)</Text>
        </Pressable>

        <View style={styles.numCol}>
          <Text style={[styles.numLabel, { color: colors.textSecondary }]}>Spent</Text>
          <Text style={[styles.num, { color: colors.danger }]}>
            {formatCurrency(actual)}
          </Text>
          {actual > 0 && (
            <Text style={[styles.pct, { color: colors.danger }]}>({spentPct}%)</Text>
          )}
        </View>

        <View style={styles.numCol}>
          <Text style={[styles.numLabel, { color: colors.textSecondary }]}>Left</Text>
          <Text
            style={[
              styles.num,
              { color: remaining >= 0 ? colors.success : colors.danger },
            ]}
          >
            {formatCurrency(remaining)}
          </Text>
        </View>
      </View>

      <View style={[styles.progressBg, { backgroundColor: colors.borderLight }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: barColor,
              width: `${Math.min(percentUsed, 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  nameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  badge: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  numCol: {
    flex: 1,
    alignItems: 'center',
  },
  numLabel: {
    fontSize: FontSize.xs - 1,
    fontWeight: '500',
    marginBottom: 2,
  },
  num: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  pct: {
    fontSize: FontSize.xs - 1,
    marginTop: 1,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
})
