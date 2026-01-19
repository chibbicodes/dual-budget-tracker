import { useBudget } from '../contexts/BudgetContext'
import { useState, useMemo } from 'react'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  Upload,
  Link2,
} from 'lucide-react'
import { formatCurrency } from '../utils/calculations'
import { format, parseISO } from 'date-fns'
import type { Transaction, BudgetType, Account } from '../types'

type BudgetFilter = 'household' | 'business' | 'all'
type TransactionTypeFilter = 'all' | 'income' | 'expense'

export default function Transactions() {
  const {
    currentView,
    appData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useBudget()

  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionTypeFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set())
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<{[key: string]: number | null}>({
    date: null,
    description: null,
    amount: null,
    category: null,
    account: null,
    notes: null,
  })
  const [vendorMatchModalOpen, setVendorMatchModalOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    cleanedDescription: string
    originalDescription: string
    similarVendors: string[]
    rowData: any
    index: number
  } | null>(null)
  const [editableStandardizedName, setEditableStandardizedName] = useState<string>('')
  const [pendingImports, setPendingImports] = useState<any[]>([])
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const [editingCell, setEditingCell] = useState<{transactionId: string, field: string} | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let transactions = appData.transactions

    // Filter by current view
    if (currentView !== 'combined') {
      transactions = transactions.filter((t) => t.budgetType === currentView)
    }

    // Apply budget filter
    if (budgetFilter !== 'all') {
      transactions = transactions.filter((t) => t.budgetType === budgetFilter)
    }

    // Apply account filter
    if (accountFilter !== 'all') {
      transactions = transactions.filter((t) => t.accountId === accountFilter)
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      transactions = transactions.filter((t) => t.categoryId === categoryFilter)
    }

    // Apply transaction type filter
    if (transactionTypeFilter === 'income') {
      transactions = transactions.filter((t) => t.amount > 0)
    } else if (transactionTypeFilter === 'expense') {
      transactions = transactions.filter((t) => t.amount < 0)
    }

    // Apply date range filter
    if (startDate) {
      transactions = transactions.filter((t) => t.date >= startDate)
    }
    if (endDate) {
      transactions = transactions.filter((t) => t.date <= endDate)
    }

    // Apply search filter
    if (searchText) {
      const search = searchText.toLowerCase()
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(search) ||
          t.notes?.toLowerCase().includes(search)
      )
    }

    // Sort by date (newest first)
    return transactions.sort((a, b) => b.date.localeCompare(a.date))
  }, [
    appData.transactions,
    currentView,
    budgetFilter,
    accountFilter,
    categoryFilter,
    transactionTypeFilter,
    startDate,
    endDate,
    searchText,
  ])

  // Get all accounts for dropdown (available across all views)
  const availableAccounts = useMemo(() => {
    return appData.accounts
  }, [appData.accounts])

  // Get filtered categories for dropdown organized by bucket/group and income
  const availableCategories = useMemo(() => {
    let categories = appData.categories
    if (currentView !== 'combined') {
      categories = categories.filter((c) => c.budgetType === currentView)
    }
    if (budgetFilter !== 'all') {
      categories = categories.filter((c) => c.budgetType === budgetFilter)
    }
    const activeCategories = categories.filter((c) => c.isActive)

    // Separate income categories from regular categories
    const incomeCategories = activeCategories.filter((c) => c.isIncomeCategory)
    const regularCategories = activeCategories.filter((c) => !c.isIncomeCategory)

    // Group regular categories by bucket/group and sort alphabetically within each group
    const grouped: { [key: string]: typeof activeCategories } = {}

    // Add income categories as a special group
    if (incomeCategories.length > 0) {
      grouped['income'] = incomeCategories.sort((a, b) => a.name.localeCompare(b.name))
    }

    regularCategories.forEach((cat) => {
      // For business_expenses with categoryGroup, group by categoryGroup instead of bucket
      const groupKey = cat.bucketId === 'business_expenses' && cat.categoryGroup
        ? `business_expenses:${cat.categoryGroup}`
        : cat.bucketId

      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(cat)
    })

    // Sort categories within each group alphabetically
    Object.keys(grouped).forEach((groupKey) => {
      if (groupKey !== 'income') {
        grouped[groupKey].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    return grouped
  }, [appData.categories, currentView, budgetFilter])

  const handleAddTransaction = (transactionData: any) => {
    // BudgetContext's addTransaction now handles all linking logic
    addTransaction(transactionData)
    setIsAddModalOpen(false)
  }

  const handleEditTransaction = (updates: Partial<Transaction>) => {
    if (!selectedTransaction) return

    // Check if this transaction is linked
    if (selectedTransaction.linkedTransactionId) {
      const linkedTx = appData.transactions.find(t => t.id === selectedTransaction.linkedTransactionId)
      if (linkedTx) {
        // Ask if user wants to update both transactions
        const updateBothMessage = `This transaction is linked to another transaction.\n\n` +
          `Do you want to apply changes to BOTH transactions?\n\n` +
          `• Click OK to update both (date, description, amount, notes will sync)\n` +
          `• Click Cancel to update only this transaction`

        const updateBoth = confirm(updateBothMessage)

        if (updateBoth) {
          // Update both transactions with synced fields
          updateTransaction(selectedTransaction.id, updates)

          // Create updates for linked transaction (sync certain fields)
          const linkedUpdates: Partial<Transaction> = {}
          if (updates.date) linkedUpdates.date = updates.date
          if (updates.description) linkedUpdates.description = updates.description
          if (updates.amount) {
            // Keep opposite sign - if main is negative, linked is positive and vice versa
            const mainIsNegative = (updates.amount < 0)
            linkedUpdates.amount = mainIsNegative ? Math.abs(updates.amount) : -Math.abs(updates.amount)
          }
          if (updates.notes) linkedUpdates.notes = updates.notes
          if (updates.taxDeductible !== undefined) linkedUpdates.taxDeductible = updates.taxDeductible

          if (Object.keys(linkedUpdates).length > 0) {
            updateTransaction(selectedTransaction.linkedTransactionId, linkedUpdates)
          }
        } else {
          // Update only this transaction
          updateTransaction(selectedTransaction.id, updates)
        }

        setIsEditModalOpen(false)
        setSelectedTransaction(null)
        return
      }
    }

    // No linked transaction, proceed with normal update
    updateTransaction(selectedTransaction.id, updates)
    setIsEditModalOpen(false)
    setSelectedTransaction(null)
  }

  const handleDeleteTransaction = (id: string) => {
    const transaction = appData.transactions.find(t => t.id === id)
    if (!transaction) return

    // Check if this transaction is linked to another transaction
    if (transaction.linkedTransactionId) {
      const linkedTx = appData.transactions.find(t => t.id === transaction.linkedTransactionId)
      if (linkedTx) {
        const deleteLinkedMessage = `This transaction is linked to another transaction:\n\n` +
          `Linked: ${format(parseISO(linkedTx.date), 'MMM dd, yyyy')} - ${linkedTx.description} - ${formatCurrency(linkedTx.amount)}\n\n` +
          `Do you want to delete BOTH transactions?\n\n` +
          `• Click OK to delete both\n` +
          `• Click Cancel to delete only this transaction`

        const deleteBoth = confirm(deleteLinkedMessage)

        if (deleteBoth) {
          // Delete both transactions
          deleteTransaction(id)
          deleteTransaction(transaction.linkedTransactionId)
        } else {
          // Delete only this transaction and unlink the other
          if (confirm('Are you sure you want to delete this transaction? The linked transaction will be unlinked.')) {
            deleteTransaction(id)
            // Unlink the other transaction
            updateTransaction(transaction.linkedTransactionId, { linkedTransactionId: undefined })
          }
        }
        return
      }
    }

    // No linked transaction, proceed with normal deletion
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id)
    }
  }

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsEditModalOpen(true)
  }

  const clearFilters = () => {
    setBudgetFilter('all')
    setAccountFilter('all')
    setCategoryFilter('all')
    setTransactionTypeFilter('all')
    setSearchText('')
    setStartDate('')
    setEndDate('')
  }

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedTransactionIds.size === filteredTransactions.length) {
      setSelectedTransactionIds(new Set())
    } else {
      setSelectedTransactionIds(new Set(filteredTransactions.map((t) => t.id)))
    }
  }

  const handleSelectTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactionIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTransactionIds(newSelected)
  }

  const handleBulkDelete = () => {
    if (selectedTransactionIds.size === 0) return

    if (confirm(`Are you sure you want to delete ${selectedTransactionIds.size} transaction(s)?`)) {
      selectedTransactionIds.forEach((id) => {
        deleteTransaction(id)
      })
      setSelectedTransactionIds(new Set())
    }
  }

  const handleOpenBulkEdit = () => {
    if (selectedTransactionIds.size === 0) return
    setIsBulkEditModalOpen(true)
  }

  const handleBulkEdit = (updates: Partial<Transaction>) => {
    selectedTransactionIds.forEach((id) => {
      updateTransaction(id, updates)
    })
    setSelectedTransactionIds(new Set())
    setIsBulkEditModalOpen(false)
  }

  // Inline editing handlers
  const startInlineEdit = (transactionId: string, field: string, currentValue: any) => {
    setEditingCell({ transactionId, field })
    setEditingValue(String(currentValue || ''))
  }

  const saveInlineEdit = (transactionId: string, field: string) => {
    if (!editingValue.trim() && field !== 'amount') {
      // Don't allow empty values except for amount which can be 0
      cancelInlineEdit()
      return
    }

    const updates: Partial<Transaction> = {}

    switch (field) {
      case 'date':
        updates.date = editingValue
        break
      case 'description':
        updates.description = editingValue
        break
      case 'amount':
        const amount = parseFloat(editingValue)
        if (!isNaN(amount)) {
          updates.amount = amount
        }
        break
      case 'accountId':
        updates.accountId = editingValue
        break
      case 'categoryId':
        updates.categoryId = editingValue
        break
      case 'budgetType':
        updates.budgetType = editingValue as BudgetType
        break
    }

    if (Object.keys(updates).length > 0) {
      updateTransaction(transactionId, updates)
    }

    cancelInlineEdit()
  }

  const cancelInlineEdit = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent, transactionId: string, field: string) => {
    if (e.key === 'Enter') {
      saveInlineEdit(transactionId, field)
    } else if (e.key === 'Escape') {
      cancelInlineEdit()
    }
  }

  // Standardize vendor/payee names
  const standardizeVendorName = (name: string): string => {
    let cleaned = name.trim()

    // Remove common patterns
    // Remove dates like 12/30, 12/22, etc.
    cleaned = cleaned.replace(/\s+\d{1,2}\/\d{1,2}(\s|$)/g, ' ')

    // Remove state abbreviations at end (e.g., "TX", "NY", "CA")
    cleaned = cleaned.replace(/\s+[A-Z]{2}(\s|$)/g, ' ')

    // Remove "PPD ID:" and similar transaction IDs
    cleaned = cleaned.replace(/\s*PPD ID:\s*\d+/gi, '')
    cleaned = cleaned.replace(/\s*WEB ID:\s*\d+/gi, '')
    cleaned = cleaned.replace(/\s*ID:\s*\w+/gi, '')

    // Remove alphanumeric codes at end (e.g., "JPM99c0awwic", "4V86YV1")
    cleaned = cleaned.replace(/\s+[A-Z0-9]{6,}\s*$/gi, '')

    // Remove website domains
    cleaned = cleaned.replace(/\s+\S+\.co(m)?\s*/gi, ' ')

    // Remove prefixes like "TST*", "SQ *", etc.
    cleaned = cleaned.replace(/^[A-Z]+\*\s*/g, '')

    // Remove "ending in XXXX" patterns
    cleaned = cleaned.replace(/\s*ending in \d+/gi, '')

    // Remove repeating words (e.g., "HEADWAY HEADWAY.CO" -> "HEADWAY")
    const words = cleaned.split(/\s+/)
    const seenWords = new Set<string>()
    const uniqueWords: string[] = []
    words.forEach((word) => {
      const lower = word.toLowerCase().replace(/[^\w]/g, '')
      if (lower && !seenWords.has(lower)) {
        seenWords.add(lower)
        uniqueWords.push(word)
      }
    })
    cleaned = uniqueWords.join(' ')

    // Convert to title case (first letter of each word capitalized)
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())

    // Final cleanup
    cleaned = cleaned.trim().replace(/\s+/g, ' ')

    return cleaned
  }

  // Find similar vendors using fuzzy matching
  const findSimilarVendors = (cleanedName: string): string[] => {
    const existing = appData.transactions.map((t) => t.description.trim())
    const unique = Array.from(new Set(existing))

    const cleanedLower = cleanedName.toLowerCase()
    const similar: string[] = []

    unique.forEach((vendor) => {
      const vendorLower = vendor.toLowerCase()

      // Check if one contains the other or they're very similar
      if (vendorLower.includes(cleanedLower) || cleanedLower.includes(vendorLower)) {
        similar.push(vendor)
      } else {
        // Check for similar words
        const cleanedWords = cleanedLower.split(/\s+/)
        const vendorWords = vendorLower.split(/\s+/)
        const matchingWords = cleanedWords.filter((w) => vendorWords.includes(w))

        // If more than half the words match, consider it similar
        if (matchingWords.length > 0 && matchingWords.length >= Math.min(cleanedWords.length, vendorWords.length) * 0.6) {
          similar.push(vendor)
        }
      }
    })

    return similar
  }

  // CSV Import handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return

    // Parse CSV (simple parser - handles quotes)
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0])
    const data = lines.slice(1).map(parseLine)

    setCsvHeaders(headers)
    setCsvData(data)
    setIsImportModalOpen(true)

    // Auto-detect common column names
    const mapping: {[key: string]: number | null} = {
      date: null,
      description: null,
      amount: null,
      category: null,
      account: null,
      notes: null,
    }

    headers.forEach((header, index) => {
      const lower = header.toLowerCase()
      if (lower.includes('date')) mapping.date = index
      else if (lower.includes('description') || lower.includes('memo') || lower.includes('payee')) mapping.description = index
      else if (lower.includes('amount') || lower.includes('debit') || lower.includes('credit')) mapping.amount = index
      else if (lower.includes('category')) mapping.category = index
      else if (lower.includes('account')) mapping.account = index
      else if (lower.includes('note')) mapping.notes = index
    })

    setColumnMapping(mapping)
  }

  const handleImportTransactions = () => {
    if (!columnMapping.date || columnMapping.description === null || columnMapping.amount === null) {
      alert('Please map at least Date, Description, and Amount columns')
      return
    }

    // Prepare all imports for processing
    const importsToProcess: any[] = []
    const errors: string[] = []

    csvData.forEach((row, index) => {
      try {
        // Parse date
        const dateStr = row[columnMapping.date!]
        let transactionDate: string
        try {
          // Try parsing the date
          const parsed = parseISO(dateStr)
          if (isNaN(parsed.getTime())) {
            // Try common formats
            const parts = dateStr.split('/')
            if (parts.length === 3) {
              // Assume MM/DD/YYYY
              const [month, day, year] = parts
              transactionDate = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            } else {
              throw new Error('Invalid date format')
            }
          } else {
            transactionDate = format(parsed, 'yyyy-MM-dd')
          }
        } catch {
          throw new Error(`Invalid date: ${dateStr}`)
        }

        // Parse amount
        const amountStr = row[columnMapping.amount!].replace(/[$,]/g, '')
        const amount = parseFloat(amountStr)
        if (isNaN(amount)) {
          throw new Error(`Invalid amount: ${row[columnMapping.amount!]}`)
        }

        // Get and standardize description
        const originalDescription = row[columnMapping.description!] || 'Imported Transaction'
        const cleanedDescription = standardizeVendorName(originalDescription)

        // Get optional fields
        const notes = columnMapping.notes !== null ? row[columnMapping.notes] : undefined

        // Find or use default account
        let accountId = appData.accounts[0]?.id
        if (columnMapping.account !== null && row[columnMapping.account]) {
          const accountName = row[columnMapping.account]
          const foundAccount = appData.accounts.find(
            (a) => a.name.toLowerCase() === accountName.toLowerCase()
          )
          if (foundAccount) accountId = foundAccount.id
        }

        // Find or use default category
        let categoryId = appData.categories[0]?.id
        if (columnMapping.category !== null && row[columnMapping.category]) {
          const categoryName = row[columnMapping.category]
          const foundCategory = appData.categories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase()
          )
          if (foundCategory) categoryId = foundCategory.id
        }

        if (!accountId || !categoryId) {
          throw new Error('No accounts or categories available')
        }

        // Determine budget type from account
        const account = appData.accounts.find((a) => a.id === accountId)
        const budgetType = account?.budgetType || 'household'

        // Store import data for processing
        importsToProcess.push({
          rowIndex: index,
          date: transactionDate,
          originalDescription,
          cleanedDescription,
          amount,
          categoryId,
          accountId,
          budgetType,
          notes,
        })
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    // Close CSV modal
    setIsImportModalOpen(false)

    // If there are errors, show them
    if (errors.length > 0 && importsToProcess.length === 0) {
      alert(`Failed to import transactions.\n\nErrors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}`)
      setCsvData([])
      setCsvHeaders([])
      setColumnMapping({
        date: null,
        description: null,
        amount: null,
        category: null,
        account: null,
        notes: null,
      })
      return
    }

    // Start processing imports with vendor matching
    setPendingImports(importsToProcess)
    setCurrentImportIndex(0)
    processNextImport(importsToProcess, 0, errors)
  }

  const processNextImport = (imports: any[], index: number, errors: string[]) => {
    if (index >= imports.length) {
      // All done
      const importedCount = imports.length
      setCsvData([])
      setCsvHeaders([])
      setColumnMapping({
        date: null,
        description: null,
        amount: null,
        category: null,
        account: null,
        notes: null,
      })
      setPendingImports([])
      setCurrentImportIndex(0)

      if (errors.length > 0) {
        alert(`Imported ${importedCount - errors.length} of ${importedCount} transactions.\n\nErrors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}`)
      } else {
        alert(`Successfully imported ${importedCount} transactions!`)
      }
      return
    }

    // Update progress indicator
    setCurrentImportIndex(index)

    const importData = imports[index]
    const similarVendors = findSimilarVendors(importData.cleanedDescription)

    if (similarVendors.length > 0 && !similarVendors.includes(importData.cleanedDescription)) {
      // Show vendor matching modal
      setPendingImport({
        cleanedDescription: importData.cleanedDescription,
        originalDescription: importData.originalDescription,
        similarVendors,
        rowData: importData,
        index, // Store the index with the pending import
      })
      setEditableStandardizedName(importData.cleanedDescription)
      setVendorMatchModalOpen(true)
    } else {
      // No similar vendors, just import with cleaned description
      addTransaction({
        date: importData.date,
        description: importData.cleanedDescription,
        amount: importData.amount,
        categoryId: importData.categoryId,
        accountId: importData.accountId,
        budgetType: importData.budgetType,
        reconciled: false,
        taxDeductible: false,
        notes: importData.notes,
      })
      processNextImport(imports, index + 1, errors)
    }
  }

  const handleVendorMatch = (selectedVendor: string) => {
    if (!pendingImport) return

    // Import with selected vendor name
    addTransaction({
      date: pendingImport.rowData.date,
      description: selectedVendor,
      amount: pendingImport.rowData.amount,
      categoryId: pendingImport.rowData.categoryId,
      accountId: pendingImport.rowData.accountId,
      budgetType: pendingImport.rowData.budgetType,
      reconciled: false,
      taxDeductible: false,
      notes: pendingImport.rowData.notes,
    })

    const nextIndex = pendingImport.index + 1

    setVendorMatchModalOpen(false)
    setPendingImport(null)

    // Process next import using the stored index
    processNextImport(pendingImports, nextIndex, [])
  }

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = Math.abs(
      filteredTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )
    return { income, expenses, net: income - expenses }
  }, [filteredTransactions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-2">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
            <Upload className="w-5 h-5 mr-2" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Income</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(totals.income)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(totals.expenses)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Net</p>
          <p
            className={`text-2xl font-bold mt-2 ${
              totals.net >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(totals.net)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Budget Type Filter */}
          {currentView === 'combined' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget Type
              </label>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value as BudgetFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="household">Household</option>
                <option value="business">Business</option>
              </select>
            </div>
          )}

          {/* Account Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account
            </label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Accounts</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(availableCategories).map(([groupKey, categories]) => {
                // Handle business_expenses:GroupName format
                let groupLabel: string
                if (groupKey.startsWith('business_expenses:')) {
                  groupLabel = groupKey.split(':')[1] // e.g., "Travel & Performance"
                } else {
                  groupLabel = groupKey === 'income' ? 'Income' :
                               groupKey === 'needs' ? 'Needs' :
                               groupKey === 'wants' ? 'Wants' :
                               groupKey === 'savings' ? 'Savings' :
                               groupKey === 'business_expenses' ? 'Business Expenses' :
                               groupKey === 'operating' ? 'Operating' :
                               groupKey === 'growth' ? 'Growth' :
                               groupKey === 'compensation' ? 'Compensation' :
                               groupKey === 'tax_reserve' ? 'Tax Reserve' :
                               groupKey === 'business_savings' ? 'Business Savings' : groupKey
                }
                return (
                  <optgroup key={groupKey} label={groupLabel}>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <select
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value as TransactionTypeFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Transactions</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTransactionIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900">
              {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenBulkEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Bulk Edit
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-lg">No transactions found.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reconciled?
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To/From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const account = appData.accounts.find((a) => a.id === transaction.accountId)
                  const category = appData.categories.find((c) => c.id === transaction.categoryId)

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTransactionIds.has(transaction.id)}
                          onChange={() => handleSelectTransaction(transaction.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      {/* Reconciled - Checkbox */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={transaction.reconciled}
                          onChange={() => updateTransaction(transaction.id, { reconciled: !transaction.reconciled })}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                          title={transaction.reconciled ? "Mark as unreconciled" : "Mark as reconciled"}
                        />
                      </td>
                      {/* Date - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'date' ? (
                          <input
                            type="date"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'date')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'date')}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <p
                            className="text-sm text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                            onClick={() => startInlineEdit(transaction.id, 'date', transaction.date)}
                          >
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </td>

                      {/* Description - Editable */}
                      <td className="px-6 py-4">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'description' ? (
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'description')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'description')}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div>
                            <p
                              className="text-sm font-medium text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                              onClick={() => startInlineEdit(transaction.id, 'description', transaction.description)}
                            >
                              {transaction.description}
                            </p>
                            {transaction.notes && (
                              <p className="text-xs text-gray-500 mt-1">
                                {transaction.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {transaction.linkedTransactionId && (
                                <div className="flex items-center">
                                  <Link2 className="w-3 h-3 text-blue-500 mr-1" />
                                  <span className="text-xs text-blue-600">Linked</span>
                                </div>
                              )}
                              {transaction.taxDeductible && (
                                <div className="flex items-center">
                                  <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                                  <span className="text-xs text-green-600">Tax Deductible</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Account - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'accountId' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'accountId')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'accountId')}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            {availableAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p
                            className="text-sm text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                            onClick={() => startInlineEdit(transaction.id, 'accountId', transaction.accountId)}
                          >
                            {account?.name || 'Unknown'}
                          </p>
                        )}
                      </td>

                      {/* Category - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'categoryId' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'categoryId')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'categoryId')}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            {Object.entries(availableCategories).map(([groupKey, cats]) => {
                              // Handle business_expenses:GroupName format
                              let groupLabel: string
                              if (groupKey.startsWith('business_expenses:')) {
                                groupLabel = groupKey.split(':')[1] // e.g., "Travel & Performance"
                              } else {
                                groupLabel = groupKey === 'income' ? 'Income' :
                                             groupKey === 'needs' ? 'Needs' :
                                             groupKey === 'wants' ? 'Wants' :
                                             groupKey === 'savings' ? 'Savings' :
                                             groupKey === 'business_expenses' ? 'Business Expenses' :
                                             groupKey === 'operating' ? 'Operating' :
                                             groupKey === 'growth' ? 'Growth' :
                                             groupKey === 'compensation' ? 'Compensation' :
                                             groupKey === 'tax_reserve' ? 'Tax Reserve' :
                                             groupKey === 'business_savings' ? 'Business Savings' : groupKey
                              }
                              return (
                                <optgroup key={groupKey} label={groupLabel}>
                                  {cats.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )
                            })}
                          </select>
                        ) : (
                          <p
                            className="text-sm text-gray-900 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                            onClick={() => startInlineEdit(transaction.id, 'categoryId', transaction.categoryId)}
                          >
                            {category?.name || 'Uncategorized'}
                          </p>
                        )}
                      </td>

                      {/* Budget Type - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'budgetType' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'budgetType')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'budgetType')}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="household">Household</option>
                            <option value="business">Business</option>
                          </select>
                        ) : (
                          <div
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => startInlineEdit(transaction.id, 'budgetType', transaction.budgetType)}
                          >
                            <BudgetBadge budgetType={transaction.budgetType} />
                          </div>
                        )}
                      </td>

                      {/* Amount - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {editingCell?.transactionId === transaction.id && editingCell?.field === 'amount' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveInlineEdit(transaction.id, 'amount')}
                            onKeyDown={(e) => handleInlineKeyDown(e, transaction.id, 'amount')}
                            autoFocus
                            className="w-full px-2 py-1 text-sm text-right border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <p
                            className={`text-sm font-medium cursor-pointer hover:bg-blue-50 px-2 py-1 rounded ${
                              transaction.amount >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                            onClick={() => startInlineEdit(transaction.id, 'amount', transaction.amount)}
                          >
                            {transaction.amount >= 0 ? '+' : ''}
                            {formatCurrency(transaction.amount)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(transaction)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit transaction"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Transaction"
        size="lg"
      >
        <TransactionForm
          accounts={appData.accounts}
          categories={appData.categories}
          onSubmit={handleAddTransaction}
          onCancel={() => setIsAddModalOpen(false)}
          defaultBudgetType={
            currentView !== 'combined' ? (currentView as BudgetType) : 'household'
          }
        />
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Edit Transaction"
        size="lg"
      >
        {selectedTransaction && (
          <>
            {selectedTransaction.linkedTransactionId && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Link2 className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">
                      This transaction is linked
                    </h4>
                    <p className="text-xs text-blue-700">
                      When you save changes, you'll be asked if you want to update both linked transactions or just this one.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <TransactionForm
              transaction={selectedTransaction}
              accounts={appData.accounts}
              categories={appData.categories}
              onSubmit={handleEditTransaction}
              onCancel={() => {
                setIsEditModalOpen(false)
                setSelectedTransaction(null)
              }}
              defaultBudgetType={selectedTransaction.budgetType}
            />
          </>
        )}
      </Modal>

      {/* Bulk Edit Modal */}
      <Modal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        title={`Bulk Edit ${selectedTransactionIds.size} Transactions`}
        size="lg"
      >
        <BulkEditForm
          transactionCount={selectedTransactionIds.size}
          accounts={appData.accounts}
          categories={appData.categories}
          onSubmit={handleBulkEdit}
          onCancel={() => setIsBulkEditModalOpen(false)}
        />
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setCsvData([])
          setCsvHeaders([])
        }}
        title="Import CSV Transactions"
        size="xl"
      >
        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Import Instructions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Map the CSV columns to transaction fields below</li>
              <li>Date, Description, and Amount are required fields</li>
              <li>Date format can be YYYY-MM-DD or MM/DD/YYYY</li>
              <li>Negative amounts indicate expenses, positive for income</li>
              <li>If Category or Account name matches existing, it will be linked automatically</li>
            </ul>
          </div>

          {/* Column Mapping */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Map CSV Columns</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date * <span className="text-red-500">(Required)</span>
                </label>
                <select
                  value={columnMapping.date ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    date: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description * <span className="text-red-500">(Required)</span>
                </label>
                <select
                  value={columnMapping.description ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    description: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount * <span className="text-red-500">(Required)</span>
                </label>
                <select
                  value={columnMapping.amount ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    amount: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category (Optional)
                </label>
                <select
                  value={columnMapping.category ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    category: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Skip Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account (Optional)
                </label>
                <select
                  value={columnMapping.account ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    account: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Skip Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <select
                  value={columnMapping.notes ?? ''}
                  onChange={(e) => setColumnMapping({
                    ...columnMapping,
                    notes: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Skip Column --</option>
                  {csvHeaders.map((header, index) => (
                    <option key={index} value={index}>
                      {header} ({csvData[0]?.[index] || 'empty'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-auto">
              <p className="text-sm text-gray-600 mb-2">
                {csvData.length} row{csvData.length !== 1 ? 's' : ''} will be imported
              </p>
              {csvData.length > 0 && (
                <div className="text-xs text-gray-700">
                  <strong>First row example:</strong>
                  <ul className="mt-1 space-y-1">
                    {columnMapping.date !== null && (
                      <li><strong>Date:</strong> {csvData[0][columnMapping.date]}</li>
                    )}
                    {columnMapping.description !== null && (
                      <li><strong>Description:</strong> {csvData[0][columnMapping.description]}</li>
                    )}
                    {columnMapping.amount !== null && (
                      <li><strong>Amount:</strong> {csvData[0][columnMapping.amount]}</li>
                    )}
                    {columnMapping.category !== null && (
                      <li><strong>Category:</strong> {csvData[0][columnMapping.category]}</li>
                    )}
                    {columnMapping.account !== null && (
                      <li><strong>Account:</strong> {csvData[0][columnMapping.account]}</li>
                    )}
                    {columnMapping.notes !== null && (
                      <li><strong>Notes:</strong> {csvData[0][columnMapping.notes]}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setIsImportModalOpen(false)
                setCsvData([])
                setCsvHeaders([])
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImportTransactions}
              disabled={!columnMapping.date || columnMapping.description === null || columnMapping.amount === null}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {csvData.length} Transaction{csvData.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* Vendor Match Modal */}
      <Modal
        isOpen={vendorMatchModalOpen}
        onClose={() => setVendorMatchModalOpen(false)}
        title="Match Vendor/Payee"
        size="lg"
      >
        {pendingImport && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Similar Vendor Found</h3>
              <p className="text-sm text-blue-800">
                The imported description has been standardized. We found similar existing vendors.
                Please select if this is the same vendor or create a new one.
              </p>
            </div>

            {/* Original Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Import:
              </label>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                {pendingImport.originalDescription}
              </p>
            </div>

            {/* Cleaned Description - Editable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standardized Name (editable):
              </label>
              <input
                type="text"
                value={editableStandardizedName}
                onChange={(e) => setEditableStandardizedName(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-900 bg-white border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                placeholder="Edit vendor name..."
              />
              <p className="text-xs text-gray-500 mt-1">
                You can edit this name before creating it as a new vendor
              </p>
            </div>

            {/* Similar Vendors */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select vendor/payee:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Option: Use new standardized name */}
                <button
                  onClick={() => handleVendorMatch(editableStandardizedName)}
                  disabled={!editableStandardizedName.trim()}
                  className="w-full text-left px-4 py-3 bg-blue-50 border-2 border-blue-300 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">
                        {editableStandardizedName || '(empty)'}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">Create as new vendor</p>
                    </div>
                    <div className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                      NEW
                    </div>
                  </div>
                </button>

                {/* Existing similar vendors */}
                {pendingImport.similarVendors.map((vendor, index) => (
                  <button
                    key={index}
                    onClick={() => handleVendorMatch(vendor)}
                    className="w-full text-left px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{vendor}</p>
                        <p className="text-xs text-gray-500 mt-1">Use existing vendor</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress indicator */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Processing transaction {currentImportIndex + 1} of {pendingImports.length}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Transaction Form Component
interface TransactionFormProps {
  transaction?: Transaction
  accounts: Account[]
  categories: any[]
  onSubmit: (transaction: any) => void
  onCancel: () => void
  defaultBudgetType: BudgetType
}

function TransactionForm({
  transaction,
  accounts,
  categories,
  onSubmit,
  onCancel,
  defaultBudgetType,
}: TransactionFormProps) {
  const { appData } = useBudget()

  // Combine legacy income and new incomeSources for dropdown
  const allIncomeSources = useMemo(() => {
    const sources: Array<{ id: string; name: string; budgetType: BudgetType }> = []

    // Add new IncomeSource records
    appData.incomeSources
      .filter((source) => source.isActive)
      .forEach((source) => {
        sources.push({
          id: source.id,
          name: source.name,
          budgetType: source.budgetType,
        })
      })

    // Add legacy Income records
    appData.income.forEach((income) => {
      sources.push({
        id: income.id,
        name: income.source,
        budgetType: income.budgetType,
      })
    })

    return sources.sort((a, b) => a.name.localeCompare(b.name))
  }, [appData.incomeSources, appData.income])

  const [formData, setFormData] = useState({
    date: transaction?.date || new Date().toISOString().split('T')[0],
    description: transaction?.description || '',
    amount: transaction?.amount ? Math.abs(transaction.amount).toString() : '',
    transactionType: transaction?.toAccountId ? 'transfer' : transaction?.amount ? (transaction.amount >= 0 ? 'income' : 'expense') : 'expense',
    accountId: transaction?.accountId || '',
    toAccountId: transaction?.toAccountId || '',
    categoryId: transaction?.categoryId || '',
    budgetType: transaction?.budgetType || defaultBudgetType,
    taxDeductible: transaction?.taxDeductible || false,
    incomeSourceId: transaction?.incomeSourceId || '',
    notes: transaction?.notes || '',
    linkingOption: 'create_paired' as 'create_paired' | 'link_existing' | 'no_link',
    linkedTransactionId: transaction?.linkedTransactionId || '',
  })

  // Get unique vendors from past transactions
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>()
    appData.transactions.forEach(t => {
      if (t.description && t.description.trim()) {
        vendors.add(t.description.trim())
      }
    })
    return Array.from(vendors).sort()
  }, [appData.transactions])

  // Get last category used for each vendor
  const vendorCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    // Sort transactions by date (newest first)
    const sortedTransactions = [...appData.transactions].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    // For each vendor, store the most recent category used
    sortedTransactions.forEach(t => {
      const vendor = t.description?.trim()
      if (vendor && t.categoryId && !map.has(vendor)) {
        map.set(vendor, t.categoryId)
      }
    })
    return map
  }, [appData.transactions])

  // Handle vendor selection/change
  const handleVendorChange = (newVendor: string) => {
    setFormData(prev => {
      const updates: any = { ...prev, description: newVendor }
      // Auto-populate category if this vendor was used before
      const lastCategory = vendorCategoryMap.get(newVendor.trim())
      if (lastCategory && !prev.categoryId) {
        updates.categoryId = lastCategory
      }
      return updates
    })
  }

  // Check if should show income source field (for income transactions and transfers to checking)
  const showIncomeSource = useMemo(() => {
    // Show for income transactions
    if (formData.transactionType === 'income') {
      return true
    }
    // Show for transfers to checking accounts
    if (formData.transactionType === 'transfer' && formData.toAccountId) {
      const destAccount = accounts.find(a => a.id === formData.toAccountId)
      return destAccount?.accountType === 'checking'
    }
    return false
  }, [formData.transactionType, formData.toAccountId, formData.accountId, accounts])

  // Find potential matching transactions for linking (opposite amount in destination account)
  const potentialMatches = useMemo(() => {
    if (formData.transactionType !== 'transfer' || !formData.toAccountId || !formData.amount) {
      return []
    }

    const transferAmount = parseFloat(formData.amount)
    if (isNaN(transferAmount)) return []

    // Look for transactions in the destination account with opposite amount
    const oppositeAmount = Math.abs(transferAmount)

    return appData.transactions
      .filter((t) => {
        // Must be in the destination account
        if (t.accountId !== formData.toAccountId) return false

        // Must have opposite amount (positive, since we're looking for inflow to destination)
        if (Math.abs(t.amount) !== oppositeAmount) return false
        if (t.amount <= 0) return false // Must be positive (inflow)

        // Should not already be linked (unless it's the current transaction being edited)
        if (t.linkedTransactionId && t.id !== transaction?.linkedTransactionId) return false

        // Exclude the current transaction if editing
        if (transaction && t.id === transaction.id) return false

        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // Sort by date, newest first
  }, [formData.transactionType, formData.toAccountId, formData.amount, appData.transactions, transaction])


  // Show all accounts (cross-view access)
  const filteredAccounts = accounts

  // Filter categories based on selected budget type
  const filteredCategories = categories.filter((c) => {
    if (c.budgetType !== formData.budgetType || !c.isActive) return false

    // Show only income categories for income transactions
    if (formData.transactionType === 'income') {
      return c.isIncomeCategory === true
    }

    // For transfers and expenses, show all non-income categories (including Transfer/Payment)
    return !c.isIncomeCategory
  })

  // Group categories by bucket/group for organized display
  const groupedCategories = useMemo(() => {
    const incomeCategories = filteredCategories.filter((c) => c.isIncomeCategory)
    const regularCategories = filteredCategories.filter((c) => !c.isIncomeCategory)

    const grouped: { [key: string]: typeof filteredCategories } = {}

    // Add income categories as a special group
    if (incomeCategories.length > 0) {
      grouped['income'] = incomeCategories.sort((a, b) => a.name.localeCompare(b.name))
    }

    regularCategories.forEach((cat) => {
      // For business_expenses with categoryGroup, group by categoryGroup instead of bucket
      const groupKey = cat.bucketId === 'business_expenses' && cat.categoryGroup
        ? `business_expenses:${cat.categoryGroup}`
        : cat.bucketId

      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(cat)
    })

    // Sort categories within each group alphabetically
    Object.keys(grouped).forEach((groupKey) => {
      if (groupKey !== 'income') {
        grouped[groupKey].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    return grouped
  }, [filteredCategories])

  // When account changes in a NEW transaction, default budget type to match account
  // For existing transactions, keep the budget type as-is (allow independent editing)
  const handleAccountChange = (accountId: string) => {
    const selectedAccount = accounts.find((a) => a.id === accountId)

    // Only auto-set budget type for NEW transactions (no existing transaction prop)
    if (!transaction && selectedAccount && selectedAccount.budgetType !== formData.budgetType) {
      const categoryMatches = categories.find(
        (c) => c.id === formData.categoryId && c.budgetType === selectedAccount.budgetType
      )

      setFormData({
        ...formData,
        accountId,
        budgetType: selectedAccount.budgetType,
        categoryId: categoryMatches ? formData.categoryId : '',
      })
    } else {
      // For existing transactions, just update the account without changing budget type
      setFormData({ ...formData, accountId })
    }
  }

  // When budget type changes, reset category if it doesn't match
  const handleBudgetTypeChange = (newBudgetType: BudgetType) => {
    const categoryMatches = categories.find(
      (c) => c.id === formData.categoryId && c.budgetType === newBudgetType
    )

    setFormData({
      ...formData,
      budgetType: newBudgetType,
      categoryId: categoryMatches ? formData.categoryId : '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(formData.amount) || 0
    let signedAmount = amount

    if (formData.transactionType === 'income') {
      signedAmount = Math.abs(amount)
    } else if (formData.transactionType === 'expense') {
      signedAmount = -Math.abs(amount)
    } else if (formData.transactionType === 'transfer') {
      signedAmount = -Math.abs(amount) // Deduct from source account
    }

    const transactionData: any = {
      date: formData.date,
      description: formData.description,
      amount: signedAmount,
      accountId: formData.accountId,
      categoryId: formData.categoryId || 'uncategorized',
      budgetType: formData.budgetType,
      taxDeductible: formData.taxDeductible,
      notes: formData.notes || undefined,
    }

    // Add toAccountId for transfers
    if (formData.transactionType === 'transfer' && formData.toAccountId) {
      transactionData.toAccountId = formData.toAccountId

      // Add incomeSourceId if destination is checking and source is selected
      if (formData.incomeSourceId) {
        transactionData.incomeSourceId = formData.incomeSourceId
      }

      // Add linking information
      transactionData.linkingOption = formData.linkingOption
      if (formData.linkingOption === 'link_existing' && formData.linkedTransactionId) {
        transactionData.linkedTransactionId = formData.linkedTransactionId
      }
    }

    onSubmit(transactionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date *
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Transaction Type */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type *
          </label>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="expense"
                checked={formData.transactionType === 'expense'}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', toAccountId: '' })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Expense
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="income"
                checked={formData.transactionType === 'income'}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', toAccountId: '' })}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Income
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="transfer"
                checked={formData.transactionType === 'transfer'}
                onChange={(e) => {
                  const transferCategory = filteredCategories.find(c => c.name === 'Transfer/Payment')
                  setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', categoryId: transferCategory?.id || '' })
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Transfer/Payment
              </span>
            </label>
          </div>
        </div>

        {/* To/From (Vendor/Payee) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To/From *
          </label>
          <input
            type="text"
            required
            list="vendor-list"
            value={formData.description}
            onChange={(e) => handleVendorChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Vendor or payee name"
          />
          <datalist id="vendor-list">
            {uniqueVendors.map((vendor) => (
              <option key={vendor} value={vendor} />
            ))}
          </datalist>
          <p className="text-xs text-gray-500 mt-1">
            Start typing to see previous vendors/payees
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Budget Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Budget Type *
          </label>
          <select
            required
            value={formData.budgetType}
            onChange={(e) => handleBudgetTypeChange(e.target.value as BudgetType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="household">Household</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.transactionType === 'transfer' ? 'From Account *' : 'Account *'}
          </label>
          <select
            required
            value={formData.accountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select account...</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.budgetType === 'household' ? 'H' : 'B'})
              </option>
            ))}
          </select>
        </div>

        {/* To Account (for transfers only) */}
        {formData.transactionType === 'transfer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Account *
            </label>
            <select
              required
              value={formData.toAccountId}
              onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select destination account...</option>
              {filteredAccounts
                .filter((account) => account.id !== formData.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.budgetType === 'household' ? 'H' : 'B'})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Transaction Linking Options (for transfers only) */}
        {formData.transactionType === 'transfer' && formData.toAccountId && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Linking
            </label>
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="linkingOption"
                  value="create_paired"
                  checked={formData.linkingOption === 'create_paired'}
                  onChange={() => setFormData({ ...formData, linkingOption: 'create_paired', linkedTransactionId: '' })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    Create paired transaction (Recommended)
                  </span>
                  <span className="block text-xs text-gray-600">
                    Automatically create a matching transaction in the destination account
                  </span>
                </span>
              </label>

              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="linkingOption"
                  value="link_existing"
                  checked={formData.linkingOption === 'link_existing'}
                  onChange={() => setFormData({ ...formData, linkingOption: 'link_existing' })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    Link to existing transaction
                  </span>
                  <span className="block text-xs text-gray-600">
                    Connect to a transaction already in the destination account
                  </span>
                </span>
              </label>

              {formData.linkingOption === 'link_existing' && (
                <div className="ml-7 mt-2">
                  <select
                    value={formData.linkedTransactionId}
                    onChange={(e) => setFormData({ ...formData, linkedTransactionId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select a transaction to link...</option>
                    {potentialMatches.length === 0 ? (
                      <option value="" disabled>No matching transactions found</option>
                    ) : (
                      potentialMatches.map((t) => (
                        <option key={t.id} value={t.id}>
                          {format(parseISO(t.date), 'MMM dd, yyyy')} - {t.description} - {formatCurrency(t.amount)}
                        </option>
                      ))
                    )}
                  </select>
                  {potentialMatches.length === 0 && formData.amount && (
                    <p className="text-xs text-amber-600 mt-1">
                      No matching transactions found with amount ${formData.amount} in destination account
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  name="linkingOption"
                  value="no_link"
                  checked={formData.linkingOption === 'no_link'}
                  onChange={() => setFormData({ ...formData, linkingOption: 'no_link', linkedTransactionId: '' })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    Don't create or link
                  </span>
                  <span className="block text-xs text-gray-600">
                    This transfer will only appear in the source account
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Income Source (for income transactions and transfers to checking accounts) */}
        {showIncomeSource && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Source
              <span className="text-xs text-gray-500 ml-2">(Optional - for income tracking)</span>
            </label>
            <select
              value={formData.incomeSourceId}
              onChange={(e) => setFormData({ ...formData, incomeSourceId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None (not tracked as income)</option>
              {allIncomeSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.budgetType === 'household' ? 'H' : 'B'})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Link this transfer to an income source to track it in Income Tracking
            </p>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Auto-categorize</option>
            {Object.entries(groupedCategories).map(([groupKey, cats]) => {
              // Handle business_expenses:GroupName format
              let groupLabel: string
              if (groupKey.startsWith('business_expenses:')) {
                groupLabel = groupKey.split(':')[1] // e.g., "Travel & Performance"
              } else {
                groupLabel = groupKey === 'income' ? 'Income' :
                             groupKey === 'needs' ? 'Needs' :
                             groupKey === 'wants' ? 'Wants' :
                             groupKey === 'savings' ? 'Savings' :
                             groupKey === 'business_expenses' ? 'Business Expenses' :
                             groupKey === 'operating' ? 'Operating' :
                             groupKey === 'growth' ? 'Growth' :
                             groupKey === 'compensation' ? 'Compensation' :
                             groupKey === 'tax_reserve' ? 'Tax Reserve' :
                             groupKey === 'business_savings' ? 'Business Savings' : groupKey
              }
              return (
                <optgroup key={groupKey} label={groupLabel}>
                  {cats.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          {formData.transactionType === 'transfer' && (
            <p className="text-xs text-gray-500 mt-1">
              Select "Transfer/Payment" to exclude from budget, or choose a regular category to include in budget
            </p>
          )}
        </div>

        {/* Tax Deductible */}
        {formData.budgetType === 'business' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="taxDeductible"
              checked={formData.taxDeductible}
              onChange={(e) =>
                setFormData({ ...formData, taxDeductible: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="taxDeductible"
              className="ml-2 text-sm font-medium text-gray-700"
            >
              Tax Deductible
            </label>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional notes..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {transaction ? 'Update Transaction' : 'Add Transaction'}
        </button>
      </div>
    </form>
  )
}

// Bulk Edit Form Component
interface BulkEditFormProps {
  transactionCount: number
  accounts: Account[]
  categories: any[]
  onSubmit: (updates: Partial<Transaction>) => void
  onCancel: () => void
}

function BulkEditForm({ transactionCount, accounts, categories, onSubmit, onCancel }: BulkEditFormProps) {
  const [formData, setFormData] = useState<{
    date?: string
    description?: string
    amount?: string
    categoryId?: string
    accountId?: string
    budgetType?: BudgetType
    taxDeductible?: boolean
    notes?: string
  }>({})

  // Group categories by bucket/group for organized display
  const groupedCategories = useMemo(() => {
    const activeCategories = categories.filter((c) => c.isActive)
    const incomeCategories = activeCategories.filter((c) => c.isIncomeCategory)
    const regularCategories = activeCategories.filter((c) => !c.isIncomeCategory)

    const grouped: { [key: string]: typeof activeCategories } = {}

    // Add income categories as a special group
    if (incomeCategories.length > 0) {
      grouped['income'] = incomeCategories.sort((a, b) => a.name.localeCompare(b.name))
    }

    regularCategories.forEach((cat) => {
      // For business_expenses with categoryGroup, group by categoryGroup instead of bucket
      const groupKey = cat.bucketId === 'business_expenses' && cat.categoryGroup
        ? `business_expenses:${cat.categoryGroup}`
        : cat.bucketId

      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(cat)
    })

    // Sort categories within each group alphabetically
    Object.keys(grouped).forEach((groupKey) => {
      if (groupKey !== 'income') {
        grouped[groupKey].sort((a, b) => a.name.localeCompare(b.name))
      }
    })

    return grouped
  }, [categories])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Only include fields that have been set
    const updates: Partial<Transaction> = {}
    if (formData.date) updates.date = formData.date
    if (formData.description) updates.description = formData.description
    if (formData.amount) {
      const amount = parseFloat(formData.amount)
      if (!isNaN(amount)) {
        updates.amount = amount
      }
    }
    if (formData.categoryId) updates.categoryId = formData.categoryId
    if (formData.accountId) updates.accountId = formData.accountId
    if (formData.budgetType) updates.budgetType = formData.budgetType
    if (formData.taxDeductible !== undefined) updates.taxDeductible = formData.taxDeductible
    if (formData.notes) updates.notes = formData.notes

    if (Object.keys(updates).length === 0) {
      alert('Please select at least one field to update')
      return
    }

    onSubmit(updates)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Select the fields you want to update for {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}.
          Only selected fields will be updated - leave others blank to keep existing values.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date (optional)
          </label>
          <input
            type="date"
            value={formData.date || ''}
            onChange={(e) => setFormData({ ...formData, date: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value || undefined })}
            placeholder="-- Keep Current --"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount (optional)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value || undefined })}
            placeholder="-- Keep Current --"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account (optional)
          </label>
          <select
            value={formData.accountId || ''}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Keep Current --</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category (optional)
        </label>
        <select
          value={formData.categoryId || ''}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Keep Current --</option>
          {Object.entries(groupedCategories).map(([groupKey, cats]) => {
            // Handle business_expenses:GroupName format
            let groupLabel: string
            if (groupKey.startsWith('business_expenses:')) {
              groupLabel = groupKey.split(':')[1] // e.g., "Travel & Performance"
            } else {
              groupLabel = groupKey === 'income' ? 'Income' :
                           groupKey === 'needs' ? 'Needs' :
                           groupKey === 'wants' ? 'Wants' :
                           groupKey === 'savings' ? 'Savings' :
                           groupKey === 'business_expenses' ? 'Business Expenses' :
                           groupKey === 'operating' ? 'Operating' :
                           groupKey === 'growth' ? 'Growth' :
                           groupKey === 'compensation' ? 'Compensation' :
                           groupKey === 'tax_reserve' ? 'Tax Reserve' :
                           groupKey === 'business_savings' ? 'Business Savings' : groupKey
            }
            return (
              <optgroup key={groupKey} label={groupLabel}>
                {cats.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      {/* Budget Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Budget Type (optional)
        </label>
        <select
          value={formData.budgetType || ''}
          onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as BudgetType || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Keep Current --</option>
          <option value="household">Household</option>
          <option value="business">Business</option>
        </select>
      </div>

      {/* Tax Deductible */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tax Deductible (optional)
        </label>
        <select
          value={formData.taxDeductible === undefined ? '' : formData.taxDeductible.toString()}
          onChange={(e) => {
            const value = e.target.value
            setFormData({
              ...formData,
              taxDeductible: value === '' ? undefined : value === 'true'
            })
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Keep Current --</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
          rows={3}
          placeholder="-- Keep Current --"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Update {transactionCount} Transaction{transactionCount !== 1 ? 's' : ''}
        </button>
      </div>
    </form>
  )
}
