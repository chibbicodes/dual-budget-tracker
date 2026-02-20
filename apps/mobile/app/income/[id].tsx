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
import type { IncomeFrequency } from '@dual-budget/shared'
import { formatCurrency } from '@dual-budget/shared'
import { useTheme } from '../../hooks/useTheme'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

const FREQUENCIES: { value: IncomeFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'irregular', label: 'Irregular' },
]

export default function EditIncomeSourceScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const { appData, updateIncomeSource } = useBudget()

  const source = useMemo(
    () => appData.incomeSources.find((s) => s.id === id),
    [appData.incomeSources, id]
  )

  const [name, setName] = useState('')
  const [expectedAmount, setExpectedAmount] = useState('')
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly')
  const [clientSource, setClientSource] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (source) {
      setName(source.name)
      setExpectedAmount(String(source.expectedAmount))
      setFrequency(source.frequency)
      setClientSource(source.clientSource || '')
      setIsActive(source.isActive)
    }
  }, [source])

  const handleSave = useCallback(async () => {
    if (!source) return
    const amount = parseFloat(expectedAmount)
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name.')
      return
    }
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid amount.')
      return
    }

    setIsSaving(true)
    try {
      await updateIncomeSource(source.id, {
        name: name.trim(),
        expectedAmount: amount,
        frequency,
        clientSource: clientSource.trim() || undefined,
        isActive,
      })
      router.back()
    } catch (error) {
      Alert.alert('Error', 'Failed to update income source.')
    } finally {
      setIsSaving(false)
    }
  }, [source, name, expectedAmount, frequency, clientSource, isActive, updateIncomeSource, router])

  if (!source) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Income source not found
          </Text>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Edit Income Source
        </Text>

        {/* Name */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="Income source name"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Expected Amount */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Expected Amount</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          value={expectedAmount}
          onChangeText={setExpectedAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />

        {/* Frequency */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Frequency</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f.value}
              style={[
                styles.frequencyChip,
                {
                  backgroundColor: frequency === f.value ? colors.primary : colors.surface,
                  borderColor: frequency === f.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFrequency(f.value)}
            >
              <Text
                style={[
                  styles.frequencyChipText,
                  { color: frequency === f.value ? '#ffffff' : colors.text },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Client/Source */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Client / Source (optional)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          value={clientSource}
          onChangeText={setClientSource}
          placeholder="e.g., Company Name"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Active Toggle */}
        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Active</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={isActive ? colors.primary : colors.textSecondary}
          />
        </View>

        {/* Save Button */}
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>

        {/* Cancel */}
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
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
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  frequencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  frequencyChipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  switchLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  backButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
})
