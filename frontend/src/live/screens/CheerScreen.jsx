import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { getJson, postJson, FAN_NAME_KEY, initialsOf } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Enviar mensaje de apoyo a un corredor + muro de sus mensajes recibidos.
 */
export default function CheerScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const { bib } = useParams();

  const [profile, setProfile] = useState(null);
  const [cheers, setCheers] = useState([]);
  const [fanName, setFanName] = useState(() => localStorage.getItem(FAN_NAME_KEY) || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const fetchCheers = useCallback(() => {
    getJson(`/api/race/cheers?athlete_bib=${bib}&limit=30&race_code=${raceCode}`)
      .then((d) => setCheers(d.messages || []))
      .catch(() => {});
  }, [bib, raceCode]);

  useEffect(() => {
    getJson(`/api/athletes/public-profile/${bib}?race_code=${raceCode}`)
      .then(setProfile)
      .catch(() => {});
    fetchCheers();
  }, [bib, raceCode, fetchCheers]);

  const handleSend = async () => {
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
      setResult({ ok: true, text: '¡Mensaje enviado! Gracias por apoyar.' });
      setMessage('');
      fetchCheers();
    } else {
      setResult({ ok: false, text: data.detail || 'No se pudo enviar el mensaje.' });
    }
    setSending(false);
  };

  return (
    <Screen title="Enviar ánimo" back>
      <div className="px-4 py-4">
        {profile && (
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

        <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>Mensajes recibidos</p>
        {cheers.length === 0 ? (
          <div className={`text-center py-10 ${T.muted}`}>
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-xs">Sé la primera persona en enviarle ánimo.</p>
          </div>
        ) : (
          cheers.map((c, i) => (
            <div key={i} className={`rounded-2xl px-3.5 py-3 mb-2.5 ${T.card}`}>
              <p className="text-sm leading-snug">{c.message}</p>
              <p className={`text-[11px] mt-1.5 ${T.muted}`}>— {c.fan_name}</p>
            </div>
          ))
        )}
      </div>
    </Screen>
  );
}
