import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import type { DatabaseAdapter } from '@dual-budget/shared'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Mobile SQLite database service for Dual Budget Tracker
 * Uses expo-sqlite to provide a local SQLite database with the same schema as the desktop app.
 *
 * This is the mobile equivalent of the desktop's Electron IPC database client.
 * It implements the DatabaseAdapter interface from @dual-budget/shared so it can
 * be used with the shared syncService.
 */

const DATABASE_NAME = 'dual-budget-tracker.db'

export class DatabaseService implements DatabaseAdapter {
  private db: SQLiteDatabase

  constructor() {
    this.db = openDatabaseSync(DATABASE_NAME)
    this.initialize()
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private initialize(): void {
    // Enable WAL mode for better concurrent performance
    this.db.runSync('PRAGMA journal_mode = WAL')

    // Enable foreign key constraints
    this.db.runSync('PRAGMA foreign_keys = ON')

    // Create schema
    this.createSchema()

    console.log('Mobile database initialized')
  }

  private createSchema(): void {
    // Profiles table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        password_hash TEXT,
        password_hint TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
      );
    `)

    // App settings (per profile)
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL,
        default_budget_view TEXT NOT NULL DEFAULT 'household',
        date_format TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
        currency_symbol TEXT NOT NULL DEFAULT '$',
        first_run_completed INTEGER NOT NULL DEFAULT 0,
        track_business INTEGER NOT NULL DEFAULT 1,
        track_household INTEGER NOT NULL DEFAULT 1,
        household_needs_percentage REAL NOT NULL DEFAULT 50,
        household_wants_percentage REAL NOT NULL DEFAULT 30,
        household_savings_percentage REAL NOT NULL DEFAULT 20,
        household_monthly_income_baseline REAL NOT NULL DEFAULT 0,
        business_operating_percentage REAL NOT NULL DEFAULT 40,
        business_growth_percentage REAL NOT NULL DEFAULT 20,
        business_compensation_percentage REAL NOT NULL DEFAULT 30,
        business_tax_reserve_percentage REAL NOT NULL DEFAULT 5,
        business_savings_percentage REAL NOT NULL DEFAULT 5,
        business_monthly_revenue_baseline REAL NOT NULL DEFAULT 0,
        household_needs_name TEXT DEFAULT NULL,
        household_wants_name TEXT DEFAULT NULL,
        household_savings_name TEXT DEFAULT NULL,
        business_travel_performance_name TEXT DEFAULT NULL,
        business_travel_performance_percentage REAL DEFAULT NULL,
        business_craft_business_name TEXT DEFAULT NULL,
        business_craft_business_percentage REAL DEFAULT NULL,
        business_online_marketing_name TEXT DEFAULT NULL,
        business_online_marketing_percentage REAL DEFAULT NULL,
        business_professional_services_name TEXT DEFAULT NULL,
        business_professional_services_percentage REAL DEFAULT NULL,
        business_administrative_name TEXT DEFAULT NULL,
        business_administrative_percentage REAL DEFAULT NULL,
        business_personnel_name TEXT DEFAULT NULL,
        business_personnel_percentage REAL DEFAULT NULL,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)

    // Accounts
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        account_type TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        interest_rate REAL,
        credit_limit REAL,
        payment_due_date TEXT,
        minimum_payment REAL,
        website_url TEXT,
        last_payment_month TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_accounts_profile ON accounts(profile_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_accounts_budget_type ON accounts(profile_id, budget_type);`)

    // Categories
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        bucket_id TEXT NOT NULL,
        category_group TEXT,
        monthly_budget REAL NOT NULL DEFAULT 0,
        is_fixed_expense INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        tax_deductible_by_default INTEGER NOT NULL DEFAULT 0,
        is_income_category INTEGER NOT NULL DEFAULT 0,
        exclude_from_budget INTEGER NOT NULL DEFAULT 0,
        icon TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_categories_profile ON categories(profile_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_categories_budget_type ON categories(profile_id, budget_type);`)

    // Transactions
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT,
        bucket_id TEXT,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        account_id TEXT NOT NULL,
        to_account_id TEXT,
        linked_transaction_id TEXT,
        project_id TEXT,
        income_source_id TEXT,
        tax_deductible INTEGER NOT NULL DEFAULT 0,
        reconciled INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (to_account_id) REFERENCES accounts(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_profile ON transactions(profile_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(profile_id, date);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);`)

