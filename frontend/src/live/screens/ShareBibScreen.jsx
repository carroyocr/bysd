import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Share2, Download, Loader2 } from 'lucide-react';
import { getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { enApp, shareImage, descargarBlob } from '../../lib/nativeExport';

// Lienzo 9:16 (1080x1920): tamaño nativo de las historias de Instagram
const W = 1080;
const H = 1920;

/** Dorsal siempre a tres cifras, como va impreso en la carrera (001). */
const bibDe3 = (bib) => String(bib ?? '').trim().padStart(3, '0');

function drawBibCard(ctx, { profile, raceName, siteUrl }) {
  // Fondo Linterna Nocturna
  ctx.fillStyle = '#0C0C0C';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 900);
  glow.addColorStop(0, 'rgba(231,118,34,0.16)');
  glow.addColorStop(1, 'rgba(231,118,34,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Marca
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 64px -apple-system, Helvetica, Arial';
  ctx.fillText('BYSD', W / 2 - 78, 200);
  ctx.fillStyle = '#E77622';
  ctx.fillText('LIVE', W / 2 + 92, 200);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '600 38px -apple-system, Helvetica, Arial';
  ctx.fillText(raceName, W / 2, 268, W - 160);

  // Tarjeta del dorsal
  const cardX = 110;
  const cardY = 420;
  const cardW = W - 220;
  const cardH = 760;
  ctx.save();
  ctx.beginPath();
  const r = 48;
  ctx.roundRect(cardX, cardY, cardW, cardH, r);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(231,118,34,0.35)';
  ctx.shadowBlur = 80;
  ctx.fill();
  ctx.restore();

  // Banda superior naranja de la tarjeta
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 150, [r, r, 0, 0]);
  ctx.fillStyle = '#E77622';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 46px -apple-system, Helvetica, Arial';
  ctx.fillText('BACKYARD ULTRA SANTO DOMINGO', W / 2, cardY + 95, cardW - 80);
  ctx.restore();

  // Número: siempre a tres cifras, como en el dorsal impreso (001)
  ctx.fillStyle = '#0C0C0C';
  ctx.font = '900 300px -apple-system, Helvetica, Arial';
  ctx.fillText(bibDe3(profile.bib), W / 2, cardY + 500);

  // Nombre
  ctx.font = '800 64px -apple-system, Helvetica, Arial';
  ctx.fillText(`${profile.nombre} ${profile.apellidos}`.toUpperCase(), W / 2, cardY + 620, cardW - 120);

  // Banda inferior
  ctx.beginPath();
  ctx.roundRect(cardX, cardY + cardH - 90, cardW, 90, [0, 0, r, r]);
  ctx.fillStyle = '#0C0C0C';
  ctx.fill();
  ctx.fillStyle = '#E77622';
  ctx.font = '700 40px -apple-system, Helvetica, Arial';
  ctx.fillText('LAST ONE STANDING', W / 2, cardY + cardH - 28);

  // Llamado a seguir
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 56px -apple-system, Helvetica, Arial';
  ctx.fillText('¡Sígueme en vivo!', W / 2, 1420);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '600 40px -apple-system, Helvetica, Arial';
  ctx.fillText(`Busca mi dorsal #${bibDe3(profile.bib)} en`, W / 2, 1500);
  ctx.fillStyle = '#E77622';
  ctx.font = '800 44px -apple-system, Helvetica, Arial';
  ctx.fillText(siteUrl, W / 2, 1575);

  ctx.fillStyle = '#666666';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.fillText('#BYSD #BackyardUltra #UltraRunning', W / 2, 1800);
}

/**
 * Compartir BIB: tarjeta 9:16 lista para publicar en Instagram, con el llamado
 * a seguir al corredor en vivo.
 */
export default function ShareBibScreen() {
  const { T } = useLiveTheme();
  const { raceCode, race } = useRace();
  const { bib } = useParams();
  const canvasRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    getJson(`/api/athletes/public-profile/${bib}?race_code=${raceCode}`)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [bib, raceCode]);

  useEffect(() => {
    if (!profile || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    drawBibCard(ctx, {
      profile,
      raceName: race?.name || 'Backyard Ultra Santo Domingo',
      siteUrl: 'backyardultrasantodomingo.com/live',
    });
  }, [profile, race]);

  const toBlob = useCallback(
    () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
    []
  );

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareImage(
        `bib-${bibDe3(profile.bib)}-bysd.png`,
        await toBlob(),
        `Sigue a ${profile.nombre} en el BYSD`,
      );
    } catch {
      /* usuario canceló el share */
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen title="Compartir BIB" back>
      <div className="px-4 py-4 flex flex-col items-center">
        {!profile ? (
          <div className={`flex justify-center py-20 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <p className={`text-xs mb-3 text-center ${T.muted}`}>
              Tarjeta lista para publicar en Instagram (formato historia 9:16)
            </p>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-[62%] max-w-[260px] rounded-2xl shadow-2xl"
            />
            <button
              onClick={handleShare}
              disabled={sharing}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartir mi BIB
            </button>
            {/* En la app no hay descargas del navegador: la imagen se guarda
                desde la misma hoja de compartir, así que el botón sobra. */}
            {!enApp() && (
              <button
                onClick={async () => descargarBlob(`bib-${bibDe3(profile.bib)}-bysd.png`, await toBlob())}
                className={`mt-2.5 w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 ${T.chip}`}
              >
                <Download className="w-4 h-4" /> Descargar imagen
              </button>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
