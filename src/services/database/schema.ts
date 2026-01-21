import Database from 'better-sqlite3'

/**
 * Database schema for Dual Budget Tracker
 * This schema supports multi-profile data storage in a single database file
 */
export const createSchema = (db: Database.Database): void => {
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON')

  // Profiles table
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      profile_id TEXT PRIMARY KEY,
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
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `)

  // Accounts
  db.exec(`
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
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_profile ON accounts(profile_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_budget_type ON accounts(profile_id, budget_type);
  `)

  // Categories
  db.exec(`
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
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_categories_profile ON categories(profile_id);
    CREATE INDEX IF NOT EXISTS idx_categories_budget_type ON categories(profile_id, budget_type);
  `)

  // Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT NOT NULL,
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
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_profile ON transactions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(profile_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
  `)

  // Income Sources
  db.exec(`
    CREATE TABLE IF NOT EXISTS income_sources (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
      income_type TEXT NOT NULL,
      category_id TEXT,
      expected_amount REAL NOT NULL DEFAULT 0,
      frequency TEXT NOT NULL,
      next_expected_date TEXT,
      client_source TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_income_sources_profile ON income_sources(profile_id);
  `)

  // Monthly Budgets
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_monthly_budgets_profile ON monthly_budgets(profile_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month ON monthly_budgets(profile_id, month);
  `)

  // Project Types
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_types (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      budget_type TEXT NOT NULL CHECK (budget_type IN ('household', 'business')),
      allowed_statuses TEXT NOT NULL, -- JSON array of status IDs
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_types_profile ON project_types(profile_id);
  `)

  // Project Statuses
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_statuses (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_statuses_profile ON project_statuses(profile_id);
  `)

  // Projects
  db.exec(`
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
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (project_type_id) REFERENCES project_types(id),
      FOREIGN KEY (status_id) REFERENCES project_statuses(id),
      FOREIGN KEY (income_source_id) REFERENCES income_sources(id)
    );
    CREATE INDEX IF NOT EXISTS idx_projects_profile ON projects(profile_id);
    CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);
  `)

  // Auto-categorization rules
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_auto_rules_profile ON auto_categorization_rules(profile_id);
  `)

  // Database metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Insert version if not exists
  const versionStmt = db.prepare('INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)')
  versionStmt.run('version', '1.0.0')
  versionStmt.run('created_at', new Date().toISOString())
}
