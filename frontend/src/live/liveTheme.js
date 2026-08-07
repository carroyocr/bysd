import React, { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'bysd_live_theme';

// Paleta por tema: identidad "Linterna Nocturna" (negro + naranja BYSD) con la
// estructura de barra superior de color y contenido claro del diseño de referencia.
export const THEMES = {
  dark: {
    name: 'dark',
    page: 'bg-[#0C0C0C] text-white',
    bar: 'bg-[#111111] text-white border-b border-[#262626]',
    barAccent: 'text-[#E77622]',
    drawer: 'bg-[#141414] text-white border-r border-[#262626]',
    drawerItem: 'border-b border-[#222222] text-[#dddddd]',
    card: 'bg-[#161616] border border-[#242424]',
    cardOff: 'bg-[#161616] border border-[#242424] opacity-60',
    chip: 'bg-[#1a1a1a] text-[#999999] border border-[#2a2a2a]',
    chipOn: 'bg-[#2a1a0d] text-[#E77622] border border-[#E77622]',
    tab: 'text-[#888888]',
    tabOn: 'text-[#E77622] border-b-2 border-[#E77622]',
    avatar: 'bg-[#2b2b2b] text-[#E77622]',
    muted: 'text-[#9a9a9a]',
    subtle: 'text-[#777777]',
    input: 'bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#666666]',
    footer: 'bg-[#161616] border-t border-[#262626]',
    itraBox: 'bg-[#1d1509] border border-[#3a2a12]',
    divider: 'border-[#242424]',
    tableHead: 'text-[#777777] border-b border-[#2a2a2a]',
    tableRow: 'border-b border-[#1e1e1e]',
    actionChip: 'bg-[#1d1d1d] text-[#cccccc]',
  },
  light: {
    name: 'light',
    page: 'bg-[#FAF6EA] text-[#232323]',
    bar: 'bg-[#E77622] text-white',
    barAccent: 'text-white',
    drawer: 'bg-white text-[#232323] border-r border-[#eee3c2]',
    drawerItem: 'border-b border-[#f2ead0] text-[#3a3a3a]',
    card: 'bg-white border border-[#efe6c8] shadow-sm',
    cardOff: 'bg-white border border-[#efe6c8] opacity-60',
    chip: 'bg-white text-[#8a8060] border border-[#e8dcb4]',
    chipOn: 'bg-[#FDEEDF] text-[#E77622] border border-[#E77622]',
    tab: 'text-[#9a8f6a]',
    tabOn: 'text-[#E77622] border-b-2 border-[#E77622]',
    avatar: 'bg-[#F2E8C7] text-[#8a6a1e]',
    muted: 'text-[#9a8f6a]',
    subtle: 'text-[#b08944]',
    input: 'bg-white border border-[#e8dcb4] text-[#232323] placeholder-[#b0a685]',
    footer: 'bg-white border-t border-[#efe6c8]',
    itraBox: 'bg-[#FDF6E3] border border-[#eddfb5]',
    divider: 'border-[#efe6c8]',
    tableHead: 'text-[#b08944] border-b border-[#eadfba]',
    tableRow: 'border-b border-[#f4edd8]',
    actionChip: 'bg-[#F4EDD8] text-[#6b5c2e]',
  },
};

const LiveThemeContext = createContext(null);

export function LiveThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    T: THEMES[theme] || THEMES.dark,
  };

  return <LiveThemeContext.Provider value={value}>{children}</LiveThemeContext.Provider>;
}

export function useLiveTheme() {
  return useContext(LiveThemeContext);
}
