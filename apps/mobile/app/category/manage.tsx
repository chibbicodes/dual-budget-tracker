import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Switch,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import type { BudgetType, Category, BucketId } from '@dual-budget/shared'
import { formatCurrency, getAllBuckets } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useHaptics } from '../../hooks/useHaptics'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

interface SectionData {
  title: string
  bucketId: BucketId
  data: Category[]
}

export default function CategoryManageScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const haptics = useHaptics()
  const { appData, updateCategory, deleteCategory } = useBudget()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')

  const buckets = useMemo(() => getAllBuckets(), [])

  const sections = useMemo((): SectionData[] => {
    const relevantBuckets =
      budgetType === 'household' ? buckets.household : buckets.business
    const filteredCategories = appData.categories.filter(
      (c) => c.budgetType === budgetType
    )

    return relevantBuckets
      .map((bucket) => ({
        title: bucket.name,
        bucketId: bucket.id,
        data: filteredCategories.filter((c) => c.bucketId === bucket.id),
      }))
      .filter((section) => section.data.length > 0)
  }, [appData.categories, budgetType, buckets])

  const handleToggleActive = useCallback(
    (category: Category) => {
      updateCategory(category.id, { isActive: !category.isActive })
      haptics.selection()
    },
    [updateCategory, haptics]
  )

  const handleDeleteCategory = useCallback(
    (category: Category) => {
      Alert.alert(
        'Delete Category',
        `Are you sure you want to delete "${category.name}"? Any transactions using this category will lose their category assignment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteCategory(category.id)
              haptics.error()
            },
          },
        ]
      )
    },
    [deleteCategory, haptics]
  )

  const renderRightActions = useCallback(
    (category: Category) => {
      return (
        <Pressable
          style={[styles.deleteAction, { backgroundColor: colors.danger }]}
          onPress={() => handleDeleteCategory(category)}
        >
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      )
    },
    [colors.danger, handleDeleteCategory]
  )

  const renderCategory = ({ item }: { item: Category }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item)}
      overshootRight={false}
    >
      <Pressable
        style={({ pressed }) => [
          styles.categoryRow,
          { backgroundColor: pressed ? colors.borderLight : colors.surface },
        ]}
        onPress={() => {
          haptics.light()
          router.push(`/category/${item.id}`)
        }}
      >
        <View style={styles.categoryInfo}>
          <View style={styles.categoryNameRow}>
            <Text
              style={[
                styles.categoryName,
                { color: item.isActive ? colors.text : colors.textSecondary },
                !item.isActive && styles.categoryInactive,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.badges}>
              {item.isFixedExpense && (
                <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>Fixed</Text>
                </View>
              )}
              {item.taxDeductibleByDefault && (
                <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>Tax</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.categoryBudget, { color: colors.textSecondary }]}>
            {formatCurrency(item.monthlyBudget)}/mo
          </Text>
        </View>
        <Switch
          value={item.isActive}
          onValueChange={() => handleToggleActive(item)}
          trackColor={{ false: colors.border, true: colors.success }}
        />
      </Pressable>
    </Swipeable>
  )

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
        {section.data.length} {section.data.length === 1 ? 'category' : 'categories'}
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Budget Type Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
        <Pressable
          style={[
            styles.toggleButton,
            styles.toggleButtonLeft,
            budgetType === 'household' && { backgroundColor: colors.household },
            budgetType !== 'household' && { borderColor: colors.border },
          ]}
          onPress={() => {
            setBudgetType('household')
            haptics.selection()
          }}
        >
          <Text
            style={[
              styles.toggleText,
              budgetType === 'household'
                ? styles.toggleTextActive
                : { color: colors.textSecondary },
            ]}
          >
            Household
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            styles.toggleButtonRight,
            budgetType === 'business' && { backgroundColor: colors.business },
            budgetType !== 'business' && { borderColor: colors.border },
          ]}
          onPress={() => {
            setBudgetType('business')
            haptics.selection()
          }}
        >
          <Text
            style={[
              styles.toggleText,
              budgetType === 'business'
                ? styles.toggleTextActive
                : { color: colors.textSecondary },
            ]}
          >
            Business
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderCategory}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        ItemSeparatorComponent={() => (
          <View style={[styles.itemSeparator, { backgroundColor: colors.borderLight }]} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Categories</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              No {budgetType} categories found. Add one below.
            </Text>
          </View>
        }
      />

      {/* Add Category Button */}
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.primary },
          pressed && styles.addButtonPressed,
        ]}
        onPress={() => {
          haptics.light()
          router.push({
            pathname: '/category/[id]',
            params: { id: 'new', budgetType },
          })
        }}
      >
        <Text style={styles.addButtonText}>+ Add Category</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleButtonLeft: {
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
  },
  toggleButtonRight: {
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingBottom: Spacing.xxl + 60,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: FontSize.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  categoryInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  categoryName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  categoryInactive: {
    textDecorationLine: 'line-through',
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  categoryBudget: {
    fontSize: FontSize.sm,
  },
  itemSeparator: {
    height: 1,
    marginLeft: Spacing.md,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    minHeight: 56,
  },
  deleteActionText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  emptyContainer: {
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
  addButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
})
