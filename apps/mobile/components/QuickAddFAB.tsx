import { StyleSheet, Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useHaptics } from '../hooks/useHaptics'

export function QuickAddFAB() {
  const router = useRouter()
  const haptics = useHaptics()

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        pressed && styles.fabPressed,
      ]}
      onPress={() => {
        haptics.light()
        router.push('/transaction/add')
      }}
    >
      <Text style={styles.fabIcon}>+</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  fabPressed: {
    backgroundColor: '#1d4ed8',
    transform: [{ scale: 0.95 }],
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
})
