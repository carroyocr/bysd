import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { LiveThemeProvider, useLiveTheme } from './liveTheme';
import { getJson, FOLLOWED_KEY, NOTIF_KEY } from './liveApi';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import AdFooter from './components/AdFooter';
import WelcomeScreen from './screens/WelcomeScreen';
import RaceSelectScreen from './screens/RaceSelectScreen';
import HomeScreen from './screens/HomeScreen';
import TrackingScreen from './screens/TrackingScreen';
import AthleteScreen from './screens/AthleteScreen';
import ShareBibScreen from './screens/ShareBibScreen';
import ShareResultsScreen from './screens/ShareResultsScreen';
import CheerScreen from './screens/CheerScreen';
import WinnersScreen from './screens/WinnersScreen';
import RaceInfoScreen from './screens/RaceInfoScreen';
import SponsorsScreen from './screens/SponsorsScreen';
import SettingsScreen from './screens/SettingsScreen';
import SosScreen from './screens/SosScreen';

const RaceContext = createContext(null);
export const useRace = () => useContext(RaceContext);

/**
 * Aviso de vueltas: mientras la app está abierta y las notificaciones están
 * activadas en Configuración, avisa cuando un favorito completa una vuelta.
 */
function useLapNotifications(raceCode) {
  const lastLaps = useRef({});

  useEffect(() => {
    const check = async () => {
      if (localStorage.getItem(NOTIF_KEY) !== 'on') return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      let followed = [];
      try {
        followed = JSON.parse(localStorage.getItem(FOLLOWED_KEY)) || [];
      } catch { /* sin favoritos */ }
      if (followed.length === 0) return;
      try {
        const participants = await getJson(`/api/race/participants?race_code=${raceCode}`);
        participants
          .filter((p) => followed.includes(p.bib))
          .forEach((p) => {
            const prev = lastLaps.current[p.bib];
            if (prev != null && (p.laps_completed || 0) > prev) {
              new Notification(`${p.nombre} ${p.apellidos} completó la vuelta ${p.laps_completed}`, {
                body: `#${p.bib} · ${(p.total_km || 0).toFixed(1)} km acumulados`,
              });
            }
            lastLaps.current[p.bib] = p.laps_completed || 0;
          });
      } catch { /* siguiente intento */ }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [raceCode]);
}

/**
 * Cascarón de una carrera seleccionada: carga su configuración, mantiene el
 * menú lateral y expone la carrera a todas las pantallas internas.
 */
function RaceShell() {
  const { raceCode } = useParams();
  const [race, setRace] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useLapNotifications(raceCode);

  useEffect(() => {
    let cancel = false;
    getJson(`/api/race-config/${raceCode}`)
      .then((data) => { if (!cancel) setRace(data); })
      .catch(() => { if (!cancel) setRace({ code: raceCode, name: raceCode }); });
    return () => { cancel = true; };
  }, [raceCode]);

  const ctx = {
    raceCode: raceCode?.toUpperCase(),
    race,
    openDrawer: () => setDrawerOpen(true),
  };

  return (
    <RaceContext.Provider value={ctx}>
      <Routes>
        <Route index element={<HomeScreen />} />
        <Route path="seguimiento" element={<TrackingScreen />} />
        <Route path="atleta/:bib" element={<AthleteScreen />} />
        <Route path="atleta/:bib/bib" element={<ShareBibScreen />} />
        <Route path="atleta/:bib/resultados" element={<ShareResultsScreen />} />
        <Route path="atleta/:bib/animo" element={<CheerScreen />} />
        <Route path="ganadores" element={<WinnersScreen />} />
        <Route path="info" element={<RaceInfoScreen />} />
        <Route path="patrocinadores" element={<SponsorsScreen />} />
        <Route path="config" element={<SettingsScreen />} />
        <Route path="sos" element={<SosScreen />} />
      </Routes>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        raceCode={raceCode}
        raceName={race?.name}
      />
    </RaceContext.Provider>
  );
}

/**
 * Plantilla de pantalla estándar: barra superior + contenido + pie publicitario.
 */
export function Screen({ title, back = false, children, noAds = false }) {
  const { T } = useLiveTheme();
  const { raceCode, openDrawer } = useRace() || {};

  return (
    <div className={`min-h-[100dvh] flex flex-col ${T.page}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh]">
        <TopBar title={title} back={back} onMenu={openDrawer} raceCode={raceCode} />
        <main className="flex-1">{children}</main>
        {!noAds && <AdFooter raceCode={raceCode} />}
      </div>
    </div>
  );
}

export default function LiveApp() {
  return (
    <LiveThemeProvider>
      <Routes>
        <Route index element={<WelcomeScreen />} />
        <Route path="carreras" element={<RaceSelectScreen />} />
        <Route path=":raceCode/*" element={<RaceShell />} />
      </Routes>
    </LiveThemeProvider>
  );
}
