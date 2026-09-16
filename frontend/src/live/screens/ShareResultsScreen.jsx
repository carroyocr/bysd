import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Share2, Download, Loader2 } from 'lucide-react';
import { getJson, getAthleteProfile, formatDuration, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { enApp, shareImage, descargarBlob } from '../../lib/nativeExport';
import { dibujarDescargaApp } from '../shareCard';

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

function drawResultsCard(ctx, { profile, laps, raceName }) {
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
  ctx.fillText(`#${profile.bib} · ${statusLabel(profile.status).toUpperCase()}`, W / 2, 495);

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
  ctx.fillText('Sigue la carrera en vivo', W / 2, 1620);
  dibujarDescargaApp(ctx, { x: W / 2, y: 1695 });

  ctx.fillStyle = '#666666';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.fillText('#BYSD #BackyardUltra #LastOneStanding', W / 2, 1840);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * La salida tal como la anuncia la carrera: "sábado 17 de octubre" y "9:00 a. m.".
 *
 * Se lee de la cadena ISO que manda el backend, que ya viene en la hora de la
 * carrera. Pasarla por la zona del teléfono daría otra hora a quien la comparta
 * desde fuera del país.
 */
function salidaAnunciada(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
  if (!m) return null;
  const [, anio, mes, dia, hora, minuto] = m.map(Number);
  const diaSemana = DIAS[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
  const h12 = hora % 12 || 12;
  return {
    fecha: `${diaSemana} ${dia} de ${MESES[mes - 1]}`,
    hora: `${h12}:${String(minuto).padStart(2, '0')} ${hora < 12 ? 'a. m.' : 'p. m.'}`,
  };
}

/**
 * Lo que falta para la salida, en la unidad que se lee de un golpe.
 *
 * Los días se cuentan por calendario en la hora de la carrera, no dividiendo
 * segundos: la víspera por la mañana faltan 25 horas, y eso es "1 día", no 2.
 */
function cuentaAtras(segundos, iso) {
  const s = Math.max(0, segundos || 0);
  const m = /^(\d{4})-(\d{2})-(\d{2})T.*([+-])(\d{2}):(\d{2})$/.exec(iso || '');
  if (m && s >= 3600) {
    const [, anio, mes, dia, signo, oh, om] = m;
    const desfase = (signo === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om));
    const hoy = new Date(Date.now() + desfase * 60000);
    const dias = Math.round(
      (Date.UTC(Number(anio), Number(mes) - 1, Number(dia))
        - Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())) / 86400000,
    );
    if (dias >= 1) {
      return { numero: dias, texto: dias === 1 ? 'DÍA PARA LA SALIDA' : 'DÍAS PARA LA SALIDA' };
    }
  }
  if (s >= 3600) {
    const horas = Math.floor(s / 3600);
    return { numero: horas, texto: horas === 1 ? 'HORA PARA LA SALIDA' : 'HORAS PARA LA SALIDA' };
  }
  const minutos = Math.max(1, Math.ceil(s / 60));
  return { numero: minutos, texto: minutos === 1 ? 'MINUTO PARA LA SALIDA' : 'MINUTOS PARA LA SALIDA' };
}

/**
 * La tarjeta de antes de la salida. Con la carrera sin empezar, la de
 * resultados era un cero gigante y un gráfico vacío: aquí lo que se cuenta es
 * cuándo sale y cuánto falta.
 */
function drawPreRaceCard(ctx, { profile, raceName, vuelta }) {
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
  ctx.fillText(`#${profile.bib} · LISTO PARA LA SALIDA`, W / 2, 495, W - 140);

  // Cuenta atrás gigante, en el sitio de las vueltas
  const falta = cuentaAtras(vuelta?.seconds_remaining, vuelta?.started_at);
  ctx.fillStyle = '#E77622';
  ctx.font = '900 320px -apple-system, Helvetica, Arial';
  ctx.fillText(`${falta.numero}`, W / 2, 800);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '700 52px -apple-system, Helvetica, Arial';
  ctx.fillText(falta.texto, W / 2, 880);

  // Cuándo es
  const salida = salidaAnunciada(vuelta?.started_at);
  if (salida) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 80px -apple-system, Helvetica, Arial';
    ctx.fillText(salida.fecha.toUpperCase(), W / 2, 1030, W - 140);
    ctx.fillStyle = '#777777';
    ctx.font = '700 44px -apple-system, Helvetica, Arial';
    ctx.fillText(`SALIDA ${salida.hora.toUpperCase()}`, W / 2, 1100);
  }

  // El formato, para quien no sabe qué es un backyard
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 48px -apple-system, Helvetica, Arial';
  ctx.fillText('Una vuelta cada hora', W / 2, 1300);
  ctx.fillStyle = '#E77622';
  ctx.fillText('hasta que solo quede uno', W / 2, 1370);

  ctx.strokeStyle = 'rgba(231,118,34,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(200, 1530);
  ctx.lineTo(W - 200, 1530);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 52px -apple-system, Helvetica, Arial';
  ctx.fillText('Sígueme en vivo', W / 2, 1620);
  dibujarDescargaApp(ctx, { x: W / 2, y: 1695 });

  ctx.fillStyle = '#666666';
  ctx.font = '600 30px -apple-system, Helvetica, Arial';
  ctx.fillText('#BYSD #BackyardUltra #LastOneStanding', W / 2, 1840);
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

  useEffect(() => {
    Promise.all([
      getAthleteProfile(bib, raceCode),
      getJson(`/api/race/athlete-laps/${bib}?race_code=${raceCode}`).catch(() => ({ laps: [] })),
      // Si el reloj de la carrera no responde se sigue con la de resultados,
      // que es la que había.
      getJson(`/api/race/lap-status?race_code=${raceCode}`).catch(() => null),
    ])
      .then(([profile, lapsData, vuelta]) => setData({ profile, laps: lapsData.laps || [], vuelta }))
      .catch(() => setData(null));
  }, [bib, raceCode]);

  // Antes de la salida no hay resultados que enseñar. Cuenta como empezada en
  // cuanto llega la hora prevista, aunque nadie haya pulsado "Iniciar carrera".
  const antesDeLaSalida = !!data?.vuelta && data.vuelta.race_started === false
    && !data.vuelta.race_finished;

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const raceName = race?.name || 'Backyard Ultra Santo Domingo';
    if (antesDeLaSalida) drawPreRaceCard(ctx, { ...data, raceName });
    else drawResultsCard(ctx, { ...data, raceName });
  }, [data, race, antesDeLaSalida]);

  const toBlob = useCallback(
    () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
    []
  );

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareImage(
        `${antesDeLaSalida ? 'salida' : 'resultados'}-${data.profile.bib}-bysd.png`,
        await toBlob(),
        antesDeLaSalida
          ? `Sigue a ${data.profile.nombre} en el BYSD`
          : `Resultados de ${data.profile.nombre} en el BYSD`,
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
              {antesDeLaSalida ? 'Compartir' : 'Compartir resultados'}
            </button>
            {!enApp() && (
              <button
                onClick={async () => descargarBlob(`${antesDeLaSalida ? 'salida' : 'resultados'}-${data.profile.bib}-bysd.png`, await toBlob())}
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
    <Screen title={antesDeLaSalida ? 'Compartir' : 'Compartir resultados'} back>{contenido}</Screen>
  );

}
