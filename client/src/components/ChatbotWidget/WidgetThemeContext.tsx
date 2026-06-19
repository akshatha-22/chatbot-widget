import { createContext, useContext } from 'react'
import type { WidgetPosition } from '../../utils/widgetPosition'

export type WidgetThemeConfig = {
  primaryColor: string
  position: WidgetPosition
}

const defaultConfig: WidgetThemeConfig = {
  primaryColor: '#2979FF',
  position: 'bottom-right',
}

const WidgetThemeContext = createContext<WidgetThemeConfig>(defaultConfig)

export function WidgetThemeProvider({
  primaryColor = '#2979FF',
  position = 'bottom-right',
  children,
}: {
  primaryColor?: string
  position?: WidgetPosition
  children: React.ReactNode
}) {
  return (
    <WidgetThemeContext.Provider value={{ primaryColor, position }}>
      {children}
    </WidgetThemeContext.Provider>
  )
}

export function useWidgetTheme(): WidgetThemeConfig {
  return useContext(WidgetThemeContext)
}
