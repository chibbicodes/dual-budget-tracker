import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import type { BudgetType, BucketId, Category } from '@dual-budget/shared'
import { getAllBuckets } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useHaptics } from '../../hooks/useHaptics'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function CategoryDetailScreen() {
  const router = useRouter()
  const { id, budgetType: paramBudgetType } = useLocalSearchParams<{
    id: string
    budgetType?: string
  }>()
  const { colors } = useTheme()
  const haptics = useHaptics()
  const { appData, addCategory, updateCategory, deleteCategory } = useBudget()

  const isNew = id === 'new'

  // Find existing category
  const existingCategory = useMemo(
    () => (isNew ? null : appData.categories.find((c) => c.id === id)),
    [appData.categories, id, isNew]
  )

  // Form state
  const [name, setName] = useState('')
  const [budgetType, setBudgetType] = useState<BudgetType>(
    (paramBudgetType as BudgetType) || 'household'
  )
  const [bucketId, setBucketId] = useState<BucketId>('needs')
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [isFixedExpense, setIsFixedExpense] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [taxDeductibleByDefault, setTaxDeductibleByDefault] = useState(false)
  const [isIncomeCategory, setIsIncomeCategory] = useState(false)
  const [excludeFromBudget, setExcludeFromBudget] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Populate form from existing category
  useEffect(() => {
    if (existingCategory) {
      setName(existingCategory.name)
      setBudgetType(existingCategory.budgetType)
      setBucketId(existingCategory.bucketId)
      setMonthlyBudget(existingCategory.monthlyBudget.toString())
      setIsFixedExpense(existingCategory.isFixedExpense)
      setIsActive(existingCategory.isActive)
      setTaxDeductibleByDefault(existingCategory.taxDeductibleByDefault)
      setIsIncomeCategory(existingCategory.isIncomeCategory || false)
      setExcludeFromBudget(existingCategory.excludeFromBudget || false)
    }
  }, [existingCategory])

  // Get available buckets for the selected budget type
  const allBuckets = useMemo(() => getAllBuckets(), [])
  const availableBuckets = useMemo(
    () => (budgetType === 'household' ? allBuckets.household : allBuckets.business),
    [allBuckets, budgetType]
  )

  // Update bucket when budget type changes
  useEffect(() => {
    if (availableBuckets.length > 0 && !availableBuckets.find((b) => b.id === bucketId)) {
      setBucketId(availableBuckets[0].id)
    }
  }, [availableBuckets, bucketId])

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name.')
      return
    }

    const parsedBudget = parseFloat(monthlyBudget)
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      Alert.alert('Validation Error', 'Please enter a valid monthly budget amount.')
      return
    }

    setIsSaving(true)
    try {
      if (isNew) {
        await addCategory({
          name: name.trim(),
          budgetType,
          bucketId,
          monthlyBudget: parsedBudget,
          isFixedExpense,
          isActive,
          taxDeductibleByDefault,
          isIncomeCategory,
          excludeFromBudget,
          autoCategorization: [],
        })
      } else {
        await updateCategory(id!, {
          name: name.trim(),
          budgetType,
          bucketId,
          monthlyBudget: parsedBudget,
          isFixedExpense,
          isActive,
          taxDeductibleByDefault,
          isIncomeCategory,
          excludeFromBudget,
        })
      }

      await haptics.success()
      router.back()
    } catch (error) {
      await haptics.error()
      Alert.alert('Error', 'Failed to save category. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (isNew) return

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"? If transactions use this category, it will be deactivated instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(id!)
              await haptics.error()
              router.back()
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category.')
            }
          },
        },
      ]
    )
  }

  if (!isNew && !existingCategory) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading category...
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category Name */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="e.g., Groceries"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus={isNew}
          />
        </View>

        {/* Monthly Budget */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly Budget</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={monthlyBudget}
              onChangeText={setMonthlyBudget}
            />
          </View>
        </View>

        {/* Budget Type Toggle */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Budget Type</Text>
          <View style={styles.toggleRow}>
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
        </View>

        {/* Bucket Picker */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Bucket</Text>
          <View style={styles.bucketChips}>
            {availableBuckets.map((bucket) => {
              const isSelected = bucket.id === bucketId
              return (
                <Pressable
                  key={bucket.id}
                  style={[
                    styles.bucketChip,
                    isSelected
                      ? { backgroundColor: colors.primary }
                      : {
                          backgroundColor: colors.borderLight,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                  ]}
                  onPress={() => {
                    setBucketId(bucket.id)
                    haptics.selection()
                  }}
                >
                  <Text
                    style={[
                      styles.bucketChipText,
                      { color: isSelected ? '#ffffff' : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {bucket.name}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Toggles */}
        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Fixed Expense</Text>
          <Switch
            value={isFixedExpense}
            onValueChange={(val) => {
              setIsFixedExpense(val)
              haptics.selection()
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Active</Text>
          <Switch
            value={isActive}
            onValueChange={(val) => {
              setIsActive(val)
              haptics.selection()
            }}
            trackColor={{ false: colors.border, true: colors.success }}
          />
        </View>

        {budgetType === 'business' && (
          <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Tax Deductible by Default
            </Text>
            <Switch
              value={taxDeductibleByDefault}
              onValueChange={(val) => {
                setTaxDeductibleByDefault(val)
                haptics.selection()
              }}
              trackColor={{ false: colors.border, true: colors.success }}
            />
          </View>
        )}

        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Income Category</Text>
          <Switch
            value={isIncomeCategory}
            onValueChange={(val) => {
              setIsIncomeCategory(val)
              haptics.selection()
            }}
            trackColor={{ false: colors.border, true: colors.purple }}
          />
        </View>

        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Exclude from Budget</Text>
          <Switch
            value={excludeFromBudget}
            onValueChange={(val) => {
              setExcludeFromBudget(val)
              haptics.selection()
            }}
            trackColor={{ false: colors.border, true: colors.warning }}
          />
        </View>

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary },
            pressed && styles.buttonPressed,
            isSaving && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : isNew ? 'Create Category' : 'Save Changes'}
          </Text>
        </Pressable>

        {/* Delete Button */}
        {!isNew && (
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: colors.dangerLight, borderColor: colors.danger },
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
              Delete Category
            </Text>
          </Pressable>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  fieldContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: FontSize.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: FontSize.xl,
    fontWeight: '500',
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: FontSize.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  toggleRow: {
    flexDirection: 'row',
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
  bucketChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  bucketChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
  },
  bucketChipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 52,
  },
  switchLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.md,
  },
  saveButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: Spacing.sm,
  },
  deleteButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  deleteButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
})
