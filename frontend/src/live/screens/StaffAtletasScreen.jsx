import React from 'react';
import FichaEmergencia from '../components/FichaEmergencia';

/** Ficha de emergencia de los corredores inscritos. */
export default function StaffAtletasScreen() {
  return (
    <FichaEmergencia
      titulo="Atletas"
      endpoint="/api/athletes/staff/emergency-info"
      campoLista="atletas"
      vacio="Ningún atleta coincide"
    />
  );
}
