import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import SponsorsSection from '../components/SponsorsSection';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import useSponsorsPageVisible from '../hooks/useSponsorsPageVisible';

export default function PatrocinadoresPage() {
  const { raceCode } = useParams();
  const { config } = useRaceConfig();
  const displayRaceCode = raceCode || config?.code;
  const { visible, loading } = useSponsorsPageVisible(displayRaceCode);

  // Mientras se consulta no se decide nada: evita el parpadeo del redirect
  if (loading) {
    return (
      <div className="pt-16">
        <section className="py-10">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </section>
      </div>
    );
  }

  // La página existe si su interruptor está encendido, se decide en
  // Administración > Carreras y no depende de que haya patrocinadores cargados
  if (!visible) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pt-16">
      <SponsorsSection raceCode={raceCode} />
    </div>
  );
}
