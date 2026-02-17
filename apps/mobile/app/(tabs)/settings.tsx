import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { useBudget } from '../../contexts/BudgetContext'
import { useSync } from '../../hooks/useSync'
import { databaseService } from '../../services/database'
import { formatCurrency } from '@dual-budget/shared'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function SettingsScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const { user, isFirebaseReady } = useAuth()
  const { activeProfile, profiles, refreshProfiles, switchProfile } = useProfile()
  const { settings, refreshAll } = useBudget()
  const { syncNow, isSyncing, lastSyncedAt } = useSync()

  // Auto-sync on first load when signed in
  useEffect(() => {
    if (user && activeProfile && !lastSyncedAt && !isSyncing) {
      syncNow(activeProfile.id).then(() => { refreshProfiles(); refreshAll() })
    }
  }, [user, activeProfile?.id])

  if (!settings || !activeProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    )
  }

  // Helper to convert camelCase AppSettings updates to snake_case DB columns
  const handleUpdateSettings = async (updates: Record<string, any>) => {
    const snakeCase: Record<string, any> = {}
    const keyMap: Record<string, string> = {
      defaultBudgetView: 'default_budget_view',
      dateFormat: 'date_format',
      currencySymbol: 'currency_symbol',
      trackHousehold: 'track_household',
      trackBusiness: 'track_business',
    }
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'householdTargets' && typeof value === 'object') {
        const ht = value as Record<string, any>
        if (ht.needsPercentage !== undefined) snakeCase.household_needs_percentage = ht.needsPercentage
        if (ht.wantsPercentage !== undefined) snakeCase.household_wants_percentage = ht.wantsPercentage
        if (ht.savingsPercentage !== undefined) snakeCase.household_savings_percentage = ht.savingsPercentage
        if (ht.monthlyIncomeBaseline !== undefined) snakeCase.household_monthly_income_baseline = ht.monthlyIncomeBaseline
      } else if (key === 'businessTargets' && typeof value === 'object') {
        const bt = value as Record<string, any>
        if (bt.operatingPercentage !== undefined) snakeCase.business_operating_percentage = bt.operatingPercentage
        if (bt.growthPercentage !== undefined) snakeCase.business_growth_percentage = bt.growthPercentage
        if (bt.compensationPercentage !== undefined) snakeCase.business_compensation_percentage = bt.compensationPercentage
        if (bt.taxReservePercentage !== undefined) snakeCase.business_tax_reserve_percentage = bt.taxReservePercentage
        if (bt.businessSavingsPercentage !== undefined) snakeCase.business_savings_percentage = bt.businessSavingsPercentage
        if (bt.monthlyRevenueBaseline !== undefined) snakeCase.business_monthly_revenue_baseline = bt.monthlyRevenueBaseline
      } else if (keyMap[key]) {
        snakeCase[keyMap[key]] = typeof value === 'boolean' ? (value ? 1 : 0) : value
      }
    }
    await databaseService.updateSettings(activeProfile.id, snakeCase)
    refreshAll()
  }

  // Budget view toggle
  const handleToggleBudgetView = async () => {
    const order = ['household', 'business'] as const
    const currentIndex = order.indexOf(settings.defaultBudgetView as any)
    const nextIndex = (currentIndex + 1) % order.length
    await databaseService.updateSettings(activeProfile.id, {
      default_budget_view: order[nextIndex],
    })
    refreshAll()
  }

  // Sync actions
  const handleSyncNow = useCallback(async () => {
    if (!user || !activeProfile) return
    await syncNow(activeProfile.id)
    await refreshProfiles()
    refreshAll()
  }, [user, activeProfile, syncNow, refreshProfiles, refreshAll])

  // Danger zone actions
  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your budget data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            await databaseService.clearProfileData(activeProfile.id)
            await refreshAll()
            Alert.alert('Data Cleared', 'All data has been reset to defaults.')
          },
        },
      ]
    )
  }

  const handleExportData = () => {
    Alert.alert('Export Data', 'Data export will be available in a future update.')
  }

  // Numeric input handler for settings
  const handleNumericSetting = useCallback(
    (
      currentValue: number,
      onSave: (value: number) => void,
      label: string
    ) => {
      // We store a local editing state via Alert.prompt on iOS
      // On Android, use a simple approach
      Alert.prompt(
        label,
        `Current value: ${currentValue}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              const parsed = parseFloat(value || '0')
              if (!isNaN(parsed) && parsed >= 0) {
                onSave(parsed)
              }
            },
          },
        ],
        'plain-text',
        String(currentValue)
      )
    },
    []
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            PROFILE
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Current Profile
              </Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {activeProfile ? activeProfile.name : 'No profile selected'}
              </Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              if (profiles.length > 1) {
                router.push('/profile/select')
              } else {
                Alert.alert(
                  'Switch Profile',
                  'You only have one profile. Create additional profiles to switch between them.'
                )
              }
            }}
          >
            <Text style={[styles.settingLabel, { color: colors.primary }]}>
              Switch Profile
            </Text>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>
              {'>'}
            </Text>
          </Pressable>
        </View>

        {/* Budget Preferences */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            BUDGET PREFERENCES
          </Text>

          {/* Default Budget View */}
          <Pressable style={styles.settingRow} onPress={handleToggleBudgetView}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Default Budget View
              </Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {settings.defaultBudgetView === 'household'
                  ? 'Household'
                  : settings.defaultBudgetView === 'business'
                  ? 'Business'
                  : 'Combined'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>
              {'>'}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Track Household */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Track Household
            </Text>
            <Switch
              value={settings.trackHousehold}
              onValueChange={(value) =>
                handleUpdateSettings({ trackHousehold: value })
              }
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                settings.trackHousehold ? colors.primary : colors.textSecondary
              }
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Track Business */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Track Business
            </Text>
            <Switch
              value={settings.trackBusiness}
              onValueChange={(value) =>
                handleUpdateSettings({ trackBusiness: value })
              }
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={
                settings.trackBusiness ? colors.primary : colors.textSecondary
              }
            />
          </View>
        </View>

        {/* Household Targets */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            HOUSEHOLD TARGETS
          </Text>

          {/* Needs Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.householdTargets.needsPercentage,
                (value) =>
                  handleUpdateSettings({
                    householdTargets: {
                      ...settings.householdTargets,
                      needsPercentage: value,
                    },
                  }),
                'Needs Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Needs
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.householdTargets.needsPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Wants Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.householdTargets.wantsPercentage,
                (value) =>
                  handleUpdateSettings({
                    householdTargets: {
                      ...settings.householdTargets,
                      wantsPercentage: value,
                    },
                  }),
                'Wants Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Wants
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.householdTargets.wantsPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Savings Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.householdTargets.savingsPercentage,
                (value) =>
                  handleUpdateSettings({
                    householdTargets: {
                      ...settings.householdTargets,
                      savingsPercentage: value,
                    },
                  }),
                'Savings Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Savings
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.householdTargets.savingsPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Household Percentage Total */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>
              Total
            </Text>
            <Text
              style={[
                styles.settingValueRight,
                {
                  color:
                    settings.householdTargets.needsPercentage +
                      settings.householdTargets.wantsPercentage +
                      settings.householdTargets.savingsPercentage ===
                    100
                      ? colors.success
                      : colors.danger,
                },
              ]}
            >
              {settings.householdTargets.needsPercentage +
                settings.householdTargets.wantsPercentage +
                settings.householdTargets.savingsPercentage}
              %
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Monthly Income Baseline */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.householdTargets.monthlyIncomeBaseline,
                (value) =>
                  handleUpdateSettings({
                    householdTargets: {
                      ...settings.householdTargets,
                      monthlyIncomeBaseline: value,
                    },
                  }),
                'Monthly Income Baseline'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Monthly Income Baseline
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {formatCurrency(settings.householdTargets.monthlyIncomeBaseline)}
            </Text>
          </Pressable>
        </View>

        {/* Business Targets */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            BUSINESS TARGETS
          </Text>

          {/* Operating Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.operatingPercentage,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      operatingPercentage: value,
                    },
                  }),
                'Operating Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Operating
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.businessTargets.operatingPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Growth Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.growthPercentage,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      growthPercentage: value,
                    },
                  }),
                'Growth Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Growth
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.businessTargets.growthPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Compensation Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.compensationPercentage,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      compensationPercentage: value,
                    },
                  }),
                'Compensation Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Compensation
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.businessTargets.compensationPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Tax Reserve Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.taxReservePercentage,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      taxReservePercentage: value,
                    },
                  }),
                'Tax Reserve Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Tax Reserve
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.businessTargets.taxReservePercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Business Savings Percentage */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.businessSavingsPercentage,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      businessSavingsPercentage: value,
                    },
                  }),
                'Business Savings Percentage'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Savings
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.businessTargets.businessSavingsPercentage}%
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Business Percentage Total */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>
              Total
            </Text>
            <Text
              style={[
                styles.settingValueRight,
                {
                  color:
                    settings.businessTargets.operatingPercentage +
                      settings.businessTargets.growthPercentage +
                      settings.businessTargets.compensationPercentage +
                      settings.businessTargets.taxReservePercentage +
                      settings.businessTargets.businessSavingsPercentage ===
                    100
                      ? colors.success
                      : colors.danger,
                },
              ]}
            >
              {settings.businessTargets.operatingPercentage +
                settings.businessTargets.growthPercentage +
                settings.businessTargets.compensationPercentage +
                settings.businessTargets.taxReservePercentage +
                settings.businessTargets.businessSavingsPercentage}
              %
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Monthly Revenue Baseline */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              handleNumericSetting(
                settings.businessTargets.monthlyRevenueBaseline,
                (value) =>
                  handleUpdateSettings({
                    businessTargets: {
                      ...settings.businessTargets,
                      monthlyRevenueBaseline: value,
                    },
                  }),
                'Monthly Revenue Baseline'
              )
            }
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Monthly Revenue Baseline
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {formatCurrency(settings.businessTargets.monthlyRevenueBaseline)}
            </Text>
          </Pressable>
        </View>

        {/* Display Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            DISPLAY
          </Text>

          {/* Date Format */}
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              const formats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'MMM d, yyyy']
              const currentIndex = formats.indexOf(settings.dateFormat)
              const nextIndex = (currentIndex + 1) % formats.length
              handleUpdateSettings({ dateFormat: formats[nextIndex] })
            }}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Date Format
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.dateFormat || 'yyyy-MM-dd'}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Currency Symbol */}
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              const symbols = ['$', '\u20AC', '\u00A3', '\u00A5', 'C$', 'A$']
              const currentIndex = symbols.indexOf(settings.currencySymbol)
              const nextIndex = (currentIndex + 1) % symbols.length
              handleUpdateSettings({ currencySymbol: symbols[nextIndex] })
            }}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Currency Symbol
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              {settings.currencySymbol || '$'}
            </Text>
          </Pressable>
        </View>

        {/* Cloud Sync Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            CLOUD SYNC
          </Text>
          {!user ? (
            <View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Sync Status
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                    Not signed in
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Firebase Auth
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                    {isFirebaseReady ? 'Available' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.actionButtonText}>
                  Sign in to enable cloud sync
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {/* Sync Status */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Sync Status
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.success }]}>
                    Connected
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              {/* Account */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Account
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                    {user.email || 'Unknown'}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              {/* Last Synced */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Last Synced
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                    {lastSyncedAt
                      ? new Date(lastSyncedAt).toLocaleString()
                      : 'Never'}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              {/* Firebase Auth Status */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Firebase Auth
                  </Text>
                  <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                    {isFirebaseReady ? 'Connected' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              {/* Sync Now */}
              <Pressable
                style={styles.settingRow}
                onPress={handleSyncNow}
                disabled={isSyncing}
              >
                <Text
                  style={[
                    styles.settingLabel,
                    {
                      color: isSyncing
                        ? colors.textSecondary
                        : colors.primary,
                    },
                  ]}
                >
                  Sync Now
                </Text>
                {isSyncing && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={styles.syncSpinner}
                  />
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            ABOUT
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                App Version
              </Text>
            </View>
            <Text style={[styles.settingValueRight, { color: colors.textSecondary }]}>
              1.0.0
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: colors.danger }]}>
            DANGER ZONE
          </Text>
          <Pressable style={styles.settingRow} onPress={handleExportData}>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>
              Export Data
            </Text>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>
              {'>'}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <Pressable style={styles.settingRow} onPress={handleClearData}>
            <Text style={[styles.settingLabel, { color: colors.danger }]}>
              Clear All Data
            </Text>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>
              {'>'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  section: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  settingValueRight: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  chevron: {
    fontSize: FontSize.lg,
    fontWeight: '400',
    marginLeft: Spacing.sm,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.md,
  },
  actionButton: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  syncSpinner: {
    marginLeft: Spacing.sm,
  },
})