    // Income Sources
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS income_sources (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        income_type TEXT NOT NULL,
        category_id TEXT,
        expected_amount REAL NOT NULL DEFAULT 0,
        first_occurrence_amount REAL,
        frequency TEXT NOT NULL,
        next_expected_date TEXT,
        end_condition TEXT DEFAULT 'none',
        end_date TEXT,
        total_occurrences INTEGER,
        client_source TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_income_sources_profile ON income_sources(profile_id);`)

    // Projects
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        project_type_id TEXT NOT NULL,
        status_id TEXT NOT NULL,
        income_source_id TEXT,
        budget REAL,
        date_created TEXT NOT NULL,
        date_completed TEXT,
        commission_paid INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (project_type_id) REFERENCES project_types(id),
        FOREIGN KEY (status_id) REFERENCES project_statuses(id),
        FOREIGN KEY (income_source_id) REFERENCES income_sources(id)
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_projects_profile ON projects(profile_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);`)

    // Project Types
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS project_types (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        allowed_statuses TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_project_types_profile ON project_types(profile_id);`)

    // Project Statuses
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS project_statuses (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_project_statuses_profile ON project_statuses(profile_id);`)

    // Monthly Budgets
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS monthly_budgets (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        month TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
        category_id TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        UNIQUE(profile_id, month, category_id)
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_monthly_budgets_profile ON monthly_budgets(profile_id);`)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month ON monthly_budgets(profile_id, month);`)

