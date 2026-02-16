import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { formatCurrency } from '@dual-budget/shared'
import { Spacing, FontSize, BorderRadius } from '../constants/theme'

interface SummaryCardProps {
  label: string
  amount: number
  color?: string
  compact?: boolean
}

export function SummaryCard({ label, amount, color, compact }: SummaryCardProps) {
  const { colors } = useTheme()
  const displayColor = color || colors.text

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          compact ? styles.amountCompact : styles.amount,
          { color: displayColor },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatCurrency(amount)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 100,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  amount: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  amountCompact: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
})
