import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import type { BudgetType, AccountType, Account } from '@dual-budget/shared'
import { formatCurrency, calculateCreditUtilization } from '@dual-budget/shared'
import { useTheme } from '../hooks/useTheme'
import { useHaptics } from '../hooks/useHaptics'
import { useBudget } from '../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../constants/theme'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

export default function AccountsScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const haptics = useHaptics()
  const { appData, addAccount, updateAccount, deleteAccount } = useBudget()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Add/Edit form state
  const [formName, setFormName] = useState('')
  const [formAccountType, setFormAccountType] = useState<AccountType>('checking')
  const [formBalance, setFormBalance] = useState('')
  const [formCreditLimit, setFormCreditLimit] = useState('')
  const [formInterestRate, setFormInterestRate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const filteredAccounts = useMemo(
    () => appData.accounts.filter((a) => a.budgetType === budgetType),
    [appData.accounts, budgetType]
  )

  const totalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => {
      if (a.accountType === 'credit_card' || a.accountType === 'loan') {
        return sum - Math.abs(a.balance)
      }
      return sum + a.balance
    }, 0)
  }, [filteredAccounts])

  const resetForm = useCallback(() => {
    setFormName('')
    setFormAccountType('checking')
    setFormBalance('')
    setFormCreditLimit('')
    setFormInterestRate('')
    setFormNotes('')
    setEditingAccount(null)
  }, [])

  const openAddModal = useCallback(() => {
    resetForm()
    setShowAddModal(true)
  }, [resetForm])

  const openEditModal = useCallback((account: Account) => {
    setEditingAccount(account)
    setFormName(account.name)
    setFormAccountType(account.accountType)
    setFormBalance(account.balance.toString())
    setFormCreditLimit(account.creditLimit?.toString() || '')
    setFormInterestRate(account.interestRate?.toString() || '')
    setFormNotes(account.notes || '')
    setShowAddModal(true)
  }, [])

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Please enter an account name.')
      return
    }

    const parsedBalance = parseFloat(formBalance) || 0
    const parsedCreditLimit = formCreditLimit ? parseFloat(formCreditLimit) : undefined
    const parsedInterestRate = formInterestRate ? parseFloat(formInterestRate) : undefined

    setIsSaving(true)
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: formName.trim(),
          accountType: formAccountType,
          balance: parsedBalance,
          creditLimit: parsedCreditLimit,
          interestRate: parsedInterestRate,
          notes: formNotes.trim() || undefined,
        })
      } else {
        await addAccount({
          name: formName.trim(),
          budgetType,
          accountType: formAccountType,
          balance: parsedBalance,
          creditLimit: parsedCreditLimit,
          interestRate: parsedInterestRate,
          notes: formNotes.trim() || undefined,
        })
      }

      await haptics.success()
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      await haptics.error()
      Alert.alert('Error', 'Failed to save account. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = useCallback(
    (account: Account) => {
      Alert.alert(
        'Delete Account',
        `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAccount(account.id)
                await haptics.error()
                setShowAddModal(false)
                resetForm()
              } catch (error) {
                Alert.alert('Error', 'Failed to delete account.')
              }
            },
          },
        ]
      )
    },
    [deleteAccount, haptics, resetForm]
  )

  const getAccountTypeLabel = (type: AccountType) => {
    return ACCOUNT_TYPES.find((t) => t.value === type)?.label || type
  }

  const renderAccount = ({ item }: { item: Account }) => {
    const isCreditCard = item.accountType === 'credit_card'
    const utilization = isCreditCard && item.creditLimit
      ? calculateCreditUtilization(Math.abs(item.balance), item.creditLimit)
      : null

    return (
      <Pressable
        style={({ pressed }) => [
          styles.accountCard,
          { backgroundColor: pressed ? colors.borderLight : colors.surface },
        ]}
        onPress={() => {
          haptics.light()
          openEditModal(item)
        }}
      >
        <View style={styles.accountHeader}>
          <View style={styles.accountNameRow}>
            <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                {getAccountTypeLabel(item.accountType)}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.accountBalance,
              {
                color:
                  isCreditCard || item.accountType === 'loan'
                    ? colors.danger
                    : item.balance >= 0
                    ? colors.success
                    : colors.danger,
              },
            ]}
          >
            {isCreditCard || item.accountType === 'loan' ? '-' : ''}
            {formatCurrency(Math.abs(item.balance))}
          </Text>
        </View>

        {/* Credit Card Utilization Bar */}
        {isCreditCard && item.creditLimit && utilization !== null && (
          <View style={styles.utilizationContainer}>
            <View style={styles.utilizationHeader}>
              <Text style={[styles.utilizationLabel, { color: colors.textSecondary }]}>
                Credit Utilization
              </Text>
              <Text
                style={[
                  styles.utilizationPercent,
                  {
                    color:
                      utilization > 75
                        ? colors.danger
                        : utilization > 30
                        ? colors.warning
                        : colors.success,
                  },
                ]}
              >
                {utilization.toFixed(0)}%
              </Text>
            </View>
            <View style={[styles.utilizationBar, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.utilizationFill,
                  {
                    width: `${Math.min(utilization, 100)}%`,
                    backgroundColor:
                      utilization > 75
                        ? colors.danger
                        : utilization > 30
                        ? colors.warning
                        : colors.success,
                  },
                ]}
              />
            </View>
            <Text style={[styles.utilizationDetail, { color: colors.textSecondary }]}>
              {formatCurrency(Math.abs(item.balance))} of {formatCurrency(item.creditLimit)} limit
            </Text>
          </View>
        )}

        {item.interestRate !== undefined && item.interestRate > 0 && (
          <Text style={[styles.interestRate, { color: colors.textSecondary }]}>
            {item.interestRate}% APR
          </Text>
        )}
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Accounts' }} />

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

      {/* Net Balance Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net Balance</Text>
        <Text
          style={[
            styles.summaryAmount,
            { color: totalBalance >= 0 ? colors.success : colors.danger },
          ]}
        >
          {totalBalance >= 0 ? '' : '-'}{formatCurrency(Math.abs(totalBalance))}
        </Text>
        <Text style={[styles.summaryCount, { color: colors.textSecondary }]}>
          {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Account List */}
      <FlatList
        data={filteredAccounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Accounts</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Add a {budgetType} account to start tracking your finances.
            </Text>
          </View>
        }
      />

      {/* Add Account Button */}
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.primary },
          pressed && styles.addButtonPressed,
        ]}
        onPress={() => {
          haptics.light()
          openAddModal()
        }}
      >
        <Text style={styles.addButtonText}>+ Add Account</Text>
      </Pressable>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => {
                setShowAddModal(false)
                resetForm()
              }}
            >
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </Text>
            <Pressable onPress={handleSave} disabled={isSaving}>
              <Text
                style={[
                  styles.modalSave,
                  { color: colors.primary },
                  isSaving && { opacity: 0.5 },
                ]}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Account Name */}
            <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Account Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., Main Checking"
                placeholderTextColor={colors.textSecondary}
                value={formName}
                onChangeText={setFormName}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            {/* Account Type */}
            <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Account Type</Text>
              <View style={styles.typeChips}>
                {ACCOUNT_TYPES.map((type) => {
                  const isSelected = type.value === formAccountType
                  return (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.typeChip,
                        isSelected
                          ? { backgroundColor: colors.primary }
                          : {
                              backgroundColor: colors.borderLight,
                              borderColor: colors.border,
                              borderWidth: 1,
                            },
                      ]}
                      onPress={() => {
                        setFormAccountType(type.value)
                        haptics.selection()
                      }}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: isSelected ? '#ffffff' : colors.text },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Balance */}
            <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {formAccountType === 'credit_card' ? 'Current Balance (owed)' : 'Balance'}
              </Text>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>$</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={formBalance}
                  onChangeText={setFormBalance}
                />
              </View>
            </View>

            {/* Credit Limit (for credit cards) */}
            {(formAccountType === 'credit_card' || formAccountType === 'loan') && (
              <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {formAccountType === 'credit_card' ? 'Credit Limit' : 'Loan Amount'}
                </Text>
                <View style={styles.amountRow}>
                  <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.text, borderColor: colors.border }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    value={formCreditLimit}
                    onChangeText={setFormCreditLimit}
                  />
                </View>
              </View>
            )}

            {/* Interest Rate */}
            {(formAccountType === 'credit_card' ||
              formAccountType === 'loan' ||
              formAccountType === 'savings') && (
              <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Interest Rate (APR %)
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={formInterestRate}
                  onChangeText={setFormInterestRate}
                />
              </View>
            )}

            {/* Notes */}
            <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  styles.notesInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.textSecondary}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Delete Button (when editing) */}
            {editingAccount && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                  pressed && styles.addButtonPressed,
                ]}
                onPress={() => handleDelete(editingAccount)}
              >
                <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
                  Delete Account
                </Text>
              </Pressable>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  summaryCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  summaryAmount: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  summaryCount: {
    fontSize: FontSize.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl + 60,
  },
  separator: {
    height: Spacing.sm,
  },
  accountCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accountNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginRight: Spacing.md,
  },
  accountName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  accountBalance: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  utilizationContainer: {
    marginTop: Spacing.sm,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  utilizationLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  utilizationPercent: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  utilizationBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  utilizationFill: {
    height: '100%',
    borderRadius: 3,
  },
  utilizationDetail: {
    fontSize: FontSize.xs,
  },
  interestRate: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
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
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  modalCancel: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  modalSave: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
  },
  modalContent: {
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
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
  },
  typeChipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  notesInput: {
    fontSize: FontSize.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 88,
  },
  deleteButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
})