    // Auto-categorization rules
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS auto_categorization_rules (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        vendor_pattern TEXT NOT NULL,
        budget_type TEXT NOT NULL,
        category_id TEXT NOT NULL,
        case_sensitive INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `)
    this.db.execSync(`CREATE INDEX IF NOT EXISTS idx_auto_rules_profile ON auto_categorization_rules(profile_id);`)
  }

  // ============================================================================
  // Profile Operations
  // ============================================================================

  async getAllProfiles(): Promise<any[]> {
    return this.db.getAllSync(
      `SELECT id, name, description, password_hash, password_hint,
              created_at, updated_at, last_accessed_at
       FROM profiles
       ORDER BY last_accessed_at DESC`
    )
  }

  async getProfile(id: string): Promise<any> {
    return this.db.getFirstSync(
      `SELECT id, name, description, password_hash, password_hint,
              created_at, updated_at, last_accessed_at
       FROM profiles
       WHERE id = ?`,
      [id]
    )
  }

  async createProfile(profile: {
    id: string
    name: string
    description?: string
    password_hash?: string
    password_hint?: string
  }): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO profiles (id, name, description, password_hash, password_hint,
                             created_at, updated_at, last_accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.name,
        profile.description ?? null,
        profile.password_hash ?? null,
        profile.password_hint ?? null,
        now,
        now,
        now,
      ]
    )

    // Create default settings for the profile
    this.db.runSync(
      `INSERT INTO settings (profile_id) VALUES (?)`,
      [profile.id]
    )

    return this.getProfile(profile.id)
  }

  async updateProfile(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getProfile(id)
  }

  async updateProfileLastAccessed(id: string): Promise<void> {
    this.db.runSync(
      `UPDATE profiles SET last_accessed_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    )
  }

  async deleteProfile(id: string): Promise<any> {
    this.db.runSync('DELETE FROM profiles WHERE id = ?', [id])
  }

  // ============================================================================
  // Settings Operations
  // ============================================================================

  async getSettings(profileId: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM settings WHERE profile_id = ?',
      [profileId]
    )
  }

  async updateSettings(profileId: string, settings: Record<string, any>): Promise<any> {
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(settings)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    values.push(profileId)

    this.db.runSync(
      `UPDATE settings SET ${fields.join(', ')} WHERE profile_id = ?`,
      values
    )

    return this.getSettings(profileId)
  }

  async createSettings(profileId: string): Promise<any> {
    this.db.runSync(
      `INSERT INTO settings (profile_id) VALUES (?)`,
      [profileId]
    )
    return this.getSettings(profileId)
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  async getAccounts(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM accounts WHERE profile_id = ? AND deleted_at IS NULL ORDER BY name',
      [profileId]
    )
  }

  async getAccountsForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM accounts WHERE profile_id = ?',
      [profileId]
    )
  }

  async getAccount(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM accounts WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getAccountForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM accounts WHERE id = ?',
      [id]
    )
  }

  async createAccount(account: {
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
    last_payment_month?: string
    notes?: string
  }): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO accounts (
        id, profile_id, name, budget_type, account_type, balance,
        interest_rate, credit_limit, payment_due_date, minimum_payment,
        website_url, last_payment_month, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.profile_id,
        account.name,
        account.budget_type,
        account.account_type,
        account.balance ?? 0,
        account.interest_rate ?? null,
        account.credit_limit ?? null,
        account.payment_due_date ?? null,
        account.minimum_payment ?? null,
        account.website_url ?? null,
        account.last_payment_month ?? null,
        account.notes ?? null,
        now,
        now,
      ]
    )

    return this.getAccount(account.id)
  }

  async createAccountForSync(account: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO accounts (
        id, profile_id, name, budget_type, account_type, balance,
        interest_rate, credit_limit, payment_due_date, minimum_payment,
        website_url, last_payment_month, notes, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.profileId,
        account.name,
        account.budgetType,
        account.accountType,
        account.balance ?? 0,
        account.interestRate ?? null,
        account.creditLimit ?? null,
        account.paymentDueDate ?? null,
        account.minimumPayment ?? null,
        account.websiteUrl ?? null,
        account.lastPaymentMonth ?? null,
        account.notes ?? null,
        account.deletedAt ?? null,
        account.createdAt ?? now,
        account.updatedAt ?? now,
      ]
    )
  }

  async updateAccount(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getAccount(id)
  }

  async updateAccountForSync(id: string, data: any): Promise<any> {
    this.db.runSync(
      `UPDATE accounts
       SET name = ?, budget_type = ?, account_type = ?, balance = ?,
           interest_rate = ?, credit_limit = ?, payment_due_date = ?,
           minimum_payment = ?, website_url = ?, notes = ?,
           deleted_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.name,
        data.budgetType,
        data.accountType,
        data.balance,
        data.interestRate ?? null,
        data.creditLimit ?? null,
        data.paymentDueDate ?? null,
        data.minimumPayment ?? null,
        data.websiteUrl ?? null,
        data.notes ?? null,
        data.deletedAt ?? null,
        data.updatedAt,
        id,
      ]
    )
  }

  async deleteAccount(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Category Operations
  // ============================================================================

  async getCategories(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM categories WHERE profile_id = ? AND deleted_at IS NULL ORDER BY bucket_id, name',
      [profileId]
    )
  }

  async getCategoriesForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM categories WHERE profile_id = ?',
      [profileId]
    )
  }

  async getCategory(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getCategoryForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    )
  }

  async createCategory(category: {
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
  }): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO categories (
        id, profile_id, name, budget_type, bucket_id, category_group,
        monthly_budget, is_fixed_expense, is_active, tax_deductible_by_default,
        is_income_category, exclude_from_budget, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.profile_id,
        category.name,
        category.budget_type,
        category.bucket_id,
        category.category_group ?? null,
        category.monthly_budget ?? 0,
        category.is_fixed_expense ?? 0,
        category.is_active !== undefined ? category.is_active : 1,
        category.tax_deductible_by_default ?? 0,
        category.is_income_category ?? 0,
        category.exclude_from_budget ?? 0,
        category.icon ?? null,
        now,
        now,
      ]
    )

    return this.getCategory(category.id)
  }

  async createCategoryForSync(category: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO categories (
        id, profile_id, name, budget_type, bucket_id, category_group,
        monthly_budget, is_fixed_expense, is_active, tax_deductible_by_default,
        is_income_category, exclude_from_budget, icon, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.profileId,
        category.name,
        category.budgetType,
        category.bucketId,
        category.categoryGroup ?? null,
        category.monthlyBudget ?? 0,
        category.isFixedExpense ?? 0,
        category.isActive !== undefined ? category.isActive : 1,
        category.taxDeductibleByDefault ?? 0,
        category.isIncomeCategory ?? 0,
        category.excludeFromBudget ?? 0,
        category.icon ?? null,
        category.deletedAt ?? null,
        category.createdAt ?? now,
        category.updatedAt ?? now,
      ]
    )
  }

  async updateCategory(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getCategory(id)
  }

  async updateCategoryForSync(id: string, data: any): Promise<any> {
    this.db.runSync(
      `UPDATE categories
       SET name = ?, budget_type = ?, bucket_id = ?, category_group = ?,
           monthly_budget = ?, is_fixed_expense = ?, is_active = ?,
           tax_deductible_by_default = ?, is_income_category = ?,
           exclude_from_budget = ?, icon = ?, deleted_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.name,
        data.budgetType,
        data.bucketId,
        data.categoryGroup ?? null,
        data.monthlyBudget ?? 0,
        data.isFixedExpense ?? 0,
        data.isActive !== undefined ? data.isActive : 1,
        data.taxDeductibleByDefault ?? 0,
        data.isIncomeCategory ?? 0,
        data.excludeFromBudget ?? 0,
        data.icon ?? null,
        data.deletedAt ?? null,
        data.updatedAt,
        id,
      ]
    )
  }

  async deleteCategory(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async getTransactions(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM transactions WHERE profile_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC',
      [profileId]
    )
  }

  async getTransactionsForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM transactions WHERE profile_id = ?',
      [profileId]
    )
  }

  async getTransaction(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getTransactionForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    )
  }

  async createTransaction(transaction: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO transactions (
        id, profile_id, date, description, amount, category_id, bucket_id,
        budget_type, account_id, to_account_id, linked_transaction_id,
        project_id, income_source_id, tax_deductible, reconciled, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id ?? generateUUID(),
        transaction.profile_id,
        transaction.date,
        transaction.description,
        transaction.amount,
        transaction.category_id ?? null,
        transaction.bucket_id ?? null,
        transaction.budget_type,
        transaction.account_id,
        transaction.to_account_id ?? null,
        transaction.linked_transaction_id ?? null,
        transaction.project_id ?? null,
        transaction.income_source_id ?? null,
        transaction.tax_deductible ?? 0,
        transaction.reconciled ?? 0,
        transaction.notes ?? null,
        now,
        now,
      ]
    )

    return this.getTransaction(transaction.id)
  }

  async updateTransaction(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getTransaction(id)
  }

  async deleteTransaction(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Income Source Operations
  // ============================================================================

  async getIncomeSources(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM income_sources WHERE profile_id = ? AND deleted_at IS NULL ORDER BY name',
      [profileId]
    )
  }

  async getIncomeSourcesForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM income_sources WHERE profile_id = ?',
      [profileId]
    )
  }

  async getIncomeSource(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM income_sources WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getIncomeSourceForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM income_sources WHERE id = ?',
      [id]
    )
  }

  async createIncomeSource(source: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO income_sources (
        id, profile_id, name, budget_type, income_type, category_id,
        expected_amount, first_occurrence_amount, frequency, next_expected_date,
        end_condition, end_date, total_occurrences,
        client_source, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source.id ?? generateUUID(),
        source.profile_id,
        source.name,
        source.budget_type,
        source.income_type,
        source.category_id ?? null,
        source.expected_amount ?? 0,
        source.first_occurrence_amount ?? null,
        source.frequency,
        source.next_expected_date ?? null,
        source.end_condition ?? 'none',
        source.end_date ?? null,
        source.total_occurrences ?? null,
        source.client_source ?? null,
        source.is_active !== undefined ? source.is_active : 1,
        now,
        now,
      ]
    )

    return this.getIncomeSource(source.id)
  }

  async updateIncomeSource(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE income_sources SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getIncomeSource(id)
  }

  async deleteIncomeSource(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE income_sources SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  async getProjects(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM projects WHERE profile_id = ? AND deleted_at IS NULL ORDER BY date_created DESC',
      [profileId]
    )
  }

  async getProjectsForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM projects WHERE profile_id = ?',
      [profileId]
    )
  }

  async getProject(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getProjectForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    )
  }

  async createProject(project: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO projects (
        id, profile_id, name, budget_type, project_type_id, status_id,
        income_source_id, budget, date_created, date_completed,
        commission_paid, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id ?? generateUUID(),
        project.profile_id,
        project.name,
        project.budget_type,
        project.project_type_id,
        project.status_id,
        project.income_source_id ?? null,
        project.budget ?? null,
        project.date_created,
        project.date_completed ?? null,
        project.commission_paid ?? 0,
        project.notes ?? null,
        now,
        now,
      ]
    )

    return this.getProject(project.id)
  }

  async updateProject(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getProject(id)
  }

  async deleteProject(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Project Type Operations
  // ============================================================================

  async getProjectTypes(profileId: string): Promise<any[]> {
    const results = this.db.getAllSync(
      'SELECT * FROM project_types WHERE profile_id = ? AND deleted_at IS NULL',
      [profileId]
    ) as any[]

    return results.map((result) => {
      if (result.allowed_statuses && typeof result.allowed_statuses === 'string') {
        try {
          result.allowed_statuses = JSON.parse(result.allowed_statuses)
        } catch {
          result.allowed_statuses = []
        }
      }
      return result
    })
  }

  async getProjectTypesForSync(profileId: string): Promise<any[]> {
    const results = this.db.getAllSync(
      'SELECT * FROM project_types WHERE profile_id = ?',
      [profileId]
    ) as any[]

    return results.map((result) => {
      if (result.allowed_statuses && typeof result.allowed_statuses === 'string') {
        try {
          result.allowed_statuses = JSON.parse(result.allowed_statuses)
        } catch {
          result.allowed_statuses = []
        }
      }
      return result
    })
  }

  async getProjectType(id: string): Promise<any> {
    const result = this.db.getFirstSync(
      'SELECT * FROM project_types WHERE id = ? AND deleted_at IS NULL',
      [id]
    ) as any

    if (result && result.allowed_statuses && typeof result.allowed_statuses === 'string') {
      try {
        result.allowed_statuses = JSON.parse(result.allowed_statuses)
      } catch {
        result.allowed_statuses = []
      }
    }

    return result
  }

  async getProjectTypeForSync(id: string): Promise<any> {
    const result = this.db.getFirstSync(
      'SELECT * FROM project_types WHERE id = ?',
      [id]
    ) as any

    if (result && result.allowed_statuses && typeof result.allowed_statuses === 'string') {
      try {
        result.allowed_statuses = JSON.parse(result.allowed_statuses)
      } catch {
        result.allowed_statuses = []
      }
    }

    return result
  }

  async createProjectType(projectType: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO project_types (
        id, profile_id, name, budget_type, allowed_statuses,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectType.id ?? generateUUID(),
        projectType.profile_id,
        projectType.name,
        projectType.budget_type,
        JSON.stringify(projectType.allowed_statuses ?? []),
        now,
        now,
      ]
    )

    return this.getProjectType(projectType.id)
  }

  async updateProjectType(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'allowed_statuses') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE project_types SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getProjectType(id)
  }

  async deleteProjectType(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE project_types SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Project Status Operations
  // ============================================================================

  async getProjectStatuses(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM project_statuses WHERE profile_id = ? AND deleted_at IS NULL',
      [profileId]
    )
  }

  async getProjectStatusesForSync(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      'SELECT * FROM project_statuses WHERE profile_id = ?',
      [profileId]
    )
  }

  async getProjectStatus(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM project_statuses WHERE id = ? AND deleted_at IS NULL',
      [id]
    )
  }

  async getProjectStatusForSync(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM project_statuses WHERE id = ?',
      [id]
    )
  }

  async createProjectStatus(status: any): Promise<any> {
    const now = new Date().toISOString()

    this.db.runSync(
      `INSERT INTO project_statuses (
        id, profile_id, name, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        status.id ?? generateUUID(),
        status.profile_id,
        status.name,
        status.description ?? null,
        now,
        now,
      ]
    )

    return this.getProjectStatus(status.id)
  }

  async updateProjectStatus(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE project_statuses SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getProjectStatus(id)
  }

  async deleteProjectStatus(id: string): Promise<any> {
    const now = new Date().toISOString()
    this.db.runSync(
      'UPDATE project_statuses SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    )
  }

  // ============================================================================
  // Monthly Budget Operations
  // ============================================================================

  async getMonthlyBudgets(profileId: string, month?: string, budgetType?: string): Promise<any[]> {
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

    return this.db.getAllSync(query, params)
  }

  async getMonthlyBudget(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM monthly_budgets WHERE id = ?',
      [id]
    )
  }

  async createMonthlyBudget(budget: any): Promise<any> {
    const now = new Date().toISOString()
    const id = budget.id ?? generateUUID()

    this.db.runSync(
      `INSERT INTO monthly_budgets (
        id, profile_id, month, budget_type, category_id, amount,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, month, category_id) DO UPDATE SET
        amount = excluded.amount,
        updated_at = excluded.updated_at`,
      [
        id,
        budget.profile_id,
        budget.month,
        budget.budget_type,
        budget.category_id,
        budget.amount,
        now,
        now,
      ]
    )

    return this.getMonthlyBudget(id)
  }

  async updateMonthlyBudget(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE monthly_budgets SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getMonthlyBudget(id)
  }

  async deleteMonthlyBudget(id: string): Promise<any> {
    this.db.runSync(
      'DELETE FROM monthly_budgets WHERE id = ?',
      [id]
    )
  }

  // ============================================================================
  // Auto-Categorization Rule Operations
  // ============================================================================

  async getAutoCategorizationRules(profileId: string): Promise<any[]> {
    return this.db.getAllSync(
      `SELECT * FROM auto_categorization_rules
       WHERE profile_id = ? AND is_active = 1
       ORDER BY vendor_pattern`,
      [profileId]
    )
  }

  async getAutoCategorizationRule(id: string): Promise<any> {
    return this.db.getFirstSync(
      'SELECT * FROM auto_categorization_rules WHERE id = ?',
      [id]
    )
  }

  async createAutoCategorizationRule(rule: any): Promise<any> {
    const now = new Date().toISOString()
    const id = rule.id ?? generateUUID()

    this.db.runSync(
      `INSERT INTO auto_categorization_rules (
        id, profile_id, vendor_pattern, budget_type, category_id,
        case_sensitive, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        rule.profile_id,
        rule.vendor_pattern,
        rule.budget_type,
        rule.category_id,
        rule.case_sensitive ?? 0,
        rule.is_active !== undefined ? rule.is_active : 1,
        now,
        now,
      ]
    )

    return this.getAutoCategorizationRule(id)
  }

  async updateAutoCategorizationRule(id: string, updates: Record<string, any>): Promise<any> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.runSync(
      `UPDATE auto_categorization_rules SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getAutoCategorizationRule(id)
  }

  async deleteAutoCategorizationRule(id: string): Promise<any> {
    this.db.runSync(
      'DELETE FROM auto_categorization_rules WHERE id = ?',
      [id]
    )
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Clear all data for a profile (keeps the profile itself)
   */
  async clearProfileData(profileId: string): Promise<void> {
    // Temporarily disable FK constraints for bulk delete since synced data
    // may have cross-profile FK references (e.g., projects from profile B
    // referencing project_types from profile A)
    this.db.runSync('PRAGMA foreign_keys = OFF')

    try {
      // Delete in child-to-parent order
      this.db.runSync('DELETE FROM transactions WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM monthly_budgets WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM auto_categorization_rules WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM projects WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM income_sources WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM project_types WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM project_statuses WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM accounts WHERE profile_id = ?', [profileId])
      this.db.runSync('DELETE FROM categories WHERE profile_id = ?', [profileId])
    } finally {
      this.db.runSync('PRAGMA foreign_keys = ON')
    }

    // Reset settings to defaults
    this.db.runSync(
      `UPDATE settings
       SET default_budget_view = 'household',
           date_format = 'MM/dd/yyyy',
           currency_symbol = '$',
           first_run_completed = 0,
           track_business = 1,
           track_household = 1,
           household_needs_percentage = 50,
           household_wants_percentage = 30,
           household_savings_percentage = 20,
           household_monthly_income_baseline = 0,
           business_operating_percentage = 40,
           business_growth_percentage = 20,
           business_compensation_percentage = 30,
           business_tax_reserve_percentage = 5,
           business_savings_percentage = 5,
           business_monthly_revenue_baseline = 0
       WHERE profile_id = ?`,
      [profileId]
    )
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.closeSync()
  }
}

// Export singleton instance
export const databaseService = new DatabaseService()
