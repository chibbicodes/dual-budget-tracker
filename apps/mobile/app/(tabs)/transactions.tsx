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

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(subMonths(prev, 1)))
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => startOfMonth(addMonths(prev, 1)))
  }, [])

  const filteredTransactions = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    const lowerSearch = searchText.toLowerCase().trim()

    return appData.transactions
      .filter((t) => {
        const transDate = parseISO(t.date)
        if (t.budgetType !== budgetType) return false
        if (transDate < monthStart || transDate > monthEnd) return false
        if (
          lowerSearch &&
          !t.description.toLowerCase().includes(lowerSearch)
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [appData.transactions, budgetType, selectedMonth, searchText])

  const getCategoryName = useCallback(
    (categoryId: string) => {
      const cat = appData.categories.find((c) => c.id === categoryId)
      return cat ? cat.name : 'Uncategorized'
    },
    [appData.categories]
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
    // Trigger sync -- the BudgetContext/sync service handles the actual logic
    // We simply wait a moment and then stop the refreshing indicator
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
      filteredTransactions.length,
      handlePreviousMonth,
      handleNextMonth,
    ]
  )

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        title="No Transactions"
        message={
          searchText
            ? 'No transactions match your search. Try a different term.'
            : 'No transactions for this month yet. Tap the + button to add one.'
        }
      />
    ),
    [searchText]
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
  resultCount: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: 1,
    marginLeft: Spacing.md,
  },
})
