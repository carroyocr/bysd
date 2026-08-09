import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Share2, Download, Loader2 } from 'lucide-react';
import { getJson, getAthleteProfile, formatDuration, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { enApp, shareImage, descargarBlob } from '../../lib/nativeExport';

const W = 1080;
const H = 1920;

function drawResultsCard(ctx, { profile, laps, raceName, siteUrl }) {
  ctx.fillStyle = '#0C0C0C';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 700, 100, W / 2, 700, 900);
  glow.addColorStop(0, 'rgba(231,118,34,0.18)');
  glow.addColorStop(1, 'rgba(231,118,34,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 64px -apple-system, Helvetica, Arial';
  ctx.fillText('BYSD', W / 2 - 78, 180);
  ctx.fillStyle = '#E77622';
  ctx.fillText('LIVE', W / 2 + 92, 180);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '600 38px -apple-system, Helvetica, Arial';
  ctx.fillText(raceName, W / 2, 248, W - 160);

  // Nombre y dorsal
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 72px -apple-system, Helvetica, Arial';
  ctx.fillText(`${profile.nombre} ${profile.apellidos}`, W / 2, 420, W - 140);
  ctx.fillStyle = '#E77622';
  ctx.font = '800 52px -apple-system, Helvetica, Arial';
  ctx.fillText(`#${profile.bib} · ${statusLabel(profile.status).toUpperCase()}`, W / 2, 505);

  // Vueltas gigante
  ctx.fillStyle = '#E77622';
  ctx.font = '900 380px -apple-system, Helvetica, Arial';
  ctx.fillText(`${profile.laps_completed || 0}`, W / 2, 950);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '700 52px -apple-system, Helvetica, Arial';
  ctx.fillText('VUELTAS COMPLETADAS', W / 2, 1030);

  // Métricas
  const totalSeg = laps.reduce((acc, l) => acc + (l.duracion_seg || 0), 0);
  const metrics = [
    { label: 'KILÓMETROS', value: `${(profile.total_km || 0).toFixed(1)}` },
    { label: 'TIEMPO EN RUTA', value: totalSeg ? formatDuration(totalSeg) : '—' },
  ];
  const colW = (W - 300) / metrics.length;
  metrics.forEach((m, i) => {
    const cx = 150 + colW * i + colW / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 90px -apple-system, Helvetica, Arial';
    ctx.fillText(m.value, cx, 1220);
    ctx.fillStyle = '#777777';
    ctx.font = '700 34px -apple-system, Helvetica, Arial';
    ctx.fillText(m.label, cx, 1280);
  });

  // Línea divisoria
  ctx.strokeStyle = 'rgba(231,118,34,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(200, 1370);
  ctx.lineTo(W - 200, 1370);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 52px -apple-system, Helvetica, Arial';
  ctx.fillText('Sigue la carrera en vivo', W / 2, 1480);
  ctx.fillStyle = '#E77622';
  ctx.font = '800 44px -apple-system, Helvetica, Arial';
  ctx.fillText(siteUrl, W / 2, 1555);

  ctx.fillStyle = '#666666';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.fillText('#BYSD #BackyardUltra #LastOneStanding', W / 2, 1800);
}

/**
 * Compartir resultados: imagen 9:16 con vueltas, km y tiempo, lista para Instagram.
 */
export default function ShareResultsScreen() {
  // Dentro de la ficha del corredor esto es una sección más; suelta, es
  // una pantalla con su propio título.
  const enFicha = !!useOutletContext();
  const { T } = useLiveTheme();
  const { raceCode, race } = useRace();
  const { bib } = useParams();
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    Promise.all([
      getAthleteProfile(bib, raceCode),
      getJson(`/api/race/athlete-laps/${bib}?race_code=${raceCode}`).catch(() => ({ laps: [] })),
    ])
      .then(([profile, lapsData]) => setData({ profile, laps: lapsData.laps || [] }))
      .catch(() => setData(null));
  }, [bib, raceCode]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    drawResultsCard(ctx, {
      ...data,
      raceName: race?.name || 'Backyard Ultra Santo Domingo',
      siteUrl: 'backyardultrasantodomingo.com/live',
    });
  }, [data, race]);

  const toBlob = useCallback(
    () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
    []
  );

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareImage(
        `resultados-${data.profile.bib}-bysd.png`,
        await toBlob(),
        `Resultados de ${data.profile.nombre} en el BYSD`,
      );
    } catch {
      /* usuario canceló */
    } finally {
      setSharing(false);
    }
  };

  const contenido = (
    <>
      <div className="px-4 py-4 flex flex-col items-center">
        {!data ? (
          <div className={`flex justify-center py-20 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <p className={`text-xs mb-3 text-center ${T.muted}`}>
              Imagen lista para publicar en Instagram (formato historia 9:16)
            </p>
            <canvas ref={canvasRef} width={W} height={H} className="w-[62%] max-w-[260px] rounded-2xl shadow-2xl" />
            <button
              onClick={handleShare}
              disabled={sharing}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartir resultados
            </button>
            {!enApp() && (
              <button
                onClick={async () => descargarBlob(`resultados-${data.profile.bib}-bysd.png`, await toBlob())}
                className={`mt-2.5 w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 ${T.chip}`}
              >
                <Download className="w-4 h-4" /> Descargar imagen
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  // Suelta (fuera de la ficha del corredor) necesita su propia pantalla;
  // dentro, el encabezado y el botón de volver ya los pone FichaAtleta.
  return enFicha ? contenido : (
    <Screen title="Compartir resultados" back>{contenido}</Screen>
  );

}
