// Duración de una actividad: se captura como texto libre en el panel
// ("2", "2 horas", "90 min", "1:30"), así que hay que interpretarla para poder
// decir a qué hora termina. Lo usan la pestaña de actividades del perfil y la
// página pública de inscripción.

// Devuelve los minutos, o null si no se puede interpretar.
export const parseDurationMinutes = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  if (!s) return null;

  const hm = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  let minutes = 0;
  let found = false;
  const horas = s.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hrs|hora|horas)/);
  if (horas) { minutes += parseFloat(horas[1]) * 60; found = true; }
  const mins = s.match(/(\d+)\s*(?:m\b|min|mins|minuto|minutos)/);
  if (mins) { minutes += parseInt(mins[1], 10); found = true; }

  // Solo un numero: se asume que son horas
  if (!found && /^\d+(?:\.\d+)?$/.test(s)) { minutes = parseFloat(s) * 60; found = true; }

  return found && minutes > 0 ? Math.round(minutes) : null;
};

// Hora en que termina = inicio + duracion. null si falta o no se puede calcular.
export const getEndTime = (iso, duration) => {
  const minutes = parseDurationMinutes(duration);
  if (!iso || minutes === null) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + minutes * 60000);
  return end.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
};
