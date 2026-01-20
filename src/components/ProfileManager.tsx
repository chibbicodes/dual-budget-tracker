import { useState } from 'react'
import { useProfile } from '../contexts/ProfileContext'
import { FolderOpen, Edit2, Trash2, Download, Upload, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import ProfileService from '../services/profileService'

export default function ProfileManager() {
  const { profiles, activeProfile, updateProfile, deleteProfile, switchProfile } = useProfile()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [error, setError] = useState('')

  const handleEdit = (profile: any) => {
    setEditingId(profile.id)
    setFormData({
      name: profile.name,
      description: profile.description || '',
    })
    setError('')
  }

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      setError('Please enter a profile name')
      return
    }

    try {
      updateProfile(editingId!, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      })
      setEditingId(null)
      setFormData({ name: '', description: '' })
      setError('')
    } catch (err) {
      setError('Failed to update profile')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ name: '', description: '' })
    setError('')
  }

  const handleDelete = async (profileId: string, profileName: string) => {
    if (activeProfile?.id === profileId) {
      alert('Cannot delete the active profile. Please switch to another profile first.')
      return
    }

    if (profiles.length === 1) {
      alert('Cannot delete the only profile.')
      return
    }

    if (
      confirm(
        `Are you sure you want to delete the profile "${profileName}"? All data for this profile will be permanently deleted. This action cannot be undone.`
      )
    ) {
      try {
        await deleteProfile(profileId)
        alert('Profile deleted successfully')
      } catch (err: any) {
        alert(err.message || 'Failed to delete profile')
      }
    }
  }

  const handleSwitch = async (profileId: string) => {
    if (activeProfile?.id === profileId) {
      return // Already active
    }

    try {
      await switchProfile(profileId)
      // Will reload the page
    } catch (err) {
      alert('Failed to switch profile')
    }
  }

  const handleExport = (profileId: string) => {
    try {
      const jsonData = ProfileService.exportProfile(profileId)
      const profile = profiles.find((p) => p.id === profileId)
      const filename = `${profile?.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`

      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export profile')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await readFile(file)
      const profileName = prompt('Enter a name for the imported profile:', 'Imported Profile')
      if (!profileName) return

      ProfileService.importProfile(content, profileName)
      alert('Profile imported successfully! You can now switch to it.')
      window.location.reload()
    } catch (err) {
      alert('Failed to import profile. Please check the file format.')
    }

    // Reset file input
    event.target.value = ''
  }

  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          resolve(content)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  return (
    <div className="space-y-6">
      {/* Active Profile Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-lg">
              <FolderOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Active Profile</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{activeProfile?.name}</p>
              {activeProfile?.description && (
                <p className="text-sm text-gray-600 mt-1">{activeProfile.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => handleExport(activeProfile!.id)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Import Profile */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Import Profile</h3>
          <p className="text-sm text-gray-500 mt-1">Import a profile from a previously exported file</p>
        </div>
        <div className="p-6">
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer inline-flex">
            <Upload className="h-4 w-4" />
            Choose File to Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <p className="text-sm text-gray-500 mt-3">
            Imported profiles will be added to your profile list and won't affect existing profiles.
          </p>
        </div>
      </div>

      {/* All Profiles */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Profiles</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage your budget profiles. Click on a profile to switch to it.
          </p>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {profiles.map((profile) =>
              editingId === profile.id ? (
                <div key={profile.id} className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Profile Name"
                    />
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Description (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={profile.id}
                  className={`border-2 rounded-lg p-4 transition-all ${
                    activeProfile?.id === profile.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
                  }`}
                  onClick={() => activeProfile?.id !== profile.id && handleSwitch(profile.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{profile.name}</h4>
                        {activeProfile?.id === profile.id && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      {profile.description && (
                        <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Created: {format(parseISO(profile.createdAt), 'MMM d, yyyy')}</span>
                        <span>Last accessed: {format(parseISO(profile.lastAccessedAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(profile)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit profile"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExport(profile.id)
                        }}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Export profile"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {profiles.length > 1 && activeProfile?.id !== profile.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(profile.id, profile.name)
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete profile"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Important Notes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Each profile stores its data separately</li>
                  <li>Switching profiles will reload the app</li>
                  <li>You cannot delete the active profile - switch to another one first</li>
                  <li>Export profiles regularly to back up your data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
