// src/theme/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'yellow' | 'blue'
interface ThemeCtx {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'yellow'
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-yellow', 'theme-blue')
    root.classList.add(`theme-${theme}`)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'yellow' ? 'blue' : 'yellow'
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}