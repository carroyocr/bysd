import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import SponsorsSection from '../components/SponsorsSection';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import useHasSponsors from '../hooks/useHasSponsors';

export default function PatrocinadoresPage() {
  const { raceCode } = useParams();
  const { config } = useRaceConfig();
  const displayRaceCode = raceCode || config?.code;
  const { hasSponsors, loading } = useHasSponsors(displayRaceCode);

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

  // La página solo existe cuando la carrera tiene patrocinadores publicados
  if (!hasSponsors) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pt-16">
      <SponsorsSection raceCode={raceCode} />
    </div>
  );
}
