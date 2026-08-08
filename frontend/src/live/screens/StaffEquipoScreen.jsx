import React from 'react';
import FichaEmergencia from '../components/FichaEmergencia';

/**
 * Ficha de emergencia del equipo de staff.
 *
 * Quien está 24 horas en pie en el corral también puede descomponerse, y hasta
 * ahora sus datos de salud solo existían en el panel de administración.
 */
export default function StaffEquipoScreen() {
  return (
    <FichaEmergencia
      titulo="Equipo"
      endpoint="/api/staff/equipo/emergency-info"
      campoLista="equipo"
      encabezado={(v) => v.telefono || ''}
      vacio="Nadie del equipo coincide"
    />
  );
}
