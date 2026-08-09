import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Send, MessageCircle, Loader2, Search, X, Heart } from 'lucide-react';
import { getJson, postJson, FAN_NAME_KEY, initialsOf, flagOf } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

const LIKES_KEY = 'bysd_live_cheer_likes';

/**
 * Enviar mensaje de apoyo.
 *
 * Con dorsal en la ruta (desde la ficha) va directo a ese corredor; sin dorsal
 * (acceso rápido del Home) muestra el selector para escribir de una vez.
 */
export default function CheerScreen() {
  // Dentro de la ficha del corredor esto es una sección más; suelta, es
  // una pantalla con su propio título.
  // La ficha ya trae el perfil cargado: dentro de ella se aprovecha en vez
  // de pedirlo otra vez y enseñar un spinner por algo que ya estaba a la vista.
  const contexto = useOutletContext();
  const enFicha = !!contexto;
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const { bib: bibParam } = useParams();

  const [bib, setBib] = useState(bibParam || '');
  const [profile, setProfile] = useState(contexto?.profile || null);
  const [participants, setParticipants] = useState([]);
  const [query, setQuery] = useState('');
  const [cheers, setCheers] = useState([]);
  const [fanName, setFanName] = useState(() => localStorage.getItem(FAN_NAME_KEY) || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  // A qué mensajes dio "me gusta" este teléfono. Quien anima no tiene cuenta,
  // así que el propio aparato es el que se acuerda.
  const [misLikes, setMisLikes] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LIKES_KEY)) || []);
    } catch {
      return new Set();
    }
  });

  const alternarLike = async (mensaje) => {
    const id = mensaje.id;
    if (!id) return;
    const yaEstaba = misLikes.has(id);
    const siguientes = new Set(misLikes);
    if (yaEstaba) siguientes.delete(id); else siguientes.add(id);
    setMisLikes(siguientes);
    localStorage.setItem(LIKES_KEY, JSON.stringify([...siguientes]));
    // Se pinta ya y se corrige con lo que responda el servidor: si falla la
    // red, el contador vuelve a su sitio en la próxima carga.
    setCheers((prev) => prev.map((c) => (
      c.id === id ? { ...c, likes: Math.max(0, (c.likes || 0) + (yaEstaba ? -1 : 1)) } : c
    )));
    const { ok, data } = await postJson(`/api/race/cheers/${id}/like?quitar=${yaEstaba}`, {});
    if (ok && typeof data.likes === 'number') {
      setCheers((prev) => prev.map((c) => (c.id === id ? { ...c, likes: data.likes } : c)));
    }
  };

  const fetchCheers = useCallback((forBib) => {
    const filtro = forBib ? `&athlete_bib=${forBib}` : '';
    getJson(`/api/race/cheers?limit=30&race_code=${raceCode}${filtro}`)
      .then((d) => setCheers(d.messages || []))
      .catch(() => {});
  }, [raceCode]);

  // Con dorsal fijo: ficha del corredor. Sin dorsal: lista para el selector.
  useEffect(() => {
    if (bibParam) {
      getJson(`/api/athletes/public-profile/${bibParam}?race_code=${raceCode}`)
        .then(setProfile)
        .catch(() => {});
    } else {
      getJson(`/api/race/participants?race_code=${raceCode}&include_waitlist=true`)
        .then((data) => setParticipants(
          data.filter((p) => p.bib && ['registered', 'active', 'retired', 'winner', 'honor', 'waitlist'].includes(p.status))
        ))
        .catch(() => {});
    }
    fetchCheers(bibParam || '');
  }, [bibParam, raceCode, fetchCheers]);

  // Autocompletado: 170 corredores en un combo no se navegan; se filtra por
  // nombre o dorsal y se muestran las primeras coincidencias.
  const seleccionado = useMemo(
    () => participants.find((p) => p.bib === bib) || null,
    [participants, bib]
  );

  const sugerencias = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return participants
      .filter((p) =>
        `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) ||
        (p.bib || '').toLowerCase().includes(q.replace(/^#/, '')))
      .slice(0, 6);
  }, [participants, query]);

  const handleSend = async () => {
    if (!bib) {
      setResult({ ok: false, text: 'Elige a quién va dirigido el mensaje.' });
      return;
    }
    if (!fanName.trim() || !message.trim()) {
      setResult({ ok: false, text: 'Completa tu nombre y el mensaje.' });
      return;
    }
    setSending(true);
    setResult(null);
    const { ok, data } = await postJson('/api/race/cheer', {
      athlete_bib: bib,
      fan_name: fanName.trim(),
      message: message.trim(),
    });
    if (ok) {
      localStorage.setItem(FAN_NAME_KEY, fanName.trim());
      setResult({ ok: true, text: `¡Mensaje enviado a ${data.athlete_name || 'tu corredor'}!` });
      setMessage('');
      fetchCheers(bibParam || '');
    } else {
      setResult({ ok: false, text: data.detail || 'No se pudo enviar el mensaje.' });
    }
    setSending(false);
  };

  const contenido = (
    <>
      <div className="px-4 py-4">
        {bibParam && profile && !enFicha && (
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#E77622] ${T.avatar}`}>
              {initialsOf(profile.nombre, profile.apellidos)}
            </div>
            <div>
              <p className="text-sm font-bold">Para {profile.nombre} {profile.apellidos}</p>
              <p className={`text-[11px] ${T.muted}`}>#{profile.bib} · tu mensaje le llega durante la carrera</p>
            </div>
          </div>
        )}

        <div className={`rounded-2xl p-4 mb-5 ${T.card}`}>
          {!bibParam && (
            seleccionado ? (
              <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 mb-2 ${T.chipOn}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${T.avatar}`}>
                  {initialsOf(seleccionado.nombre, seleccionado.apellidos)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{seleccionado.nombre} {seleccionado.apellidos}</p>
                  <p className="text-[10px] opacity-75">#{seleccionado.bib}</p>
                </div>
                <button aria-label="Cambiar corredor" onClick={() => { setBib(''); setQuery(''); }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative mb-2">
                <div className={`flex items-center gap-2 rounded-xl px-3 ${T.input}`}>
                  <Search className="w-4 h-4 shrink-0 opacity-70" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="¿Para quién? Busca por nombre o dorsal"
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>
                {sugerencias.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20 shadow-xl ${T.card}`}>
                    {sugerencias.map((p) => (
                      <button
                        key={p.bib}
                        onClick={() => { setBib(p.bib); setQuery(''); setResult(null); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b last:border-b-0 ${T.divider}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${T.avatar}`}>
                          {initialsOf(p.nombre, p.apellidos)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{p.nombre} {p.apellidos}</p>
                          <p className={`text-[10px] ${T.muted}`}>#{p.bib} · {flagOf(p.nacionalidad)} {p.nacionalidad}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {query.trim() && sugerencias.length === 0 && (
                  <p className={`text-xs mt-1.5 px-1 ${T.muted}`}>Sin coincidencias con «{query}».</p>
                )}
              </div>
            )
          )}
          <input
            value={fanName}
            onChange={(e) => setFanName(e.target.value)}
            maxLength={50}
            placeholder="Tu nombre"
            className={`w-full rounded-xl px-3 py-2.5 text-sm mb-2 ${T.input}`}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Escribe tu mensaje de ánimo…"
            className={`w-full rounded-xl px-3 py-2.5 text-sm mb-1 resize-none ${T.input}`}
          />
          <div className={`text-[10px] text-right mb-2 ${T.subtle}`}>{message.length}/280</div>
          {result && (
            <p className={`text-xs mb-2 ${result.ok ? 'text-green-500' : 'text-red-500'}`}>{result.text}</p>
          )}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full rounded-xl py-2.5 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar ánimo
          </button>
        </div>

        <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>
          {bibParam ? 'Mensajes recibidos' : 'Mensajes recientes'}
        </p>
        {cheers.length === 0 ? (
          <div className={`text-center py-10 ${T.muted}`}>
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-xs">Sé la primera persona en enviar ánimo.</p>
          </div>
        ) : (
          cheers.map((c, i) => {
            const miLike = c.id && misLikes.has(c.id);
            return (
              <div key={c.id || i} className={`rounded-2xl px-3.5 py-3 mb-2.5 ${T.card}`}>
                <p className="text-sm leading-snug">{c.message}</p>
                <div className="flex items-end justify-between gap-3 mt-1.5">
                  <p className={`text-[11px] flex-1 min-w-0 ${T.muted}`}>
                    — {c.fan_name}{!bibParam && (c.athlete_name || c.athlete_bib) ? ` para ${c.athlete_name || `#${c.athlete_bib}`}` : ''}
                  </p>
                  <button
                    aria-label={miLike ? 'Quitar me gusta' : 'Me gusta'}
                    aria-pressed={!!miLike}
                    onClick={() => alternarLike(c)}
                    disabled={!c.id}
                    className={`flex items-center gap-1 shrink-0 text-[11px] font-bold disabled:opacity-40 ${miLike ? 'text-[#E77622]' : T.subtle}`}
                  >
                    <Heart className={`w-4 h-4 ${miLike ? 'fill-[#E77622]' : ''}`} />
                    {c.likes > 0 ? c.likes : ''}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  // Suelta (fuera de la ficha del corredor) necesita su propia pantalla;
  // dentro, el encabezado y el botón de volver ya los pone FichaAtleta.
  return enFicha ? contenido : (
    <Screen title="Enviar ánimo" back showAds>{contenido}</Screen>
  );

}
