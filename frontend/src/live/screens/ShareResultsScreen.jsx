import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Share2, Download, Loader2 } from 'lucide-react';
import { getJson, getAthleteProfile, formatDuration, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { enApp, shareImage, descargarBlob } from '../../lib/nativeExport';
import { cargarPresenting, dibujarPresenting } from '../../lib/presentingCanvas';
import { cargarAnuncio, dibujarAnuncio } from '../../lib/adCanvas';

const W = 1080;
const H = 1920;

// Miniatura del ritmo dentro de la tarjeta: la linea de todas las vueltas con
// su area debajo. Es lo que cuenta la historia de la carrera de un vistazo -se
// ve donde apreto y donde se le hizo cuesta arriba- y lo que distingue a esta
// imagen de un cartel con dos numeros.
function drawPaceSpark(ctx, laps, { x, y, w, h }) {
  const puntos = (laps || []).filter((l) => l.pace_seg_km != null);
  if (puntos.length < 2) return false;

  const ritmos = puntos.map((p) => p.pace_seg_km);
  const min = Math.min(...ritmos);
  const max = Math.max(...ritmos);
  const rango = Math.max(max - min, 30);
  const px = (i) => x + (i * w) / (puntos.length - 1);
  // El ritmo mas rapido arriba, como en las apps de corredores.
  const py = (ritmo) => y + ((ritmo - min) / rango) * h;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  // Dos guias: la del mejor ritmo y la del peor.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  [min, max].forEach((r) => {
    ctx.beginPath();
    ctx.moveTo(x, py(r));
    ctx.lineTo(x + w, py(r));
    ctx.stroke();
  });

  // El area bajo la linea, que es lo que le da cuerpo en una historia.
  const relleno = ctx.createLinearGradient(0, y, 0, y + h);
  relleno.addColorStop(0, 'rgba(231,118,34,0.45)');
  relleno.addColorStop(1, 'rgba(231,118,34,0.02)');
  ctx.beginPath();
  ctx.moveTo(px(0), py(puntos[0].pace_seg_km));
  puntos.forEach((p, i) => ctx.lineTo(px(i), py(p.pace_seg_km)));
  ctx.lineTo(px(puntos.length - 1), y + h);
  ctx.lineTo(px(0), y + h);
  ctx.closePath();
  ctx.fillStyle = relleno;
  ctx.fill();

  ctx.beginPath();
  puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(px(i), py(p.pace_seg_km)) : ctx.lineTo(px(i), py(p.pace_seg_km))));
  ctx.strokeStyle = '#E77622';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // La vuelta mas rapida, marcada: es el dato del que uno presume.
  const iMejor = ritmos.indexOf(min);
  ctx.beginPath();
  ctx.arc(px(iMejor), py(min), 11, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.fillStyle = '#9a9a9a';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`${fmt(min)}/km`, x, y - 16);
  ctx.textAlign = 'right';
  ctx.fillText(`${fmt(max)}/km`, x + w, y - 16);
  ctx.textAlign = 'center';
  ctx.fillText(`V1`, px(0), y + h + 38);
  ctx.fillText(`V${puntos[puntos.length - 1].lap}`, px(puntos.length - 1), y + h + 38);
  ctx.restore();
  return true;
}

function drawResultsCard(ctx, { profile, laps, raceName, siteUrl, presenting, anuncio }) {
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

  // El naming, pequeño y pegado al nombre de la carrera: acompaña a la marca
  // del evento, no compite con el dato del corredor.
  dibujarPresenting(ctx, presenting, {
    x: W / 2, y: 292, anchoLogo: 150, rotulo: 18, margen: 12, separacion: 14,
  });

  // Nombre y dorsal. Empiezan en 430 y no en 400: la placa del naming termina
  // en 358 y con el nombre más arriba se le montaba encima.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 72px -apple-system, Helvetica, Arial';
  ctx.fillText(`${profile.nombre} ${profile.apellidos}`, W / 2, 430, W - 140);
  ctx.fillStyle = '#E77622';
  ctx.font = '800 52px -apple-system, Helvetica, Arial';
  ctx.fillText(`#${profile.bib} · ${statusLabel(profile.status).toUpperCase()}`, W / 2, 505);

  // Vueltas gigante
  ctx.fillStyle = '#E77622';
  ctx.font = '900 320px -apple-system, Helvetica, Arial';
  ctx.fillText(`${profile.laps_completed || 0}`, W / 2, 800);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '700 52px -apple-system, Helvetica, Arial';
  ctx.fillText('VUELTAS COMPLETADAS', W / 2, 880);

  // Metricas
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
    ctx.fillText(m.value, cx, 1010);
    ctx.fillStyle = '#777777';
    ctx.font = '700 34px -apple-system, Helvetica, Arial';
    ctx.fillText(m.label, cx, 1070);
  });

  // Grafico de ritmo
  ctx.fillStyle = '#777777';
  ctx.font = '700 34px -apple-system, Helvetica, Arial';
  ctx.fillText('RITMO POR VUELTA', W / 2, 1160);
  drawPaceSpark(ctx, laps, { x: 140, y: 1230, w: W - 280, h: 210 });

  // Linea divisoria
  ctx.strokeStyle = 'rgba(231,118,34,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(200, 1530);
  ctx.lineTo(W - 200, 1530);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 52px -apple-system, Helvetica, Arial';
  ctx.fillText('Sigue la carrera en vivo', W / 2, 1600);
  ctx.fillStyle = '#E77622';
  ctx.font = '800 44px -apple-system, Helvetica, Arial';
  ctx.fillText(siteUrl, W / 2, 1660);

  ctx.fillStyle = '#666666';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.fillText('#BYSD #BackyardUltra #LastOneStanding', W / 2, 1712);

  // El patrocinador cierra la tarjeta, en la misma proporción 5:1 del pie de
  // la app. Si la carrera no tiene publicidad, aquí no se dibuja nada y el
  // resto de la tarjeta queda igual.
  dibujarAnuncio(ctx, anuncio, { x: (W - 700) / 2, y: 1750, w: 700, h: 140 });
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
  // Igual que en la tarjeta del dorsal: el naming se carga aparte y la tarjeta
  // se redibuja cuando llega.
  const [presenting, setPresenting] = useState(null);
  // El patrocinador de la banda: uno al azar entre los publicados, sorteado
  // cada vez que se abre la pantalla.
  const [anuncio, setAnuncio] = useState(null);

  useEffect(() => {
    cargarPresenting(raceCode).then(setPresenting);
    cargarAnuncio(raceCode).then(setAnuncio);
  }, [raceCode]);

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
      presenting,
      anuncio,
    });
  }, [data, race, presenting, anuncio]);

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
