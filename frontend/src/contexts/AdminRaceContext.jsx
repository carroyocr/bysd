import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sobre qué carrera se está trabajando en el panel.
 *
 * Es distinto de `RaceConfigContext`, que dice cuál carrera ve el público. Los
 * dos coincidían mientras solo podía haber una carrera viva, y por eso el panel
 * usaba el del público; con el campeonato mundial de octubre y la carrera
 * abierta de enero a la vez, hacen falta separados: el sitio sigue mostrando la
 * de enero mientras la organización trabaja sobre el campeonato.
 *
 * La elección se guarda en la URL (para poder pasar un enlace ya situado) y en
 * el navegador (para no tener que elegirla en cada visita).
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;
const RECUERDO = 'panel_carrera';

const AdminRaceContext = createContext(null);

// Orden de trabajo: primero la que se está corriendo, luego las que vienen y
// al final las pasadas. Es el orden en el que hacen falta.
const PESO_ESTADO = { en_carrera: 0, inscripcion: 1, borrador: 2, cerrada: 3 };

function ordenar(carreras) {
  return [...carreras].sort((a, b) => {
    const pa = PESO_ESTADO[a.estado] ?? (a.is_active ? 1 : 3);
    const pb = PESO_ESTADO[b.estado] ?? (b.is_active ? 1 : 3);
    if (pa !== pb) return pa - pb;
    return (b.date || '').localeCompare(a.date || '');
  });
}

export function AdminRaceProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [raceCode, setRaceCodeState] = useState(
    () => searchParams.get('race') || localStorage.getItem(RECUERDO) || ''
  );

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/race-config/all`);
      if (!res.ok) throw new Error('No se pudo cargar la lista de carreras');
      const data = await res.json();
      setCarreras(ordenar(data.races || []));
    } catch (err) {
      console.error('Error cargando carreras del panel:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Si la carrera recordada ya no existe (o nunca se eligió ninguna), se cae en
  // la primera del orden de trabajo, que es la que se está corriendo.
  useEffect(() => {
    if (loading || !carreras.length) return;
    const existe = carreras.some((c) => c.code === raceCode);
    if (!existe) setRaceCodeState(carreras[0].code);
  }, [loading, carreras, raceCode]);

  useEffect(() => {
    if (!raceCode) return;
    localStorage.setItem(RECUERDO, raceCode);
    if (searchParams.get('race') !== raceCode) {
      const siguiente = new URLSearchParams(searchParams);
      siguiente.set('race', raceCode);
      setSearchParams(siguiente, { replace: true });
    }
  }, [raceCode, searchParams, setSearchParams]);

  const valor = useMemo(() => {
    const carrera = carreras.find((c) => c.code === raceCode) || null;
    return {
      carreras,
      carrera,
      raceCode,
      setRaceCode: setRaceCodeState,
      loading,
      recargar: cargar,
      raceName: carrera?.name || '',
      esHistorica: !!carrera?.is_legacy || carrera?.estado === 'cerrada',
      // Añade race_code a cualquier URL del panel. Los endpoints del panel lo
      // exigen a propósito: sin él responden 422 en vez de adivinar carrera.
      conCarrera: (url) => {
        if (!raceCode) return url;
        return `${url}${url.includes('?') ? '&' : '?'}race_code=${encodeURIComponent(raceCode)}`;
      },
    };
  }, [carreras, raceCode, loading, cargar]);

  return <AdminRaceContext.Provider value={valor}>{children}</AdminRaceContext.Provider>;
}

export function useAdminRace() {
  const contexto = useContext(AdminRaceContext);
  if (!contexto) {
    throw new Error('useAdminRace debe usarse dentro de <AdminRaceProvider>');
  }
  return contexto;
}
