import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { LiveThemeProvider, useLiveTheme } from './liveTheme';
import { getJson, FOLLOWED_KEY, NOTIF_KEY } from './liveApi';
import { pushDisponible, refrescarPush } from './push';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import AdFooter from './components/AdFooter';
import WelcomeScreen from './screens/WelcomeScreen';
import RaceSelectScreen from './screens/RaceSelectScreen';
import HomeScreen from './screens/HomeScreen';
import TrackingScreen from './screens/TrackingScreen';
import AthleteScreen from './screens/AthleteScreen';
import ShareBibScreen from './screens/ShareBibScreen';
import FotosScreen from './screens/FotosScreen';
import ExperienciaScreen from './screens/ExperienciaScreen';
import ShareResultsScreen from './screens/ShareResultsScreen';
import CheerScreen from './screens/CheerScreen';
import WinnersScreen from './screens/WinnersScreen';
import RaceInfoScreen from './screens/RaceInfoScreen';
import SponsorsScreen from './screens/SponsorsScreen';
import PatrocinadorScreen from './screens/PatrocinadorScreen';
import SettingsScreen from './screens/SettingsScreen';
import SosScreen from './screens/SosScreen';
import PerfilScreen from './screens/PerfilScreen';
import LoginScreen from './screens/LoginScreen';
import StaffScreen from './screens/StaffScreen';
import StaffAtletasScreen from './screens/StaffAtletasScreen';
import ReglasScreen from './screens/ReglasScreen';
import LogisticaScreen from './screens/LogisticaScreen';
import FaqScreen from './screens/FaqScreen';

const RaceContext = createContext(null);
export const useRace = () => useContext(RaceContext);

/**
 * Aviso de vueltas en el navegador: mientras la pestaña está abierta y las
 * notificaciones están activadas en Configuración, avisa cuando un favorito
 * completa una vuelta.
 *
 * En la app instalada esto no corre: allí los avisos llegan por push desde el
 * backend, que además funciona con la app cerrada. Si corriesen los dos, cada
 * vuelta se notificaría dos veces.
 */
function useLapNotifications(raceCode) {
  const lastLaps = useRef({});

  useEffect(() => {
    if (pushDisponible()) return undefined;

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
  const { raceCode: rawCode } = useParams();
  // El backend distingue mayúsculas en los códigos; se normaliza una sola
  // vez aquí para que la URL funcione venga como venga (bysd-2026, BYSD-2026).
  const raceCode = rawCode?.toUpperCase();
  const [race, setRace] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useLapNotifications(raceCode);

  // El token de Firebase caduca y la carrera activa cambia de un año a otro:
  // al entrar a una carrera se refresca el registro para que los avisos sigan
  // llegando sin que el usuario tenga que volver a Configuración.
  useEffect(() => {
    refrescarPush(raceCode);
  }, [raceCode]);

  useEffect(() => {
    let cancel = false;
    getJson(`/api/race-config/${raceCode}`)
      .then((data) => { if (!cancel) setRace(data); })
      .catch(() => { if (!cancel) setRace({ code: raceCode, name: raceCode }); });
    return () => { cancel = true; };
  }, [raceCode]);

  const ctx = {
    raceCode,
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
        <Route path="atleta/:bib/fotos" element={<FotosScreen />} />
        <Route path="atleta/:bib/experiencia" element={<ExperienciaScreen />} />
        <Route path="atleta/:bib/resultados" element={<ShareResultsScreen />} />
        <Route path="atleta/:bib/animo" element={<CheerScreen />} />
        <Route path="animo" element={<CheerScreen />} />
        <Route path="ganadores" element={<WinnersScreen />} />
        <Route path="info" element={<RaceInfoScreen />} />
        <Route path="reglas" element={<ReglasScreen />} />
        <Route path="logistica" element={<LogisticaScreen />} />
        <Route path="faq" element={<FaqScreen />} />
        <Route path="patrocinadores" element={<SponsorsScreen />} />
        <Route path="patrocinador/:adId" element={<PatrocinadorScreen />} />
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
 * Plantilla de pantalla estándar: barra superior + contenido. El pie
 * publicitario solo aparece donde se pide con showAds (inicio, detalle del
 * corredor, ganadores y enviar ánimo). Dentro de una carrera usa su menú
 * lateral; fuera (perfil, staff) monta uno propio con la carrera activa.
 */
export function Screen(props) {
  const ctx = useRace();
  return ctx ? <RaceScreen {...props} ctx={ctx} /> : <StandaloneScreen {...props} />;
}

function ScreenLayout({ T, title, back, onMenu, raceCode, showAds, children, footer }) {
  return (
    <div className={`min-h-[100dvh] flex flex-col ${T.page}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh]">
        <TopBar title={title} back={back} onMenu={onMenu} raceCode={raceCode} />
        <main className="flex-1">{children}</main>
        {showAds && <AdFooter raceCode={raceCode} />}
        {footer}
      </div>
    </div>
  );
}

function RaceScreen({ title, back = false, children, showAds = false, ctx }) {
  const { T } = useLiveTheme();
  return (
    <ScreenLayout
      T={T}
      title={title}
      back={back}
      onMenu={ctx.openDrawer}
      raceCode={ctx.raceCode}
      showAds={showAds}
    >
      {children}
    </ScreenLayout>
  );
}

/** Pantallas fuera de una carrera: el menú lateral usa la carrera activa. */
function StandaloneScreen({ title, back = false, children, showAds = false }) {
  const { T } = useLiveTheme();
  const [active, setActive] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/active')
      .then((data) => { if (!cancel) setActive(data); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  return (
    <ScreenLayout
      T={T}
      title={title}
      back={back}
      onMenu={() => setDrawerOpen(true)}
      raceCode={active?.code}
      showAds={showAds}
      footer={(
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          raceCode={active?.code}
          raceName={active?.name}
        />
      )}
    >
      {children}
    </ScreenLayout>
  );
}

export default function LiveApp() {
  return (
    <LiveThemeProvider>
      <Routes>
        <Route index element={<WelcomeScreen />} />
        <Route path="carreras" element={<RaceSelectScreen />} />
        {/* Antes de :raceCode para que no se interpreten como código de carrera */}
        <Route path="login" element={<LoginScreen />} />
        <Route path="perfil" element={<PerfilScreen />} />
        <Route path="staff" element={<StaffScreen />} />
        <Route path="staff/atletas" element={<StaffAtletasScreen />} />
        <Route path=":raceCode/*" element={<RaceShell />} />
      </Routes>
    </LiveThemeProvider>
  );
}
