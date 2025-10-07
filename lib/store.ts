import { create } from 'zustand'

export type AppUser = any | null

export interface AppState {
  currentUser: AppUser
  setCurrentUser: (u: AppUser) => void
  isRefreshing: boolean
  setIsRefreshing: (v: boolean) => void
}

export const useAppStore = create<AppState>((set: any) => ({
  currentUser: null,
  setCurrentUser: (u: AppUser) => set({ currentUser: u }),
  isRefreshing: false,
  setIsRefreshing: (v: boolean) => set({ isRefreshing: v }),
}))
