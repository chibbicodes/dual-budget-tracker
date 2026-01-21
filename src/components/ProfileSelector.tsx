import { useState } from 'react'
import { useProfile } from '../contexts/ProfileContext'
import { FolderOpen, Plus, ArrowRight, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Profile } from '../types'

export default function ProfileSelector() {
  const { profiles, createProfile, switchProfile } = useProfile()
  const [isCreating, setIsCreating] = useState(profiles.length === 0)
  const [formData, setFormData] = useState({ name: '', description: '', password: '', passwordHint: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState<{ profile: Profile; password: string } | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Please enter a profile name')
      return
    }

    setIsLoading(true)
    try {
      await createProfile(
        formData.name.trim(),
        formData.description.trim() || undefined,
        formData.password.trim() || undefined,
        formData.passwordHint.trim() || undefined
      )
      // Profile context will automatically set this as active
      // and trigger a reload
    } catch (err) {
      setError('Failed to create profile. Please try again.')
      setIsLoading(false)
    }
  }

  const handleProfileClick = (profile: Profile) => {
    if (profile.passwordHash) {
      // Show password prompt for protected profiles
      setPasswordPrompt({ profile, password: '' })
    } else {
      // Switch directly for unprotected profiles
      handleSwitch(profile.id)
    }
  }

  const handleSwitch = async (profileId: string, password?: string) => {
    setIsLoading(true)
    setError('')
    try {
      await switchProfile(profileId, password)
      // Will reload the page
    } catch (err: any) {
      if (err.message === 'Invalid password') {
        setError('Incorrect password. Please try again.')
      } else if (err.message === 'Password required') {
        setError('This profile requires a password.')
      } else {
        setError('Failed to switch profile. Please try again.')
      }
      setIsLoading(false)
      setPasswordPrompt(null)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordPrompt) {
      handleSwitch(passwordPrompt.profile.id, passwordPrompt.password)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <FolderOpen className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Dual Budget Tracker</h1>
          <p className="text-center text-blue-100">
            {profiles.length === 0
              ? 'Create your first budget profile to get started'
              : 'Select a profile or create a new one'}
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isCreating ? (
            /* Create Profile Form */
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Smith Family, My Business, Personal"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes about this budget profile..."
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password (Optional)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank for no password"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Add a password to protect this profile</p>
              </div>

              {formData.password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password Hint (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.passwordHint}
                    onChange={(e) => setFormData({ ...formData, passwordHint: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., First pet's name"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">A hint to help you remember your password</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isLoading ? (
                    'Creating...'
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Create Profile
                    </>
                  )}
                </button>

                {profiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    disabled={isLoading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* Profile List */
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select a Profile</h2>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleProfileClick(profile)}
                    disabled={isLoading}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                            {profile.name}
                          </h3>
                          {profile.passwordHash && (
                            <span title="Password protected">
                              <Lock className="h-4 w-4 text-gray-400" />
                            </span>
                          )}
                        </div>
                        {profile.description && (
                          <p className="text-sm text-gray-500 mt-1">{profile.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Last accessed: {format(parseISO(profile.lastAccessedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsCreating(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50 font-medium"
              >
                <Plus className="h-5 w-5" />
                Create New Profile
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 text-center text-sm text-gray-500">
          Each profile stores its data separately
        </div>
      </div>

      {/* Password Prompt Modal */}
      {passwordPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Password Required</h3>
                  <p className="text-sm text-gray-500">{passwordPrompt.profile.name}</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Password
                  </label>
                  <input
                    type="password"
                    value={passwordPrompt.password}
                    onChange={(e) =>
                      setPasswordPrompt({ ...passwordPrompt, password: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter profile password"
                    disabled={isLoading}
                    autoFocus
                  />
                  {passwordPrompt.profile.passwordHint && (
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Hint:</span> {passwordPrompt.profile.passwordHint}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading || !passwordPrompt.password}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isLoading ? 'Unlocking...' : 'Unlock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordPrompt(null)
                      setError('')
                    }}
                    disabled={isLoading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
