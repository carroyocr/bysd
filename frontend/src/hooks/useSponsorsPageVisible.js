import { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Dice si la página de patrocinadores de una carrera está encendida.
 *
 * El interruptor es `show_sponsors_page` y se enciende desde
 * Administración > Carreras, igual que Comunidad, Seguimiento y Voluntarios.
 * Antes esto se deducía de si la carrera tenía patrocinadores publicados, que
 * no es lo mismo: una carrera podía tenerlos y no querer enseñarlos todavía, y
 * el menú de las carreras anteriores ofrecía un enlace que rebotaba al inicio.
 *
 * Se pregunta a `/api/race-config/all` y no a `/{code}` porque ese endpoint
 * distingue mayúsculas y los códigos viajan en minúsculas por la URL.
 *
 * Mientras `loading` sea true no se sabe todavía: no decidas nada.
 */
export default function useSponsorsPageVisible(raceCode) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!raceCode) {
      setVisible(false);
      setLoading(true);
      return;
    }

    const code = raceCode.toUpperCase();
    let cancelled = false;
    setLoading(true);

    const fetchVisibility = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/all`);
        if (response.ok) {
          const data = await response.json();
          const races = data.races || data || [];
          const race = races.find((r) => (r.code || '').toUpperCase() === code);
          // Sin interruptor guardado, encendida: es el valor por defecto del
          // backend y evita que una carrera vieja desaparezca sin avisar.
          if (!cancelled) setVisible(!!race && race.show_sponsors_page !== false);
        } else if (!cancelled) {
          setVisible(false);
        }
      } catch (error) {
        console.error('Error fetching sponsors page visibility:', error);
        if (!cancelled) setVisible(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchVisibility();

    return () => {
      cancelled = true;
    };
  }, [raceCode]);

  return { visible, loading };
}
