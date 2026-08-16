import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, MailCheck, MailX, Send, RefreshCw, Heart } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { adminFetch } from '../lib/adminApi';

const API = process.env.REACT_APP_BACKEND_URL;

const fecha = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

/**
 * Quién sigue la carrera sin correr ni trabajar en ella.
 *
 * Los dos números de arriba no son decoración: el total dice cuánta gente se
 * dio de alta, pero a quien se le puede escribir es solo a quien marcó que
 * quiere avisos. Sin ese desglose se acaba contando como alcance algo que no lo
 * es.
 *
 * El espectador no confirma su correo —eso se le pide solo si algún día pasa a
 * corredor o a equipo—, así que aquí no hay columna de verificados: lo único
 * que decide a quién se escribe es el consentimiento.
 */
export default function EspectadoresManagement() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [soloEscribibles, setSoloEscribibles] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await adminFetch(
        `${API}/api/cuentas/admin/espectadores?solo_escribibles=${soloEscribibles}`
      );
      if (!r.ok) throw new Error(`No se pudo cargar (HTTP ${r.status})`);
      setDatos(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [soloEscribibles]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando && !datos) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando espectadores…
      </div>
    );
  }

  const lista = datos?.espectadores || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="w-6 h-6 text-blue-600" />
            Espectadores
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quienes siguen la carrera con cuenta, sin correr ni estar en el equipo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
          <RefreshCw className={`w-4 h-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Con cuenta</p>
            <p className="text-3xl font-bold">{datos?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Send className="w-4 h-4 text-blue-600" />
              Se les puede escribir
            </p>
            <p className="text-3xl font-bold">{datos?.escribibles ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Marcaron que quieren recibir avisos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={soloEscribibles ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSoloEscribibles((v) => !v)}
        >
          {soloEscribibles ? 'Viendo solo a quien se puede escribir' : 'Ver solo a quien se puede escribir'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Correo</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Sigue a</th>
                <th className="p-3 font-medium">Alta</th>
                <th className="p-3 font-medium">Última entrada</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-medium">{e.nombre || '—'}</td>
                  <td className="p-3 text-muted-foreground">{e.email}</td>
                  <td className="p-3">
                    {e.acepta_comunicaciones ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <MailCheck className="w-3 h-3 mr-1" />
                        Acepta avisos
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <MailX className="w-3 h-3 mr-1" />
                        No escribir
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {e.sigue_a > 0 ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="w-3.5 h-3.5" />
                        {e.sigue_a}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground">{fecha(e.created_at)}</td>
                  <td className="p-3 text-muted-foreground">{fecha(e.last_login_at)}</td>
                </tr>
              ))}
              {!lista.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Todavía no hay espectadores con cuenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
