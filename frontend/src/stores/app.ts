import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { 
  User, 
  ArmbianConfiguration, 
  BuildJob, 
  AppState, 
  BuildUpdateEvent
} from '@/types'
import { FlexLayoutConfig } from '@/types/flexlayout'

interface AppStore extends AppState {
  // Actions
  setUser: (user: User | null) => void
  updateUserPreferences: (preferences: Partial<User['preferences']>) => void
  
  // Layout actions
  setLayout: (layout: FlexLayoutConfig) => void
  setActivePanel: (panelId: string | null) => void
  saveLayout: (name: string, layout: FlexLayoutConfig) => void
  loadLayout: (name: string) => FlexLayoutConfig | null
  getSavedLayouts: () => string[]
  
  // Configuration actions
  addConfiguration: (config: ArmbianConfiguration) => void
  updateConfiguration: (id: string, updates: Partial<ArmbianConfiguration>) => void
  deleteConfiguration: (id: string) => void
  duplicateConfiguration: (id: string, newName: string) => void
  setConfigurations: (configs: ArmbianConfiguration[]) => void
  getConfiguration: (id: string) => ArmbianConfiguration | undefined
  
  // Build job actions
  addBuildJob: (job: BuildJob) => void
  updateBuildJob: (id: string, updates: Partial<BuildJob>) => void
  setBuildJobs: (jobs: BuildJob[]) => void
  getBuildJob: (id: string) => BuildJob | undefined
  getBuildJobsByConfiguration: (configId: string) => BuildJob[]
  getActiveBuildJobs: () => BuildJob[]
  
  // Socket-based build event handlers
  handleBuildCreated: (event: { id: string; status: string; message: string; timestamp: string; configurationId?: string; configuration?: any }) => void
  handleBuildUpdate: (event: { id: string; status: string; progress: number; message: string; timestamp: string; configurationId?: string; configuration?: any }) => void
  handleBuildCompleted: (event: { id: string; status: string; progress: number; message: string; artifacts?: any[]; timestamp: string; configurationId?: string; configuration?: any }) => void
  handleBuildFailed: (event: { id: string; status: string; message: string; timestamp: string; configurationId?: string; configuration?: any }) => void
  
  // UI state actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Persistence actions
  hydrate: () => void
  reset: () => void
}

const initialState: AppState = {
  user: null,
  configurations: [],
  buildJobs: [],
  activePanel: null,
  layout: null,
  theme: 'auto',
  isLoading: false,
  error: null,
}

