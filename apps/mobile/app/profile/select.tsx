import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useTheme } from '../../hooks/useTheme'
import { useProfile } from '../../contexts/ProfileContext'
import { useBudget } from '../../contexts/BudgetContext'
import { Spacing, FontSize, BorderRadius } from '../../constants/theme'

export default function ProfileSelectScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const { profiles, activeProfile, switchProfile } = useProfile()
  const { refreshAll } = useBudget()

  const handleSelect = async (profileId: string) => {
    await switchProfile(profileId)
    refreshAll()
    router.back()
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Switch Profile' }} />
      <ScrollView contentContainerStyle={styles.list}>
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfile?.id
          return (
            <Pressable
              key={profile.id}
              style={[
                styles.item,
                { backgroundColor: colors.surface },
                isActive && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={() => handleSelect(profile.id)}
            >
              <Text style={[styles.name, { color: colors.text }]}>
                {profile.name}
              </Text>
              {profile.description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {profile.description}
                </Text>
              ) : null}
              {isActive && (
                <Text style={[styles.badge, { color: colors.primary }]}>
                  Active
                </Text>
              )}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  item: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  description: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  badge: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
})
