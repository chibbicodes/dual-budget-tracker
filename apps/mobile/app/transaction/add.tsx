import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import type { BudgetType, BucketId, Category } from '@dual-budget/shared'
import { formatCurrency, getAllBuckets } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useHaptics } from '../../hooks/useHaptics'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function AddTransactionScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const haptics = useHaptics()
  const { appData, addTransaction } = useBudget()

  const amountRef = useRef<TextInput>(null)

  // Form state
  const [amountText, setAmountText] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [taxDeductible, setTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Filter accounts and categories by budget type
  const filteredAccounts = useMemo(
    () => appData.accounts.filter((a) => a.budgetType === budgetType),
    [appData.accounts, budgetType]
  )

  const filteredCategories = useMemo(
    () =>
      appData.categories.filter(
        (c) =>
          c.budgetType === budgetType &&
          c.isActive &&
          (isIncome ? c.isIncomeCategory : !c.isIncomeCategory)
      ),
    [appData.categories, budgetType, isIncome]
  )

  // Group categories by bucket
  const buckets = useMemo(() => getAllBuckets(), [])
  const groupedCategories = useMemo(() => {
    const relevantBuckets =
      budgetType === 'household' ? buckets.household : buckets.business
    const groups: Array<{
      bucketId: BucketId
      bucketName: string
      categories: Category[]
    }> = []

    for (const bucket of relevantBuckets) {
      const cats = filteredCategories.filter((c) => {
        const matchesBucket = c.bucketId === bucket.id
        if (!categorySearch) return matchesBucket
        return (
          matchesBucket &&
          c.name.toLowerCase().includes(categorySearch.toLowerCase())
        )
      })
      if (cats.length > 0) {
        groups.push({
          bucketId: bucket.id,
          bucketName: bucket.name,
          categories: cats,
        })
      }
    }
    return groups
  }, [filteredCategories, budgetType, buckets, categorySearch])

  // Default account selection
  useEffect(() => {
    if (filteredAccounts.length > 0 && !filteredAccounts.find((a) => a.id === accountId)) {
      setAccountId(filteredAccounts[0].id)
    }
  }, [filteredAccounts, accountId])

  // Auto-focus the amount input
  useEffect(() => {
    const timer = setTimeout(() => {
      amountRef.current?.focus()
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  // Auto-categorization: check description against rules
  const autoCategorizationResult = useCallback(
    (desc: string) => {
      if (!desc.trim()) return null

      // Check auto-categorization rules first
      for (const rule of appData.autoCategorization) {
        if (!rule.isActive) continue
        if (rule.budgetType !== 'both' && rule.budgetType !== budgetType) continue

        const pattern = rule.caseSensitive
          ? rule.vendorPattern
          : rule.vendorPattern.toLowerCase()
        const target = rule.caseSensitive ? desc : desc.toLowerCase()

        if (target.includes(pattern)) {
          return rule.categoryId
        }
      }

      // Check category autoCategorization patterns
      for (const cat of filteredCategories) {
        for (const pattern of cat.autoCategorization) {
          const p = pattern.caseSensitive ? pattern.pattern : pattern.pattern.toLowerCase()
          const t = pattern.caseSensitive ? desc : desc.toLowerCase()
          if (t.includes(p)) {
            return cat.id
          }
        }
      }

      return null
    },
    [appData.autoCategorization, filteredCategories, budgetType]
  )

  // When description changes, try to auto-categorize
  useEffect(() => {
    if (description.length >= 3) {
      const matched = autoCategorizationResult(description)
      if (matched) {
        setCategoryId(matched)
      }
    }
  }, [description, autoCategorizationResult])

  // Reset tax deductible when switching budget types
  useEffect(() => {
    if (budgetType === 'household') {
      setTaxDeductible(false)
    }
  }, [budgetType])

  // Set tax deductible from category defaults
  useEffect(() => {
    if (categoryId && budgetType === 'business') {
      const cat = appData.categories.find((c) => c.id === categoryId)
      if (cat) {
        setTaxDeductible(cat.taxDeductibleByDefault)
      }
    }
  }, [categoryId, budgetType, appData.categories])

  const handleSave = async () => {
    const amount = parseFloat(amountText)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.')
      return
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a description for the transaction.')
      return
    }
    if (!accountId) {
      Alert.alert('No Account', 'Please select an account.')
      return
    }
    if (!categoryId) {
      Alert.alert('No Category', 'Please select a category.')
      return
    }

    setIsSaving(true)
    try {
      const finalAmount = isIncome ? Math.abs(amount) : -Math.abs(amount)
      const selectedCategory = appData.categories.find((c) => c.id === categoryId)

      await addTransaction({
        date,
        description: description.trim(),
        amount: finalAmount,
        categoryId,
        bucketId: selectedCategory?.bucketId,
        budgetType,
        accountId,
        taxDeductible,
        reconciled: false,
        notes: notes.trim() || undefined,
      })

      await haptics.success()
      router.back()
    } catch (error) {
      await haptics.error()
      Alert.alert('Error', 'Failed to save transaction. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDateChange = () => {
    Alert.prompt(
      'Enter Date',
      'Format: YYYY-MM-DD',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: (value) => {
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              setDate(value)
            } else if (value) {
              Alert.alert('Invalid Date', 'Please use the format YYYY-MM-DD.')
            }
          },
        },
      ],
      'plain-text',
      date
    )
  }

  const formatDisplayDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-')
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
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
        {/* Amount Input */}
        <View style={[styles.amountContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>$</Text>
          <TextInput
            ref={amountRef}
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
            autoFocus
          />
        </View>

        {/* Description */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="What was this for?"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            autoCapitalize="words"
          />
        </View>

        {/* Date Picker */}
        <Pressable
          style={[styles.fieldContainer, { backgroundColor: colors.surface }]}
          onPress={handleDateChange}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <View style={[styles.dateDisplay, { borderColor: colors.border }]}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatDisplayDate(date)}
            </Text>
            <Text style={[styles.dateChangeHint, { color: colors.primary }]}>Change</Text>
          </View>
        </Pressable>

        {/* Income/Expense Toggle */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                styles.toggleButtonLeft,
                !isIncome && styles.toggleButtonActive,
                !isIncome && { backgroundColor: colors.danger },
                isIncome && { borderColor: colors.border },
              ]}
              onPress={() => {
                setIsIncome(false)
                setCategoryId('')
                haptics.selection()
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  !isIncome ? styles.toggleTextActive : { color: colors.textSecondary },
                ]}
              >
                Expense
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                styles.toggleButtonRight,
                isIncome && styles.toggleButtonActive,
                isIncome && { backgroundColor: colors.success },
                !isIncome && { borderColor: colors.border },
              ]}
              onPress={() => {
                setIsIncome(true)
                setCategoryId('')
                haptics.selection()
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  isIncome ? styles.toggleTextActive : { color: colors.textSecondary },
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Budget Type Toggle */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Budget</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                styles.toggleButtonLeft,
                budgetType === 'household' && styles.toggleButtonActive,
                budgetType === 'household' && { backgroundColor: colors.household },
                budgetType !== 'household' && { borderColor: colors.border },
              ]}
              onPress={() => {
                setBudgetType('household')
                setCategoryId('')
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
                budgetType === 'business' && styles.toggleButtonActive,
                budgetType === 'business' && { backgroundColor: colors.business },
                budgetType !== 'business' && { borderColor: colors.border },
              ]}
              onPress={() => {
                setBudgetType('business')
                setCategoryId('')
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

        {/* Account Picker - horizontal scrollable chips */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Account</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {filteredAccounts.map((account) => {
              const isSelected = account.id === accountId
              return (
                <Pressable
                  key={account.id}
                  style={[
                    styles.chip,
                    isSelected
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.borderLight, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => {
                    setAccountId(account.id)
                    haptics.selection()
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#ffffff' : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {account.name}
                  </Text>
                </Pressable>
              )
            })}
            {filteredAccounts.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {budgetType} accounts found
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Category Picker */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="Search categories..."
            placeholderTextColor={colors.textSecondary}
            value={categorySearch}
            onChangeText={setCategorySearch}
          />
          <View style={styles.categoryList}>
            {groupedCategories.map((group) => (
              <View key={group.bucketId} style={styles.categoryGroup}>
                <Text style={[styles.bucketLabel, { color: colors.textSecondary }]}>
                  {group.bucketName}
                </Text>
                <View style={styles.categoryChips}>
                  {group.categories.map((cat) => {
                    const isSelected = cat.id === categoryId
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          isSelected
                            ? { backgroundColor: colors.primary }
                            : {
                                backgroundColor: colors.borderLight,
                                borderColor: colors.border,
                                borderWidth: 1,
                              },
                        ]}
                        onPress={() => {
                          setCategoryId(cat.id)
                          haptics.selection()
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isSelected ? '#ffffff' : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
            {groupedCategories.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No categories found
              </Text>
            )}
          </View>
        </View>

        {/* Tax Deductible (business only) */}
        {budgetType === 'business' && (
          <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Tax Deductible</Text>
            <Switch
              value={taxDeductible}
              onValueChange={(val) => {
                setTaxDeductible(val)
                haptics.selection()
              }}
              trackColor={{ false: colors.border, true: colors.success }}
            />
          </View>
        )}

        {/* Notes (collapsed by default) */}
        {!showNotes ? (
          <Pressable
            style={[styles.addNotesButton, { backgroundColor: colors.surface }]}
            onPress={() => setShowNotes(true)}
          >
            <Text style={[styles.addNotesText, { color: colors.primary }]}>
              + Add Notes
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              style={[
                styles.notesInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Additional notes..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary },
            pressed && styles.saveButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Transaction'}
          </Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  currencySymbol: {
    fontSize: FontSize.xxxl,
    fontWeight: '300',
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    padding: 0,
    minHeight: 60,
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
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  dateText: {
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  dateChangeHint: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
  toggleButtonActive: {
    borderColor: 'transparent',
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    fontSize: FontSize.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    minHeight: 44,
  },
  categoryList: {
    gap: Spacing.sm,
  },
  categoryGroup: {
    marginBottom: Spacing.xs,
  },
  bucketLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryChipText: {
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
  },
  addNotesButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  addNotesText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  notesInput: {
    fontSize: FontSize.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 88,
  },
  saveButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: Spacing.sm,
  },
  saveButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
})
