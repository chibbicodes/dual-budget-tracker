import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { formatCurrency } from '@dual-budget/shared'
import { Spacing, FontSize, BorderRadius } from '../constants/theme'

interface TransactionRowProps {
  description: string
  date: string
  amount: number
  categoryName: string
  onPress?: () => void
}

export function TransactionRow({
  description,
  date,
  amount,
  categoryName,
  onPress,
}: TransactionRowProps) {
  const { colors } = useTheme()
  const isIncome = amount > 0

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.borderLight : colors.surface },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
          {description}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {date} · {categoryName}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          { color: isIncome ? colors.success : colors.danger },
        ]}
      >
        {isIncome ? '+' : '-'}{formatCurrency(Math.abs(amount))}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  left: {
    flex: 1,
    marginRight: Spacing.md,
  },
  description: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  meta: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  amount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
})
