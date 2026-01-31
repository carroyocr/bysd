import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default values when no config is available
const DEFAULT_CONFIG = {
  code: 'BYSD-2026',
  name: 'Backyard Ultra Santo Domingo 2026',
  date: '2026-01-24',
  start_time: '09:00',
  location: 'Sierra Prieta, Santo Domingo, República Dominicana',
  logo_url: '/icon-bu.png',
  is_active: true,
  is_default: true,
  registration_cost: 3500,
  edition_number: 1
};

const RaceConfigContext = createContext(null);

export function RaceConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/race-config/active`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error loading race config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Helper function to format the race date for display
  const getFormattedDate = () => {
    if (!config.date) return '';
    
    const date = new Date(config.date + 'T00:00:00');
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('es-ES', options);
  };

  // Helper function to get the race start datetime
  const getRaceStartDate = () => {
    if (!config.date || !config.start_time) {
      return new Date('2026-01-24T09:00:00-04:00');
    }
    return new Date(`${config.date}T${config.start_time}:00-04:00`);
  };

  // Helper to get the short date format (e.g., "Sábado 24 Enero, 2026")
  const getShortDate = () => {
    if (!config.date) return 'Sábado 24 Enero, 2026';
    
    const date = new Date(config.date + 'T00:00:00');
    const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' });
    const day = date.getDate();
    const month = date.toLocaleDateString('es-ES', { month: 'long' });
    const year = date.getFullYear();
    
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month.charAt(0).toUpperCase() + month.slice(1)}, ${year}`;
  };

  // Get year only
  const getYear = () => {
    if (!config.date) return '2026';
    return config.date.split('-')[0];
  };

  // Get race code slug (lowercase, for URLs)
  const getRaceSlug = () => {
    return config.code ? config.code.toLowerCase() : 'bysd-2026';
  };

  const value = {
    config,
    loading,
    error,
    refetch: fetchConfig,
    // Computed helpers
    getFormattedDate,
    getRaceStartDate,
    getShortDate,
    getYear,
    getRaceSlug,
    // Shorthand getters
    raceName: config.name || DEFAULT_CONFIG.name,
    raceCode: config.code || DEFAULT_CONFIG.code,
    raceDate: config.date || DEFAULT_CONFIG.date,
    raceTime: config.start_time || DEFAULT_CONFIG.start_time,
    raceLocation: config.location || DEFAULT_CONFIG.location,
    raceLogo: config.logo_url || DEFAULT_CONFIG.logo_url,
  };

  return (
    <RaceConfigContext.Provider value={value}>
      {children}
    </RaceConfigContext.Provider>
  );
}

export function useRaceConfig() {
  const context = useContext(RaceConfigContext);
  if (!context) {
    throw new Error('useRaceConfig must be used within a RaceConfigProvider');
  }
  return context;
}

export default RaceConfigContext;
