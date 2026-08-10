import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Contact, MessageCircle, Trophy, Star, Mountain, Radio, Loader2, Instagram, Activity, AtSign,
} from 'lucide-react';
import { API, getAthleteProfile, raceIsPast, flagOf, initialsOf, useFollowed } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { openExternal } from '../../lib/nativeExport';

/**
 * Ficha del corredor: encabezado común a todas sus secciones.
 *
 * Antes cada sección —experiencia, compartir el BIB, enviar ánimo, resultados—
 * era una pantalla suelta con su propio título, así que al entrar en una se
 * perdían de vista el nombre del corredor y el resto de accesos: para pasar de
 * una a otra había que volver atrás. Ahora el encabezado y los botones viven
 * aquí, anclados bajo la barra, y debajo se cambia solo el contenido.
 *
 * "Seguimiento" es la primera sección y la de entrada: las vueltas, los
 * kilómetros y el gráfico de ritmo, que es lo que se mira durante la carrera.
 */
export default function FichaAtleta() {
  const { T } = useLiveTheme();
  const { raceCode, race } = useRace();
  const { bib } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);
  const followedStore = useFollowed();
  const [followed, setFollowed] = useState(followedStore.read());

  useEffect(() => {
    let cancel = false;
    setProfile(null);
    setFailed(false);
    getAthleteProfile(bib, raceCode)
      .then((p) => { if (!cancel) setProfile(p); })
      .catch(() => { if (!cancel) setFailed(true); });
    return () => { cancel = true; };
  }, [bib, raceCode]);

  const base = `/live/${raceCode}/atleta/${bib}`;
  // En carreras pasadas el dorsal ya no sirve para presentarse ni para
  // animar en vivo: solo quedan la experiencia y los resultados.
  const esPasada = raceIsPast(race);
  const tieneRedes = !!(profile?.instagram_url || profile?.strava_url);
  const secciones = [
    { label: 'Seguimiento', Icon: Radio, to: base },
    { label: 'Experiencia', Icon: Mountain, to: `${base}/experiencia` },
    tieneRedes && { label: 'Social', Icon: AtSign, to: `${base}/social` },
    !esPasada && { label: 'Compartir BIB', Icon: Contact, to: `${base}/bib` },
    !esPasada && { label: 'Enviar ánimo', Icon: MessageCircle, to: `${base}/animo` },
    { label: 'Resultados', Icon: Trophy, to: `${base}/resultados` },
  ].filter(Boolean);

  // Cambiar de sección sustituye la entrada del historial en vez de apilar
  // una nueva: las secciones son la misma ficha, no pasos de un camino. Si se
  // apilaran, volver atrás —con la flecha o deslizando— iría deshaciendo cada
  // botón pulsado en lugar de salir de la ficha.
  //
  // La de Seguimiento es la ruta base, que es prefijo de todas las demás: se
  // compara exacta o se quedaría siempre marcada.
  const activa = (to) => (to === base ? pathname.replace(/\/$/, '') === base : pathname.startsWith(to));

  return (
    <Screen title="Detalle del corredor" back showAds>
      {!profile && !failed && (
        <div className={`flex justify-center py-20 ${T.muted}`}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {failed && (
        <p className={`text-sm text-center py-16 ${T.muted}`}>No se pudo cargar la ficha del corredor.</p>
      )}

      {profile && (
        <div className="pb-4">
          <div className={`sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 ${T.page}`}>
            <div className="flex items-center gap-3.5 px-4 pt-4 pb-3">
              {profile.photo_url ? (
                <img
                  src={`${API}${profile.photo_url}`}
                  alt={profile.nombre}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#E77622] shrink-0"
                />
              ) : (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold border-2 border-[#E77622] shrink-0 ${T.avatar}`}>
                  {initialsOf(profile.nombre, profile.apellidos)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-extrabold leading-tight truncate">
                  {profile.nombre} {profile.apellidos}
                </p>
                <p className={`text-xs mt-0.5 ${T.muted}`}>
                  {[profile.sexo ? profile.sexo.charAt(0).toUpperCase() : null,
                    `${flagOf(profile.nacionalidad)} ${profile.nacionalidad || ''}`.trim(),
                    profile.ciudad_residencia]
                    .filter(Boolean).join(' | ')}
                </p>
                {/* Redes del corredor: solo aparecen si él las puso en su perfil */}
                {(profile.instagram_url || profile.strava_url) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {profile.instagram_url && (
                      <button
                        aria-label="Instagram del corredor"
                        onClick={() => openExternal(profile.instagram_url)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${T.actionChip}`}
                      >
                        <Instagram className="w-3.5 h-3.5 text-[#E77622]" />
                      </button>
                    )}
                    {profile.strava_url && (
                      <button
                        aria-label="Strava del corredor"
                        onClick={() => openExternal(profile.strava_url)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${T.actionChip}`}
                      >
                        <Activity className="w-3.5 h-3.5 text-[#E77622]" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-mono font-extrabold px-2.5 py-1 rounded-lg ${T.chipOn}`}>#{profile.bib}</span>
                <button
                  aria-label="Seguir"
                  onClick={() => setFollowed(followedStore.toggle(profile.bib))}
                  className="block ml-auto mt-2"
                >
                  <Star className={`w-5 h-5 ${followed.includes(profile.bib) ? 'text-[#E77622] fill-[#E77622]' : T.subtle}`} />
                </button>
              </div>
            </div>

            {/* Secciones: rejilla fija, sin scroll horizontal */}
            <div
              className="grid px-4 pb-4 gap-2"
              style={{ gridTemplateColumns: `repeat(${secciones.length}, minmax(0, 1fr))` }}
            >
              {secciones.map(({ label, Icon, to }) => {
                const puesta = activa(to);
                return (
                  <button
                    key={label}
                    onClick={() => navigate(to, { replace: true })}
                    aria-current={puesta}
                    className="flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <span className={`w-11 h-11 rounded-full flex items-center justify-center ${puesta ? T.chipOn : T.actionChip}`}>
                      <Icon className={`w-[18px] h-[18px] ${puesta ? '' : 'text-[#E77622]'}`} />
                    </span>
                    <span className={`text-[9.5px] text-center leading-tight ${puesta ? 'font-bold' : T.muted}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Outlet context={{ profile, raceCode, race, bib }} />
        </div>
      )}
    </Screen>
  );
}
