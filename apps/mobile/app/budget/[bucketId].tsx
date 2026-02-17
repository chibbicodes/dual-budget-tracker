import { useMemo } from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { getAllBuckets, formatCurrency } from '@dual-budget/shared'
import type { BucketId } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function BucketDetailScreen() {
  const { bucketId } = useLocalSearchParams<{ bucketId: string }>()
  const { colors } = useTheme()
  const { appData, budgetType } = useBudget()

  const bucket = useMemo(
    () => getAllBuckets().find((b) => b.id === bucketId),
    [bucketId]
  )

  const bucketCategories = useMemo(
    () =>
      appData.categories.filter(
        (c) => c.bucketId === (bucketId as BucketId) && c.budgetType === budgetType && c.isActive
      ),
    [appData.categories, bucketId, budgetType]
  )

  const bucketTotal = useMemo(
    () => bucketCategories.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0),
    [bucketCategories]
  )

  return (
    <>
      <Stack.Screen options={{ title: bucket?.name ?? 'Bucket Details' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {bucket?.name ?? bucketId}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {bucketCategories.length} categories | {formatCurrency(bucketTotal)} budgeted
          </Text>
        </View>

        <FlatList
          data={bucketCategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.categoryRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.categoryBudget, { color: colors.textSecondary }]}>
                {formatCurrency(item.monthlyBudget || 0)}/mo
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No categories in this bucket
            </Text>
          }
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  categoryName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    flex: 1,
  },
  categoryBudget: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    padding: Spacing.xl,
    fontSize: FontSize.md,
  },
})
