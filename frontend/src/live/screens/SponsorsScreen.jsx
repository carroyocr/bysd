import React, { useEffect, useState } from 'react';
import { Building2, Instagram, Loader2 } from 'lucide-react';
import { API, getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { LEGACY_SPONSORS, LEGACY_RACE_CODES } from '../../content/legacySponsors';
import { openExternal } from '../../lib/nativeExport';

/**
 * Patrocinadores de la carrera seleccionada: las ediciones legadas (2026)
 * usan la lista fija compartida con el sitio; las nuevas, el panel.
 */
export default function SponsorsScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const [sponsors, setSponsors] = useState(null);

  useEffect(() => {
    let cancel = false;
    if (LEGACY_RACE_CODES.includes(raceCode)) {
      // logo local del build; misma forma que los del panel
      setSponsors(LEGACY_SPONSORS.map((s) => ({ ...s, logo_url: s.logo })));
      return () => { cancel = true; };
    }
    getJson(`/api/sponsors/race/${raceCode}`)
      .then((data) => { if (!cancel) setSponsors(Array.isArray(data) ? data : data.sponsors || []); })
      .catch(() => { if (!cancel) setSponsors([]); });
    return () => { cancel = true; };
  }, [raceCode]);

  return (
    <Screen title="Patrocinadores">
      <div className="px-4 py-4">
        {sponsors === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {sponsors !== null && sponsors.length === 0 && (
          <div className={`text-center py-14 ${T.muted}`}>
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Próximamente</p>
            <p className="text-xs mt-1.5">Los patrocinadores de esta edición se anunciarán pronto.</p>
          </div>
        )}

        {(sponsors || []).map((s) => (
          <div key={s.name} className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 mb-2.5 ${T.card}`}>
            {s.logo_url ? (
              <img
                src={s.logo_url.startsWith('/api') ? `${API}${s.logo_url}` : s.logo_url}
                alt={s.name}
                className="w-14 h-14 rounded-xl object-contain bg-white shrink-0"
              />
            ) : (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${T.avatar}`}>
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{s.name}</p>
              {s.description && <p className={`text-xs mt-0.5 line-clamp-2 ${T.muted}`}>{s.description}</p>}
            </div>
            {s.instagram && (
              <button
                onClick={() => openExternal(
                  s.instagram.startsWith('http')
                    ? s.instagram
                    : `https://instagram.com/${s.instagram.replace('@', '')}`
                )}
                aria-label={`Instagram de ${s.name}`}
                className="w-9 h-9 flex items-center justify-center shrink-0"
              >
                <Instagram className="w-5 h-5 text-[#E77622]" />
              </button>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}
