import { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Estas carreras tienen los patrocinadores fijos en SponsorsSection, no en la base.
const LEGACY_SPONSOR_RACES = ['BYSD-2026'];

/**
 * Indica si una carrera tiene patrocinadores publicados.
 * Mientras `loading` sea true no se sabe todavía: no muestres nada.
 */
export default function useHasSponsors(raceCode) {
  const [hasSponsors, setHasSponsors] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!raceCode) {
      setHasSponsors(false);
      setLoading(true);
      return;
    }

    const code = raceCode.toUpperCase();

    if (LEGACY_SPONSOR_RACES.includes(code)) {
      setHasSponsors(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchSponsors = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sponsors/race/${code}`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setHasSponsors((data.sponsors || []).length > 0);
        } else if (!cancelled) {
          setHasSponsors(false);
        }
      } catch (error) {
        console.error('Error fetching sponsors:', error);
        if (!cancelled) setHasSponsors(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSponsors();

    return () => {
      cancelled = true;
    };
  }, [raceCode]);

  return { hasSponsors, loading };
}
