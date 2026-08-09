import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Instagram, Activity, ExternalLink, AtSign } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { openExternal } from '../../lib/nativeExport';

/** "https://www.instagram.com/pepe" -> "pepe". El enlace entero no se lee. */
const usuarioDeEnlace = (url) => (url ? url.replace(/\/+$/, '').split('/').pop() : '');

/**
 * Sección "Social" de la ficha: las cuentas que el propio corredor publicó en
 * su perfil. Solo salen las que él puso; si no puso ninguna, la sección no
 * llega a ofrecerse.
 */
export default function SocialScreen() {
  const { T } = useLiveTheme();
  const { profile } = useOutletContext();

  const redes = [
    profile?.instagram_url && {
      clave: 'instagram',
      nombre: 'Instagram',
      Icon: Instagram,
      url: profile.instagram_url,
    },
    profile?.strava_url && {
      clave: 'strava',
      nombre: 'Strava',
      Icon: Activity,
      url: profile.strava_url,
    },
  ].filter(Boolean);

  return (
    <div className="px-4 py-4">
      <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
        <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
          <AtSign className="w-4 h-4 text-[#E77622]" /> Sígueme
        </h3>
        <p className={`text-[11px] leading-relaxed mb-4 ${T.muted}`}>
          Cuentas que {profile?.nombre || 'el corredor'} publicó en su perfil.
        </p>

        {redes.length === 0 ? (
          <p className={`text-xs py-2 ${T.muted}`}>
            Este corredor no ha publicado sus redes.
          </p>
        ) : redes.map(({ clave, nombre, Icon, url }) => (
          <button
            key={clave}
            onClick={() => openExternal(url)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-2 last:mb-0 text-left ${T.input}`}
          >
            <span className="w-9 h-9 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#E77622]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{nombre}</p>
              <p className={`text-[11px] truncate ${T.muted}`}>{usuarioDeEnlace(url)}</p>
            </div>
            <ExternalLink className={`w-4 h-4 shrink-0 ${T.subtle}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
