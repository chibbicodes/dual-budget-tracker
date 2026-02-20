import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  ScrollView,
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
import { formatCurrency } from '@dual-budget/shared'
import type { BudgetType, Transaction } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useHaptics } from '../../hooks/useHaptics'
import { useBudget } from '../../contexts/BudgetContext'
import { useAuth } from '../../contexts/AuthContext'
import { TransactionRow } from '../../components/TransactionRow'
import { QuickAddFAB } from '../../components/QuickAddFAB'
import { EmptyState } from '../../components/EmptyState'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

type TransactionTypeFilter = 'all' | 'income' | 'expense'
type ReconciledFilter = 'all' | 'reconciled' | 'unreconciled'

export default function TransactionsScreen() {
  const { colors } = useTheme()
  const haptics = useHaptics()
  const router = useRouter()
  const { appData, deleteTransaction } = useBudget()
  const { user } = useAuth()

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const [searchText, setSearchText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all')
  const [reconciledFilter, setReconciledFilter] = useState<ReconciledFilter>('all')

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(subMonths(prev, 1)))
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(addMonths(prev, 1)))
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (categoryFilter !== 'all') count++
    if (accountFilter !== 'all') count++
    if (typeFilter !== 'all') count++
    if (reconciledFilter !== 'all') count++
    return count
  }, [categoryFilter, accountFilter, typeFilter, reconciledFilter])

  const clearFilters = useCallback(() => {
    setCategoryFilter('all')
    setAccountFilter('all')
    setTypeFilter('all')
    setReconciledFilter('all')
  }, [])

  // Available categories and accounts for filters
  const availableCategories = useMemo(
    () =>
      appData.categories
        .filter((c) => c.budgetType === budgetType && c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [appData.categories, budgetType]
  )

  const availableAccounts = useMemo(
    () =>
      appData.accounts
        .filter((a) => a.budgetType === budgetType && !a.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [appData.accounts, budgetType]
  )

  const filteredTransactions = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    const lowerSearch = searchText.toLowerCase().trim()

    return appData.transactions
      .filter((t) => {
        const transDate = parseISO(t.date)
        if (t.budgetType !== budgetType) return false
        if (transDate < monthStart || transDate > monthEnd) return false
        if (lowerSearch && !t.description.toLowerCase().includes(lowerSearch) &&
            !(t.notes && t.notes.toLowerCase().includes(lowerSearch))) {
          return false
        }
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false
        if (accountFilter !== 'all' && t.accountId !== accountFilter) return false
        if (typeFilter === 'income' && t.amount <= 0) return false
        if (typeFilter === 'expense' && t.amount >= 0) return false
        if (reconciledFilter === 'reconciled' && !t.reconciled) return false
        if (reconciledFilter === 'unreconciled' && t.reconciled) return false
        return true
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [appData.transactions, budgetType, selectedMonth, searchText, categoryFilter, accountFilter, typeFilter, reconciledFilter])

  const getCategoryName = useCallback(
    (categoryId: string) => {
      const cat = appData.categories.find((c) => c.id === categoryId)
      return cat ? cat.name : 'Uncategorized'
    },
    [appData.categories]
  )

  const getAccountName = useCallback(
    (accountId: string) => {
      const acc = appData.accounts.find((a) => a.id === accountId)
      return acc ? acc.name : ''
    },
    [appData.accounts]
  )

  const handleDelete = useCallback(
    (transaction: Transaction) => {
      haptics.warning()
      Alert.alert(
        'Delete Transaction',
        `Are you sure you want to delete "${transaction.description}" for ${formatCurrency(Math.abs(transaction.amount))}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              haptics.error()
              await deleteTransaction(transaction.id)
            },
          },
        ]
      )
    },
    [haptics, deleteTransaction]
  )

  const handleRefresh = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setRefreshing(false)
  }, [user])

  const handleTransactionPress = useCallback(
    (transaction: Transaction) => {
      router.push(`/transaction/${transaction.id}`)
    },
    [router]
  )

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => {
      return (
        <Pressable
          onLongPress={() => handleDelete(item)}
          delayLongPress={500}
        >
          <TransactionRow
            description={item.description}
            date={format(parseISO(item.date), 'MMM d, yyyy')}
            amount={item.amount}
            categoryName={getCategoryName(item.categoryId)}
            onPress={() => handleTransactionPress(item)}
          />
        </Pressable>
      )
    },
    [getCategoryName, handleDelete, handleTransactionPress]
  )

  const keyExtractor = useCallback((item: Transaction) => item.id, [])

  const FilterChip = useCallback(
    ({ label, isActive, onPress }: { label: string; isActive: boolean; onPress: () => void }) => (
      <Pressable
        style={[
          styles.filterChip,
          {
            backgroundColor: isActive ? colors.primary : colors.surface,
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
        onPress={onPress}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: isActive ? '#ffffff' : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    ),
    [colors]
  )

  const ListHeaderComponent = useMemo(
    () => (
      <View>
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

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Filter Toggle */}
        <View style={styles.filterToggleRow}>
          <Pressable
            style={[styles.filterToggle, { backgroundColor: colors.surface }]}
            onPress={() => setShowFilters((prev) => !prev)}
          >
            <Text style={[styles.filterToggleText, { color: colors.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
            <Text style={[styles.filterArrow, { color: colors.primary }]}>
              {showFilters ? '\u25B2' : '\u25BC'}
            </Text>
          </Pressable>
          {activeFilterCount > 0 && (
            <Pressable onPress={clearFilters} style={styles.clearButton}>
              <Text style={[styles.clearButtonText, { color: colors.danger }]}>
                Clear All
              </Text>
            </Pressable>
          )}
        </View>

        {/* Expandable Filters */}
        {showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: colors.surface }]}>
            {/* Transaction Type Filter */}
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
              Type
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <FilterChip label="All" isActive={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
              <FilterChip label="Income" isActive={typeFilter === 'income'} onPress={() => setTypeFilter('income')} />
              <FilterChip label="Expenses" isActive={typeFilter === 'expense'} onPress={() => setTypeFilter('expense')} />
            </ScrollView>

            {/* Reconciled Filter */}
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
              Status
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <FilterChip label="All" isActive={reconciledFilter === 'all'} onPress={() => setReconciledFilter('all')} />
              <FilterChip label="Reconciled" isActive={reconciledFilter === 'reconciled'} onPress={() => setReconciledFilter('reconciled')} />
              <FilterChip label="Unreconciled" isActive={reconciledFilter === 'unreconciled'} onPress={() => setReconciledFilter('unreconciled')} />
            </ScrollView>

            {/* Account Filter */}
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
              Account
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <FilterChip label="All Accounts" isActive={accountFilter === 'all'} onPress={() => setAccountFilter('all')} />
              {availableAccounts.map((acc) => (
                <FilterChip
                  key={acc.id}
                  label={acc.name}
                  isActive={accountFilter === acc.id}
                  onPress={() => setAccountFilter(acc.id)}
                />
              ))}
            </ScrollView>

            {/* Category Filter */}
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <FilterChip label="All Categories" isActive={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
              {availableCategories.map((cat) => (
                <FilterChip
                  key={cat.id}
                  label={cat.name}
                  isActive={categoryFilter === cat.id}
                  onPress={() => setCategoryFilter(cat.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Result Count */}
        <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
          {filteredTransactions.length} transaction
          {filteredTransactions.length !== 1 ? 's' : ''}
        </Text>
      </View>
    ),
    [
      colors,
      budgetType,
      selectedMonth,
      searchText,
      showFilters,
      activeFilterCount,
      typeFilter,
      reconciledFilter,
      accountFilter,
      categoryFilter,
      availableAccounts,
      availableCategories,
      filteredTransactions.length,
      handlePreviousMonth,
      handleNextMonth,
      FilterChip,
      clearFilters,
    ]
  )

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        title="No Transactions"
        message={
          searchText || activeFilterCount > 0
            ? 'No transactions match your filters. Try adjusting them.'
            : 'No transactions for this month yet. Tap the + button to add one.'
        }
      />
    ),
    [searchText, activeFilterCount]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            enabled={!!user}
          />
        }
        ItemSeparatorComponent={() => (
          <View
            style={[styles.separator, { backgroundColor: colors.borderLight }]}
          />
        )}
      />
      <QuickAddFAB />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
    flexGrow: 1,
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
  searchContainer: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  filterToggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },
  filterArrow: {
    fontSize: FontSize.xs,
  },
  clearButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  clearButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  filtersContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  resultCount: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    marginLeft: Spacing.md,
  },
})