// Create the store with middleware
export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // User actions
        setUser: (user) => set((state) => {
          state.user = user
          if (user?.preferences?.layout) {
            state.layout = user.preferences.layout
          }
          if (user?.preferences?.theme) {
            state.theme = user.preferences.theme
          }
        }),

        updateUserPreferences: (preferences) => set((state) => {
          if (state.user) {
            state.user.preferences = { ...state.user.preferences, ...preferences }
          }
        }),

        // Layout actions
        setLayout: (layout) => set((state) => {
          state.layout = layout
          if (state.user) {
            state.user.preferences.layout = layout
          }
        }),

        setActivePanel: (panelId) => set((state) => {
          state.activePanel = panelId
        }),

        saveLayout: (name, layout) => {
          const layouts = JSON.parse(localStorage.getItem('bbos-layouts') || '{}')
          layouts[name] = layout
          localStorage.setItem('bbos-layouts', JSON.stringify(layouts))
        },

        loadLayout: (name) => {
          const layouts = JSON.parse(localStorage.getItem('bbos-layouts') || '{}')
          return layouts[name] || null
        },

        getSavedLayouts: () => {
          const layouts = JSON.parse(localStorage.getItem('bbos-layouts') || '{}')
          return Object.keys(layouts)
        },

        // Configuration actions
        addConfiguration: (config) => set((state) => {
          state.configurations.push(config)
        }),

        updateConfiguration: (id, updates) => set((state) => {
          const index = state.configurations.findIndex(c => c.id === id)
          if (index !== -1) {
            state.configurations[index] = { ...state.configurations[index], ...updates }
          }
        }),

        deleteConfiguration: (id) => set((state) => {
          state.configurations = state.configurations.filter(c => c.id !== id)
          // Also remove related build jobs
          state.buildJobs = state.buildJobs.filter(j => j.configurationId !== id)
        }),

        duplicateConfiguration: (id, newName) => set((state) => {
          const original = state.configurations.find(c => c.id === id)
          if (original) {
            const newConfig: ArmbianConfiguration = {
              ...original,
              id: crypto.randomUUID(),
              name: newName,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            state.configurations.push(newConfig)
          }
        }),

        setConfigurations: (configs) => set((state) => {
          state.configurations = configs
        }),

        getConfiguration: (id) => {
          return get().configurations.find(c => c.id === id)
        },

        // Build job actions
        addBuildJob: (job) => set((state) => {
          // Check if build already exists to avoid duplicates
          const existingIndex = state.buildJobs.findIndex(j => j.id === job.id)
          if (existingIndex !== -1) {
            state.buildJobs[existingIndex] = job
          } else {
            state.buildJobs.push(job)
          }
        }),

        updateBuildJob: (id, updates) => set((state) => {
          const index = state.buildJobs.findIndex(j => j.id === id)
          if (index !== -1) {
            state.buildJobs[index] = { ...state.buildJobs[index], ...updates }
          } else {
            // If build doesn't exist, create it with the updates
            const newBuild: BuildJob = {
              id,
              userId: 'current-user',
              configurationId: updates.configurationId || 'unknown',
              configurationSnapshot: {} as ArmbianConfiguration,
              status: 'queued',
              progress: {
                percentage: 0,
                currentStage: 'Queued'
              },
              timing: {
                queuedAt: new Date().toISOString()
              },
              logs: [],
              artifacts: [],
              priority: 1,
              retryCount: 0,
              maxRetries: 3,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ...updates
            }
            state.buildJobs.push(newBuild)
          }
        }),

        setBuildJobs: (jobs) => set((state) => {
          state.buildJobs = jobs
        }),

        getBuildJob: (id) => {
          return get().buildJobs.find(j => j.id === id)
        },

        getBuildJobsByConfiguration: (configId) => {
          return get().buildJobs.filter(j => j.configurationId === configId)
        },

        getActiveBuildJobs: () => {
          const activeStatuses = ['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading']
          return get().buildJobs.filter(j => activeStatuses.includes(j.status))
        },

        // Socket-based build event handlers
        handleBuildCreated: (event) => set((state) => {
          console.log('🏗️ Store: Build created event:', event)
          
          // Create a new build job from the event
          const newBuild: BuildJob = {
            id: event.id,
            userId: 'current-user',
            configurationId: event.configurationId || 'unknown',
            configurationSnapshot: event.configuration || {} as ArmbianConfiguration,
            status: event.status as BuildJob['status'],
            progress: {
              percentage: 0,
              currentStage: event.message || 'Queued'
            },
            timing: {
              queuedAt: event.timestamp
            },
            logs: [{
              timestamp: event.timestamp,
              level: 'info',
              message: event.message
            }],
            artifacts: [],
            priority: 1,
            retryCount: 0,
            maxRetries: 3,
            createdAt: event.timestamp,
            updatedAt: event.timestamp
          }
          
          // Add to builds if it doesn't exist
          const existingIndex = state.buildJobs.findIndex(j => j.id === event.id)
          if (existingIndex === -1) {
            state.buildJobs.unshift(newBuild) // Add to beginning for newest first
          }
        }),

        handleBuildUpdate: (event) => set((state) => {
          console.log('🏗️ Store: Build update event:', event)
          
          const index = state.buildJobs.findIndex(j => j.id === event.id)
          if (index !== -1) {
            // Update existing build
            const build = state.buildJobs[index]
            state.buildJobs[index] = {
              ...build,
              status: event.status as BuildJob['status'],
              progress: {
                percentage: event.progress || build.progress?.percentage || 0,
                currentStage: event.message || build.progress?.currentStage || 'Building'
              },
              timing: {
                ...build.timing,
                startedAt: build.timing.startedAt || (event.status !== 'queued' ? event.timestamp : undefined)
              },
              logs: [
                ...build.logs,
                {
                  timestamp: event.timestamp,
                  level: 'info',
                  message: event.message
                }
              ],
              updatedAt: event.timestamp
            }
          } else {
            // Create new build if it doesn't exist (shouldn't happen, but handle gracefully)
            const newBuild: BuildJob = {
              id: event.id,
              userId: 'current-user',
              configurationId: 'unknown',
              configurationSnapshot: {} as ArmbianConfiguration,
              status: event.status as BuildJob['status'],
              progress: {
                percentage: event.progress || 0,
                currentStage: event.message || 'Building'
              },
              timing: {
                queuedAt: event.timestamp,
                startedAt: event.status !== 'queued' ? event.timestamp : undefined
              },
              logs: [{
                timestamp: event.timestamp,
                level: 'info',
                message: event.message
              }],
              artifacts: [],
              priority: 1,
              retryCount: 0,
              maxRetries: 3,
              createdAt: event.timestamp,
              updatedAt: event.timestamp
            }
            state.buildJobs.unshift(newBuild)
          }
        }),

        handleBuildCompleted: (event) => set((state) => {
          console.log('✅ Store: Build completed event:', event)
          
          const index = state.buildJobs.findIndex(j => j.id === event.id)
          if (index !== -1) {
            const build = state.buildJobs[index]
            state.buildJobs[index] = {
              ...build,
              status: 'completed',
              progress: {
                percentage: 100,
                currentStage: 'Completed'
              },
              timing: {
                ...build.timing,
                completedAt: event.timestamp,
                duration: build.timing.startedAt ? 
                  Math.floor((new Date(event.timestamp).getTime() - new Date(build.timing.startedAt).getTime()) / 1000) :
                  undefined
              },
              artifacts: event.artifacts || build.artifacts,
              logs: [
                ...build.logs,
                {
                  timestamp: event.timestamp,
                  level: 'info',
                  message: event.message
                }
              ],
              updatedAt: event.timestamp
            }
          }
        }),

        handleBuildFailed: (event) => set((state) => {
          console.log('❌ Store: Build failed event:', event)
          
          const index = state.buildJobs.findIndex(j => j.id === event.id)
          if (index !== -1) {
            const build = state.buildJobs[index]
            state.buildJobs[index] = {
              ...build,
              status: 'failed',
              progress: {
                percentage: build.progress?.percentage || 0,
                currentStage: 'Failed'
              },
              timing: {
                ...build.timing,
                completedAt: event.timestamp,
                duration: build.timing.startedAt ? 
                  Math.floor((new Date(event.timestamp).getTime() - new Date(build.timing.startedAt).getTime()) / 1000) :
                  undefined
              },
              error: {
                code: 'BUILD_FAILED',
                message: event.message
              },
              logs: [
                ...build.logs,
                {
                  timestamp: event.timestamp,
                  level: 'error',
                  message: event.message
                }
              ],
              updatedAt: event.timestamp
            }
          }
        }),

        // UI state actions
        setTheme: (theme) => set((state) => {
          state.theme = theme
          if (state.user) {
            state.user.preferences.theme = theme
          }
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading
        }),

        setError: (error) => set((state) => {
          state.error = error
        }),

        clearError: () => set((state) => {
          state.error = null
        }),

        // Persistence actions
        hydrate: () => {
          // This will be called when the store is rehydrated from storage
          const state = get()
          console.log('Store hydrated:', { 
            user: !!state.user, 
            configs: state.configurations.length,
            jobs: state.buildJobs.length 
          })
        },

        reset: () => set(() => ({ ...initialState })),
      })),
      {
        name: 'bbos-app-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          configurations: state.configurations,
          buildJobs: state.buildJobs,
          layout: state.layout,
          theme: state.theme,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.hydrate()
          }
        },
      }
    )
  )
)

