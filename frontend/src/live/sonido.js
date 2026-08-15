// Un clic corto al pulsar, sintetizado en el momento.
//
// Sin archivo de audio a propósito: un mp3 hay que descargarlo, cachearlo y
// esperar a que cargue, y la primera pulsación —justo la que importa— saldría
// muda. Aquí el sonido se genera con unos pocos parámetros y suena siempre
// igual.
//
// Qué es un clic: un golpe seco y muy corto, con ruido dentro. Un tono puro,
// aunque caiga rápido, se oye como un pitido de microondas; lo que el oído
// reconoce como "clic" es un chasquido de banda ancha de unos milisegundos,
// como el de una tecla o un interruptor. Por eso la fuente es ruido filtrado
// y no un oscilador.
//
// El contexto de audio se crea la primera vez que se pulsa algo, nunca al
// arrancar: los navegadores solo lo dejan sonar si viene de un gesto del
// usuario, y crearlo antes lo deja suspendido.
//
// En el teléfono respeta el interruptor de silencio del sistema, que es lo que
// espera cualquiera que lleve el teléfono en silencio.
let ctx;
let ruido;

/** Un segundo de ruido blanco, generado una vez y reutilizado en cada clic. */
function bufferDeRuido(audio) {
  if (ruido) return ruido;
  ruido = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const datos = ruido.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  return ruido;
}

export function clic() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const fuente = ctx.createBufferSource();
    fuente.buffer = bufferDeRuido(ctx);
    // Entra por un punto cualquiera del ruido: así dos clics seguidos no son
    // exactamente el mismo sonido y no suenan a máquina.
    const desde = Math.random() * 0.9;

    // Paso banda alto y estrecho: deja el chasquido y quita tanto el grave,
    // que sonaría a golpe de mesa, como el siseo largo de arriba.
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 2600;
    filtro.Q.value = 1.1;

    // 12 ms de vida, con caída exponencial. Más largo ya no es un clic, es un
    // "psh"; más corto no llega a oírse en el altavoz del teléfono.
    const vol = ctx.createGain();
    vol.gain.setValueAtTime(0.5, t);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

    fuente.connect(filtro).connect(vol).connect(ctx.destination);
    fuente.start(t, desde, 0.02);
    fuente.stop(t + 0.02);
  } catch {
    /* sin sonido la app funciona igual */
  }
}
