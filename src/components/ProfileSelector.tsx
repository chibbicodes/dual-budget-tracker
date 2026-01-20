import { useState } from 'react'
import { useProfile } from '../contexts/ProfileContext'
import { FolderOpen, Plus, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function ProfileSelector() {
  const { profiles, createProfile, switchProfile } = useProfile()
  const [isCreating, setIsCreating] = useState(profiles.length === 0)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Please enter a profile name')
      return
    }

    setIsLoading(true)
    try {
      await createProfile(formData.name.trim(), formData.description.trim() || undefined)
      // Profile context will automatically set this as active
      // and trigger a reload
    } catch (err) {
      setError('Failed to create profile. Please try again.')
      setIsLoading(false)
    }
  }

  const handleSwitch = async (profileId: string) => {
    setIsLoading(true)
    try {
      await switchProfile(profileId)
      // Will reload the page
    } catch (err) {
      setError('Failed to switch profile. Please try again.')
      setIsLoading(false)
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
                    onClick={() => handleSwitch(profile.id)}
                    disabled={isLoading}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                          {profile.name}
                        </h3>
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
    </div>
  )
}
