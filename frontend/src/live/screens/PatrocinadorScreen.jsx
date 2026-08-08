import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, Loader2, ImageOff } from 'lucide-react';
import { API, getJson, postJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { openExternal } from '../../lib/nativeExport';

/**
 * Pieza ampliada de un patrocinador, dentro de la app.
 *
 * El banner del pie solo da para un vistazo; aquí el patrocinador puede poner
 * una imagen larga con toda la información. Se abre dentro de la app, con el
 * botón de volver de la barra: sacar al usuario al navegador para leer una
 * promoción es la forma más rápida de que no vuelva.
 *
 * El banner se busca por id en el listado público en vez de recibirlo por
 * navegación, para que la pantalla también funcione si se recarga o se llega
 * por un enlace directo.
 */
export default function PatrocinadorScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace() || {};
  const { adId } = useParams();

  const [ad, setAd] = useState(undefined);   // undefined = cargando, null = no está

  useEffect(() => {
    let cancel = false;
    getJson(`/api/ads/public${raceCode ? `?race_code=${raceCode}` : ''}`)
      .then((lista) => {
        if (cancel) return;
        setAd((lista || []).find((b) => b.id === adId) || null);
      })
      .catch(() => { if (!cancel) setAd(null); });
    return () => { cancel = true; };
  }, [adId, raceCode]);

  const abrirEnlace = () => {
    postJson('/api/ads/track', { banner_id: adId, event: 'click' }).catch(() => {});
    const url = ad.link_url.startsWith('http') ? ad.link_url : `https://${ad.link_url}`;
    openExternal(url);
  };

  return (
    <Screen title={ad?.name || 'Patrocinador'} back>
      <div className="px-4 py-4">
        {ad === undefined && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {ad === null && (
          <div className={`text-center py-14 px-6 ${T.muted}`}>
            <ImageOff className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Este contenido ya no está disponible</p>
          </div>
        )}

        {ad && (
          <>
            {ad.detail_url ? (
              // Ancho completo y alto automático: la imagen manda su propia
              // proporción y así no se deforma en ningún teléfono.
              <img
                src={`${API}${ad.detail_url}`}
                alt={ad.name}
                className="w-full h-auto rounded-2xl"
              />
            ) : (
              <p className={`text-sm ${T.muted}`}>{ad.text}</p>
            )}

            {ad.link_url && (
              <button
                onClick={abrirEnlace}
                className="w-full flex items-center justify-center gap-2 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm mt-4"
              >
                <ExternalLink className="w-4 h-4" /> Visitar {ad.name}
              </button>
            )}

            <p className={`text-[10px] text-center mt-5 ${T.subtle}`}>
              Contenido de nuestro patrocinador
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