// Selectors for optimized component subscriptions
export const useUser = () => useAppStore((state) => state.user)
export const useConfigurations = () => useAppStore((state) => state.configurations)
export const useBuildJobs = () => useAppStore((state) => state.buildJobs)
export const useActivePanel = () => useAppStore((state) => state.activePanel)
export const useLayout = () => useAppStore((state) => state.layout)
export const useTheme = () => useAppStore((state) => state.theme)
export const useLoading = () => useAppStore((state) => state.isLoading)
export const useError = () => useAppStore((state) => state.error)

// Computed selectors
export const useActiveBuildJobs = () => useAppStore((state) => state.getActiveBuildJobs())
export const useConfigurationById = (id: string) => useAppStore((state) => state.getConfiguration(id))
export const useBuildJobById = (id: string) => useAppStore((state) => state.getBuildJob(id))
export const useBuildJobsByConfiguration = (configId: string) => 
  useAppStore((state) => state.getBuildJobsByConfiguration(configId))

// Actions selectors
export const useAppActions = () => useAppStore((state) => ({
  setUser: state.setUser,
  updateUserPreferences: state.updateUserPreferences,
  setLayout: state.setLayout,
  setActivePanel: state.setActivePanel,
  saveLayout: state.saveLayout,
  loadLayout: state.loadLayout,
  getSavedLayouts: state.getSavedLayouts,
  addConfiguration: state.addConfiguration,
  updateConfiguration: state.updateConfiguration,
  deleteConfiguration: state.deleteConfiguration,
  duplicateConfiguration: state.duplicateConfiguration,
  setConfigurations: state.setConfigurations,
  addBuildJob: state.addBuildJob,
  updateBuildJob: state.updateBuildJob,
  setBuildJobs: state.setBuildJobs,
  setTheme: state.setTheme,
  setLoading: state.setLoading,
  setError: state.setError,
  clearError: state.clearError,
  handleBuildCreated: state.handleBuildCreated,
  handleBuildUpdate: state.handleBuildUpdate,
  handleBuildCompleted: state.handleBuildCompleted,
  handleBuildFailed: state.handleBuildFailed,
  reset: state.reset,
}))

export default useAppStore 