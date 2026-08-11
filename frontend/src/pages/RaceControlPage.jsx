import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Ruta antigua del control de carrera, cuando vivía fuera del panel.
 *
 * Ahora es una sección más de /admin, y necesita el contexto de carrera que el
 * panel monta a su alrededor; montarla suelta aquí reventaba. Se conserva la
 * ruta porque hay enlaces guardados y accesos directos en teléfonos del día de
 * la carrera.
 */
export default function RaceControlPage() {
  return <Navigate to="/admin?tab=control" replace />;
}
