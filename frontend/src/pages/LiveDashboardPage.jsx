import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import LiveDashboard from '../components/LiveDashboard';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function LiveDashboardPage() {
  const { raceCode } = useParams();
  const [visibility, setVisibility] = useState({ loading: true, enabled: true, raceName: '', activeRaceCode: '' });
  
  useEffect(() => {
    const checkVisibility = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race-config/page-visibility`);
        if (response.ok) {
          const data = await response.json();
          // Only apply visibility restriction to the ACTIVE race
          // Past races should always be accessible
          const isActiveRace = !raceCode || data.race_code === raceCode;
          setVisibility({
            loading: false,
            enabled: isActiveRace ? data.show_tracking_page : true, // Always allow past races
            raceName: data.race_name,
            activeRaceCode: data.race_code
          });
        } else {
          setVisibility({ loading: false, enabled: true, raceName: '', activeRaceCode: '' });
        }
      } catch (error) {
        console.error('Error checking page visibility:', error);
        setVisibility({ loading: false, enabled: true, raceName: '', activeRaceCode: '' });
      }
    };
    checkVisibility();
  }, [raceCode]);
  
  if (visibility.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    );
  }
  
  if (!visibility.enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 pt-20 flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-lg border-amber-200">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Página No Disponible
            </h1>
            <p className="text-gray-600 mb-6">
              El seguimiento en vivo para <strong>{visibility.raceName || 'esta carrera'}</strong> no está activo en este momento.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Esta página estará habilitada durante el evento. Vuelve pronto para seguir a los atletas en tiempo real.
            </p>
            <Link to="/">
              <Button className="w-full" data-testid="go-home-btn">
                <Home className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="pt-20">
      <LiveDashboard raceCode={raceCode} />
    </div>
  );
}
