// Un clic corto al pulsar, sintetizado en el momento.
//
// Sin archivo de audio a propósito: un mp3 hay que descargarlo, cachearlo y
// esperar a que cargue, y la primera pulsación —justo la que importa— saldría
// muda. Aquí el sonido se genera con dos parámetros y suena siempre igual.
//
// El contexto de audio se crea la primera vez que se pulsa algo, nunca al
// arrancar: los navegadores solo lo dejan sonar si viene de un gesto del
// usuario, y crearlo antes lo deja suspendido.
//
// En el teléfono respeta el interruptor de silencio del sistema, que es lo que
// espera cualquiera que lleve el teléfono en silencio.
let ctx;

export function clic() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();

    // Un tono que cae rápido de agudo a medio: es lo que el oído reconoce
    // como "clic" y no como "pitido".
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.05);

    // Ataque casi instantáneo y caída corta. Sin la rampa de entrada suena un
    // chasquido sucio, que es el altavoz arrancando de golpe.
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.14, t + 0.006);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    osc.connect(vol).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    /* sin sonido la app funciona igual */
  }
}
