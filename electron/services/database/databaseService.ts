import { app } from 'electron'
import { createSchema, applyMigrations } from './schema'

/**
 * Local SQLite database service for Dual Budget Tracker
 * Handles all database operations with better-sqlite3
 *
 * Database constructor is passed from main.ts to avoid module resolution issues
 */
class DatabaseService {
  private db: any | null = null
  private dbPath: string = ''
  private DatabaseConstructor: any

  constructor(DatabaseConstructor: any) {
    this.DatabaseConstructor = DatabaseConstructor
  }

  /**
   * Initialize the database connection
   * Uses Electron's userData directory
   */
  async initialize(): Promise<void> {
    try {
      // Get database path from Electron's userData directory
      const userDataPath = app.getPath('userData')
      this.dbPath = `${userDataPath}/dual-budget-tracker.db`

      // Open database connection
      this.db = new this.DatabaseConstructor(this.dbPath)

      // Enable WAL mode for better concurrent performance
      this.db.pragma('journal_mode = WAL')

      // Create schema if needed
      createSchema(this.db)

      // Apply any pending migrations
      applyMigrations(this.db)

      console.log(`Database initialized at: ${this.dbPath}`)
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get the database instance
   */
  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  // ==================== Profile Operations ====================

  /**
   * Get all profiles
   */
  getAllProfiles() {
    const db = this.getDb()
    const stmt = db.prepare(`
      SELECT id, name, description, password_hash, password_hint,
             created_at, updated_at, last_accessed_at
      FROM profiles
      ORDER BY last_accessed_at DESC
    `)
    return stmt.all()
  }

  /**
   * Get a profile by ID
   */
  getProfile(id: string) {
    const db = this.getDb()
    const stmt = db.prepare(`
      SELECT id, name, description, password_hash, password_hint,
             created_at, updated_at, last_accessed_at
      FROM profiles
      WHERE id = ?
    `)
    return stmt.get(id)
  }

  /**
   * Create a new profile
   */
  createProfile(profile: {
    id: string
    name: string
    description?: string
    password_hash?: string
    password_hint?: string
  }) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      // Insert profile
      const profileStmt = db.prepare(`
        INSERT INTO profiles (id, name, description, password_hash, password_hint,
                             created_at, updated_at, last_accessed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      profileStmt.run(
        profile.id,
        profile.name,
        profile.description || null,
        profile.password_hash || null,
        profile.password_hint || null,
        now,
        now,
        now
      )

      // Create default settings for the profile
      const settingsStmt = db.prepare(`
        INSERT INTO settings (profile_id) VALUES (?)
      `)
      settingsStmt.run(profile.id)
    })

    transaction()
    return this.getProfile(profile.id)
  }

  /**
   * Update a profile
   */
  updateProfile(id: string, updates: {
    name?: string
    description?: string
    password_hash?: string
    password_hint?: string
  }) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?')
      values.push(updates.password_hash)
    }
    if (updates.password_hint !== undefined) {
      fields.push('password_hint = ?')
      values.push(updates.password_hint)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE profiles
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getProfile(id)
  }

  /**
   * Update profile last accessed time
   */
  updateProfileLastAccessed(id: string) {
    const db = this.getDb()
    const stmt = db.prepare(`
      UPDATE profiles
      SET last_accessed_at = ?
      WHERE id = ?
    `)
    stmt.run(new Date().toISOString(), id)
  }

  /**
   * Delete a profile and all associated data (CASCADE)
   */
  deleteProfile(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('DELETE FROM profiles WHERE id = ?')
    stmt.run(id)
  }

  // ==================== Settings Operations ====================

  /**
   * Get settings for a profile
   */
  getSettings(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM settings WHERE profile_id = ?')
    return stmt.get(profileId)
  }

  /**
   * Update settings for a profile
   */
  updateSettings(profileId: string, settings: Record<string, any>) {
    const db = this.getDb()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(settings).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    values.push(profileId)

    const stmt = db.prepare(`
      UPDATE settings
      SET ${fields.join(', ')}
      WHERE profile_id = ?
    `)
    stmt.run(...values)

    return this.getSettings(profileId)
  }

  // ==================== Account Operations ====================

  /**
   * Get all accounts for a profile (excluding soft-deleted)
   */
  getAccounts(profileId: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM accounts WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    query += ' ORDER BY name'

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Get all accounts for a profile including soft-deleted (for sync)
   */
  getAccountsForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM accounts WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Get an account by ID (excluding soft-deleted)
   */
  getAccount(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Create a new account
   */
  createAccount(account: {
    id: string
    profile_id: string
    name: string
    budget_type: string
    account_type: string
    balance?: number
    interest_rate?: number
    credit_limit?: number
    payment_due_date?: string
    minimum_payment?: number
    website_url?: string
    notes?: string
  }) {
    console.log('DatabaseService.createAccount called with:', account)
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, profile_id, name, budget_type, account_type, balance,
        interest_rate, credit_limit, payment_due_date, minimum_payment,
        website_url, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      account.id,
      account.profile_id,
      account.name,
      account.budget_type,
      account.account_type,
      account.balance || 0,
      account.interest_rate || null,
      account.credit_limit || null,
      account.payment_due_date || null,
      account.minimum_payment || null,
      account.website_url || null,
      account.notes || null,
      now,
      now
    )
    console.log('DatabaseService.createAccount insert result:', result)

    const created = this.getAccount(account.id)
    console.log('DatabaseService.createAccount returning:', created)
    return created
  }

  /**
   * Update an account
   */
  updateAccount(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE accounts
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getAccount(id)
  }

  /**
   * Delete an account (soft delete)
   */
  deleteAccount(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  /**
   * Get account by ID including soft-deleted (for sync)
   */
  getAccountForSync(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Update account including deleted_at (for sync)
   */
  updateAccountForSync(id: string, data: any) {
    const db = this.getDb()
    const stmt = db.prepare(`
      UPDATE accounts
      SET name = ?, budget_type = ?, account_type = ?, balance = ?,
          interest_rate = ?, credit_limit = ?, payment_due_date = ?,
          minimum_payment = ?, website_url = ?, notes = ?,
          deleted_at = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(
      data.name,
      data.budgetType,
      data.accountType,
      data.balance,
      data.interestRate,
      data.creditLimit,
      data.paymentDueDate,
      data.minimumPayment,
      data.websiteUrl,
      data.notes,
      data.deletedAt || null,
      data.updatedAt,
      id
    )
  }

  /**
   * Create account with deleted_at (for sync)
   */
  createAccountForSync(account: any) {
    const db = this.getDb()
    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, profile_id, name, budget_type, account_type, balance,
        interest_rate, credit_limit, payment_due_date, minimum_payment,
        website_url, notes, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const now = new Date().toISOString()
    stmt.run(
      account.id,
      account.profileId,
      account.name,
      account.budgetType,
      account.accountType,
      account.balance,
      account.interestRate,
      account.creditLimit,
      account.paymentDueDate,
      account.minimumPayment,
      account.websiteUrl,
      account.notes,
      account.deletedAt || null,
      account.createdAt || now,
      account.updatedAt || now
    )
  }

  // ==================== Category Operations ====================

  /**
   * Get all categories for a profile (excluding soft-deleted)
   */
  getCategories(profileId: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM categories WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    query += ' ORDER BY bucket_id, name'

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Get all categories for a profile including soft-deleted (for sync)
   */
  getCategoriesForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM categories WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Get a category by ID (excluding soft-deleted)
   */
  getCategory(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Create a new category
   */
  createCategory(category: {
    id: string
    profile_id: string
    name: string
    budget_type: string
    bucket_id: string
    category_group?: string
    monthly_budget?: number
    is_fixed_expense?: number
    is_active?: number
    tax_deductible_by_default?: number
    is_income_category?: number
    exclude_from_budget?: number
    icon?: string
  }) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO categories (
        id, profile_id, name, budget_type, bucket_id, category_group,
        monthly_budget, is_fixed_expense, is_active, tax_deductible_by_default,
        is_income_category, exclude_from_budget, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      category.id,
      category.profile_id,
      category.name,
      category.budget_type,
      category.bucket_id,
      category.category_group || null,
      category.monthly_budget || 0,
      category.is_fixed_expense || 0,
      category.is_active !== undefined ? category.is_active : 1,
      category.tax_deductible_by_default || 0,
      category.is_income_category || 0,
      category.exclude_from_budget || 0,
      category.icon || null,
      now,
      now
    )

    return this.getCategory(category.id)
  }

  /**
   * Update a category
   */
  updateCategory(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE categories
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getCategory(id)
  }

  /**
   * Delete a category (soft delete)
   */
  deleteCategory(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  /**
   * Get category by ID including soft-deleted (for sync)
   */
  getCategoryForSync(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Update category including deleted_at (for sync)
   */
  updateCategoryForSync(id: string, data: any) {
    const db = this.getDb()
    const stmt = db.prepare(`
      UPDATE categories
      SET name = ?, budget_type = ?, bucket_id = ?, category_group = ?,
          monthly_budget = ?, is_fixed_expense = ?, is_active = ?,
          tax_deductible_by_default = ?, is_income_category = ?,
          exclude_from_budget = ?, icon = ?, deleted_at = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(
      data.name,
      data.budgetType,
      data.bucketId,
      data.categoryGroup,
      data.monthlyBudget,
      data.isFixedExpense,
      data.isActive,
      data.taxDeductibleByDefault,
      data.isIncomeCategory,
      data.excludeFromBudget,
      data.icon,
      data.deletedAt || null,
      data.updatedAt,
      id
    )
  }

  /**
   * Create category with deleted_at (for sync)
   */
  createCategoryForSync(category: any) {
    const db = this.getDb()
    const stmt = db.prepare(`
      INSERT INTO categories (
        id, profile_id, name, budget_type, bucket_id, category_group,
        monthly_budget, is_fixed_expense, is_active, tax_deductible_by_default,
        is_income_category, exclude_from_budget, icon, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const now = new Date().toISOString()
    stmt.run(
      category.id,
      category.profileId,
      category.name,
      category.budgetType,
      category.bucketId,
      category.categoryGroup,
      category.monthlyBudget,
      category.isFixedExpense,
      category.isActive,
      category.taxDeductibleByDefault,
      category.isIncomeCategory,
      category.excludeFromBudget,
      category.icon,
      category.deletedAt || null,
      category.createdAt || now,
      category.updatedAt || now
    )
  }

  // ==================== Transaction Operations ====================

  /**
   * Get transactions for a profile (excluding soft-deleted)
   */
  getTransactions(profileId: string, options?: {
    budgetType?: string
    startDate?: string
    endDate?: string
    accountId?: string
    categoryId?: string
    limit?: number
  }) {
    const db = this.getDb()
    let query = 'SELECT * FROM transactions WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (options?.budgetType) {
      query += ' AND budget_type = ?'
      params.push(options.budgetType)
    }

    if (options?.startDate) {
      query += ' AND date >= ?'
      params.push(options.startDate)
    }

    if (options?.endDate) {
      query += ' AND date <= ?'
      params.push(options.endDate)
    }

    if (options?.accountId) {
      query += ' AND account_id = ?'
      params.push(options.accountId)
    }

    if (options?.categoryId) {
      query += ' AND category_id = ?'
      params.push(options.categoryId)
    }

    query += ' ORDER BY date DESC, created_at DESC'

    if (options?.limit) {
      query += ' LIMIT ?'
      params.push(options.limit)
    }

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Get all transactions for a profile including soft-deleted (for sync)
   */
  getTransactionsForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM transactions WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Get a transaction by ID (excluding soft-deleted)
   */
  getTransaction(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Get a transaction by ID for sync (including soft-deleted)
   */
  getTransactionForSync(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Create a new transaction
   */
  createTransaction(transaction: {
    id: string
    profile_id: string
    date: string
    description: string
    amount: number
    category_id: string
    bucket_id?: string
    budget_type: string
    account_id: string
    to_account_id?: string
    linked_transaction_id?: string
    project_id?: string
    income_source_id?: string
    tax_deductible?: number
    reconciled?: number
    notes?: string
  }) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, profile_id, date, description, amount, category_id, bucket_id,
        budget_type, account_id, to_account_id, linked_transaction_id,
        project_id, income_source_id, tax_deductible, reconciled, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      transaction.id,
      transaction.profile_id,
      transaction.date,
      transaction.description,
      transaction.amount,
      transaction.category_id,
      transaction.bucket_id || null,
      transaction.budget_type,
      transaction.account_id,
      transaction.to_account_id || null,
      transaction.linked_transaction_id || null,
      transaction.project_id || null,
      transaction.income_source_id || null,
      transaction.tax_deductible || 0,
      transaction.reconciled || 0,
      transaction.notes || null,
      now,
      now
    )

    return this.getTransaction(transaction.id)
  }

  /**
   * Update a transaction
   */
  updateTransaction(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE transactions
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getTransaction(id)
  }

  /**
   * Delete a transaction (soft delete)
   */
  deleteTransaction(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  // ==================== Income Source Operations ====================

  /**
   * Get income sources for a profile (excluding soft-deleted)
   */
  getIncomeSources(profileId: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM income_sources WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    query += ' ORDER BY name'

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Get all income sources for a profile including soft-deleted (for sync)
   */
  getIncomeSourcesForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM income_sources WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Create an income source
   */
  createIncomeSource(source: any) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO income_sources (
        id, profile_id, name, budget_type, income_type, category_id,
        expected_amount, frequency, next_expected_date, client_source,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      source.id,
      source.profile_id,
      source.name,
      source.budget_type,
      source.income_type,
      source.category_id || null,
      source.expected_amount || 0,
      source.frequency,
      source.next_expected_date || null,
      source.client_source || null,
      source.is_active !== undefined ? source.is_active : 1,
      now,
      now
    )

    return this.getIncomeSource(source.id)
  }

  /**
   * Get an income source by ID (excluding soft-deleted)
   */
  getIncomeSource(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM income_sources WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Get an income source by ID for sync (including soft-deleted)
   */
  getIncomeSourceForSync(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM income_sources WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Update an income source
   */
  updateIncomeSource(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE income_sources
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getIncomeSource(id)
  }

  /**
   * Delete an income source (soft delete)
   */
  deleteIncomeSource(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE income_sources SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  // ==================== Project Operations ====================

  /**
   * Get projects for a profile (excluding soft-deleted)
   */
  getProjects(profileId: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM projects WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    query += ' ORDER BY date_created DESC'

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Get all projects for a profile including soft-deleted (for sync)
   */
  getProjectsForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM projects WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Create a project
   */
  createProject(project: any) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO projects (
        id, profile_id, name, budget_type, project_type_id, status_id,
        income_source_id, budget, date_created, date_completed,
        commission_paid, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      project.id,
      project.profile_id,
      project.name,
      project.budget_type,
      project.project_type_id,
      project.status_id,
      project.income_source_id || null,
      project.budget || null,
      project.date_created,
      project.date_completed || null,
      project.commission_paid || 0,
      project.notes || null,
      now,
      now
    )

    return this.getProject(project.id)
  }

  /**
   * Get a project by ID (excluding soft-deleted)
   */
  getProject(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Get a project by ID for sync (including soft-deleted)
   */
  getProjectForSync(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Update a project
   */
  updateProject(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getProject(id)
  }

  /**
   * Delete a project (soft delete)
   */
  deleteProject(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  // ==================== Project Type Operations ====================

  /**
   * Get project types for a profile (excluding soft-deleted)
   */
  getProjectTypes(profileId: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM project_types WHERE profile_id = ? AND deleted_at IS NULL'
    const params: any[] = [profileId]

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    const stmt = db.prepare(query)
    const results: any[] = stmt.all(...params)

    // Parse allowed_statuses JSON for each result
    return results.map(result => {
      if (result.allowed_statuses) {
        result.allowed_statuses = JSON.parse(result.allowed_statuses)
      }
      return result
    })
  }

  /**
   * Get all project types for a profile including soft-deleted (for sync)
   */
  getProjectTypesForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM project_types WHERE profile_id = ?')
    const results: any[] = stmt.all(profileId)

    // Parse allowed_statuses JSON for each result
    return results.map(result => {
      if (result.allowed_statuses) {
        result.allowed_statuses = JSON.parse(result.allowed_statuses)
      }
      return result
    })
  }

  /**
   * Create a project type
   */
  createProjectType(projectType: any) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO project_types (
        id, profile_id, name, budget_type, allowed_statuses,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      projectType.id,
      projectType.profile_id,
      projectType.name,
      projectType.budget_type,
      JSON.stringify(projectType.allowed_statuses || []),
      now,
      now
    )

    return this.getProjectType(projectType.id)
  }

  /**
   * Get a project type by ID (excluding soft-deleted)
   */
  getProjectType(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM project_types WHERE id = ? AND deleted_at IS NULL')
    const result: any = stmt.get(id)
    if (result && result.allowed_statuses) {
      result.allowed_statuses = JSON.parse(result.allowed_statuses)
    }
    return result
  }

  /**
   * Update a project type
   */
  updateProjectType(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'allowed_statuses') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE project_types
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getProjectType(id)
  }

  /**
   * Delete a project type (soft delete)
   */
  deleteProjectType(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE project_types SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  // ==================== Project Status Operations ====================

  /**
   * Get project statuses for a profile (excluding soft-deleted)
   */
  getProjectStatuses(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM project_statuses WHERE profile_id = ? AND deleted_at IS NULL')
    return stmt.all(profileId)
  }

  /**
   * Get all project statuses for a profile including soft-deleted (for sync)
   */
  getProjectStatusesForSync(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM project_statuses WHERE profile_id = ?')
    return stmt.all(profileId)
  }

  /**
   * Create a project status
   */
  createProjectStatus(status: any) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO project_statuses (
        id, profile_id, name, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      status.id,
      status.profile_id,
      status.name,
      status.description || null,
      now,
      now
    )

    return this.getProjectStatus(status.id)
  }

  /**
   * Get a project status by ID (excluding soft-deleted)
   */
  getProjectStatus(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM project_statuses WHERE id = ? AND deleted_at IS NULL')
    return stmt.get(id)
  }

  /**
   * Update a project status
   */
  updateProjectStatus(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE project_statuses
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getProjectStatus(id)
  }

  /**
   * Delete a project status (soft delete)
   */
  deleteProjectStatus(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('UPDATE project_statuses SET deleted_at = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    stmt.run(now, now, id)
  }

  // ==================== Monthly Budget Operations ====================

  /**
   * Get monthly budgets for a profile
   */
  getMonthlyBudgets(profileId: string, month?: string, budgetType?: string) {
    const db = this.getDb()
    let query = 'SELECT * FROM monthly_budgets WHERE profile_id = ?'
    const params: any[] = [profileId]

    if (month) {
      query += ' AND month = ?'
      params.push(month)
    }

    if (budgetType) {
      query += ' AND budget_type = ?'
      params.push(budgetType)
    }

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * Upsert a monthly budget
   */
  upsertMonthlyBudget(budget: {
    profile_id: string
    month: string
    budget_type: string
    category_id: string
    amount: number
  }) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO monthly_budgets (
        id, profile_id, month, budget_type, category_id, amount,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, month, category_id) DO UPDATE SET
        amount = excluded.amount,
        updated_at = excluded.updated_at
    `)

    const id = `${budget.profile_id}-${budget.month}-${budget.category_id}`
    stmt.run(
      id,
      budget.profile_id,
      budget.month,
      budget.budget_type,
      budget.category_id,
      budget.amount,
      now,
      now
    )
  }

  // ==================== Auto-Categorization Rules ====================

  /**
   * Get auto-categorization rules for a profile
   */
  getAutoCategorizationRules(profileId: string) {
    const db = this.getDb()
    const stmt = db.prepare(`
      SELECT * FROM auto_categorization_rules
      WHERE profile_id = ? AND is_active = 1
      ORDER BY vendor_pattern
    `)
    return stmt.all(profileId)
  }

  /**
   * Create an auto-categorization rule
   */
  createAutoCategorizationRule(rule: any) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO auto_categorization_rules (
        id, profile_id, vendor_pattern, budget_type, category_id,
        case_sensitive, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      rule.id,
      rule.profile_id,
      rule.vendor_pattern,
      rule.budget_type,
      rule.category_id,
      rule.case_sensitive || 0,
      rule.is_active !== undefined ? rule.is_active : 1,
      now,
      now
    )

    return this.getAutoCategorizationRule(rule.id)
  }

  /**
   * Get an auto-categorization rule by ID
   */
  getAutoCategorizationRule(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM auto_categorization_rules WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * Update an auto-categorization rule
   */
  updateAutoCategorizationRule(id: string, updates: Record<string, any>) {
    const db = this.getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`)
      values.push(value)
    })

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE auto_categorization_rules
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    return this.getAutoCategorizationRule(id)
  }

  /**
   * Delete an auto-categorization rule
   */
  deleteAutoCategorizationRule(id: string) {
    const db = this.getDb()
    const stmt = db.prepare('DELETE FROM auto_categorization_rules WHERE id = ?')
    stmt.run(id)
  }
}

// Export factory function that creates database service with Database constructor
export function createDatabaseService(DatabaseConstructor: any): DatabaseService {
  return new DatabaseService(DatabaseConstructor)
}
