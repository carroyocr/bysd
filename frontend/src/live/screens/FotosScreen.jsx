import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, ChevronRight, Loader2, X } from 'lucide-react';
import { API, getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Fotos del evento: galería a pantalla dedicada con visor simple.
 */
export default function FotosScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const [photos, setPhotos] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancel = false;
    getJson(`/api/race-config/live-photos/${raceCode}`)
      .then((d) => {
        if (cancel) return;
        if (d.photos?.length) {
          setPhotos(d.photos.map((p, i) => ({ index: i, url: `${API}${p.url}` })));
        } else {
          return getJson('/api/album/photos').then((a) => {
            if (!cancel) setPhotos((a.photos || []).map((p) => ({ ...p, url: `${p.url}=w600` })));
          });
        }
      })
      .catch(() => { if (!cancel) setPhotos([]); });
    return () => { cancel = true; };
  }, [raceCode]);

  return (
    <Screen title="Fotos del evento" back>
      <div className="px-3.5 py-3.5">
        {photos === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {photos !== null && photos.length === 0 && (
          <div className={`text-center py-14 ${T.muted}`}>
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Todavía no hay fotos</p>
            <p className="text-xs mt-1.5">Las fotos estarán disponibles durante el evento.</p>
          </div>
        )}

        {photos !== null && photos.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((ph) => (
                <button
                  key={ph.index}
                  onClick={() => setSelected(ph)}
                  className="aspect-square rounded-2xl overflow-hidden"
                >
                  <img src={ph.url} alt="Foto del evento" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
            <a
              href="/album"
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-[#E77622] flex items-center justify-center gap-1.5"
            >
              Ver el álbum completo del evento <ChevronRight className="w-4 h-4" />
            </a>
          </>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <button aria-label="Cerrar" className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={selected.url} alt="Foto del evento" className="max-w-full max-h-[85dvh] object-contain" />
        </div>
      )}
    </Screen>
  );
}
