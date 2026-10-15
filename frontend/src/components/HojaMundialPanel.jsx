import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  CheckCircle2, Copy, ExternalLink, Link2, Loader2, RefreshCw, Table2, TriangleAlert, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import { useAdminRace } from '../contexts/AdminRaceContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ESTADO = {
  active: { texto: 'En carrera', clase: 'bg-green-100 text-green-800' },
  registered: { texto: 'Inscrito', clase: 'bg-slate-100 text-slate-700' },
  retired: { texto: 'DNF', clase: 'bg-red-100 text-red-800' },
  dns: { texto: 'DNS', clase: 'bg-amber-100 text-amber-800' },
  winner: { texto: 'Ganador', clase: 'bg-yellow-100 text-yellow-800' },
  honor: { texto: 'Honor', clase: 'bg-blue-100 text-blue-800' },
};

function hora(iso) {
  if (!iso) return null;
  const fecha = new Date(iso);
  return fecha.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'medium' });
}

/**
 * La hoja de Google del Campeonato Mundial, al día con cada vuelta.
 *
 * La organización mundial reparte una hoja por país y la lee tal cual; aquí
 * se pega su dirección, se casa cada fila con un dorsal y se enciende la
 * sincronización. Desde entonces cada vuelta, retiro o corrección del libro
 * de vueltas se escribe sola en la hoja (`services/hoja_mundial.py`).
 */
export default function HojaMundialPanel() {
  const { raceCode, raceName, conCarrera } = useAdminRace();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [direccion, setDireccion] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [filasEditadas, setFilasEditadas] = useState({});

  const aplicar = useCallback((datos) => {
    setEstado(datos);
    setDireccion(datos.url || '');
    setFilasEditadas({});
  }, []);

  const cargar = useCallback(async () => {
    if (!raceCode) return;
    setCargando(true);
    try {
      const res = await adminFetch(conCarrera(`${API_URL}/api/hoja-mundial/estado`));
      if (!res.ok) throw new Error('No se pudo cargar el estado de la hoja');
      aplicar(await res.json());
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [raceCode, conCarrera, aplicar]);

  useEffect(() => { cargar(); }, [cargar]);

  const llamar = useCallback(async (clave, url, opciones, exito) => {
    setOcupado(clave);
    try {
      const res = await adminFetch(conCarrera(`${API_URL}${url}`), opciones);
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.detail || 'No se pudo completar');
      aplicar(datos);
      if (exito) exito(datos);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setOcupado('');
    }
  }, [conCarrera, aplicar]);

  const guardarDireccion = () => llamar(
    'direccion', '/api/hoja-mundial/config',
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hoja: direccion }) },
    (d) => toast.success(d.spreadsheet_id ? 'Hoja guardada' : 'Hoja quitada'),
  );

  const cambiarActiva = (activa) => llamar(
    'activa', '/api/hoja-mundial/config',
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activa }) },
    () => toast.success(activa ? 'La hoja se actualizará con cada vuelta' : 'Sincronización automática apagada'),
  );

  const emparejar = () => llamar(
    'emparejar', '/api/hoja-mundial/emparejar', { method: 'POST' },
    (d) => {
      const faltan = (d.sin_fila || []).length + (d.sin_pareja || []).length;
      toast.success(`${d.emparejados} dorsal(es) emparejados${faltan ? `; ${faltan} por revisar a mano` : ''}`);
    },
  );

  const guardarFilas = () => llamar(
    'filas', '/api/hoja-mundial/filas',
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filas: filasEditadas }) },
    () => toast.success('Filas guardadas'),
  );

  const sincronizar = () => llamar(
    'sincronizar', '/api/hoja-mundial/sincronizar', { method: 'POST' },
    (d) => {
      if (d.resultado?.ok) toast.success(`Hoja al día: ${d.resultado.celdas} celda(s) escritas`);
      else toast.error(d.resultado?.error || 'No se pudo escribir en la hoja');
    },
  );

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const editarFila = (bib, valor) => {
    setFilasEditadas((previas) => ({ ...previas, [bib]: valor === '' ? null : Number(valor) }));
  };

  if (cargando && !estado) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando…
      </div>
    );
  }
  if (!estado) return null;

  const hayCambiosDeFilas = Object.keys(filasEditadas).length > 0;
  const corredores = estado.corredores || [];
  const emparejados = corredores.filter((c) => c.fila).length;

  return (
    <div className="space-y-6" data-testid="hoja-mundial-panel">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Table2 className="w-6 h-6" />
          Hoja del Mundial
        </h2>
        <p className="text-slate-600 mt-1">
          La hoja de Google que la organización mundial lee en tiempo real. Con la sincronización
          encendida, cada vuelta, retiro o corrección de <strong>{raceName || raceCode}</strong> se
          escribe sola en la pestaña «{estado.hoja}».
        </p>
      </div>

      {!estado.cuenta_configurada && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            El backend no tiene identidad de Google (<code>GOOGLE_OAUTH_JSON</code>,{' '}
            <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> o <code>FCM_SERVICE_ACCOUNT_JSON</code>). Sin ella no se
            puede escribir en la hoja.
          </div>
        </div>
      )}

      {/* ----- La hoja ----- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="w-5 h-5" />
            La hoja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="font-mono text-xs"
              data-testid="hoja-mundial-direccion"
            />
            <div className="flex gap-2">
              <Button onClick={guardarDireccion} disabled={ocupado === 'direccion'} data-testid="hoja-mundial-guardar">
                {ocupado === 'direccion' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
              {estado.url && (
                <Button variant="outline" asChild>
                  <a href={estado.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          </div>

          {estado.cuenta_servicio && estado.por_oauth && (
            <div className="rounded-lg bg-slate-50 border p-4 text-sm text-slate-700">
              El sistema escribe en la hoja como <strong>{estado.cuenta_servicio}</strong>: basta con que
              esa cuenta tenga permiso de edición en ella.
            </div>
          )}

          {estado.cuenta_servicio && !estado.por_oauth && (
            <div className="rounded-lg bg-slate-50 border p-4 text-sm text-slate-700 space-y-2">
              <p>
                Para que el sistema pueda escribir, la hoja tiene que estar compartida como{' '}
                <strong>Editor</strong> con esta cuenta (Compartir → pegar el correo → Editor):
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={estado.cuenta_servicio} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => copiar(estado.cuenta_servicio)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>
          )}

          {estado.error_hoja && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 text-sm">
              <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
              <div>{estado.error_hoja}</div>
            </div>
          )}

          {estado.spreadsheet_id && !estado.error_hoja && estado.filas_hoja?.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              La hoja se lee bien: {estado.filas_hoja.length} corredor(es) en el roster.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- Dorsales y filas ----- */}
      {estado.spreadsheet_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Dorsales y filas
                <Badge variant="secondary">{emparejados}/{corredores.length}</Badge>
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={emparejar} disabled={!!ocupado || !!estado.error_hoja} data-testid="hoja-mundial-emparejar">
                  {ocupado === 'emparejar' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Emparejar por nombre
                </Button>
                {hayCambiosDeFilas && (
                  <Button size="sm" onClick={guardarFilas} disabled={!!ocupado}>
                    {ocupado === 'filas' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Guardar filas
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Cada dorsal escribe en una fila de la hoja. «Emparejar por nombre» las casa solas leyendo
              la columna Runner; lo que no case, o case mal, se corrige escribiendo el número de fila.
            </p>

            {corredores.length === 0 ? (
              <p className="text-sm text-slate-500">No hay corredores con dorsal en {raceCode}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-3">Dorsal</th>
                      <th className="py-2 pr-3">Corredor</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3">Vueltas</th>
                      <th className="py-2 pr-3">Fila</th>
                      <th className="py-2">En la hoja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corredores.map((c) => {
                      const estilo = ESTADO[c.status] || ESTADO.registered;
                      const fila = c.bib in filasEditadas ? (filasEditadas[c.bib] ?? '') : (c.fila ?? '');
                      return (
                        <tr key={c.bib} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono">#{c.bib}</td>
                          <td className="py-2 pr-3">{c.nombre}</td>
                          <td className="py-2 pr-3">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs ${estilo.clase}`}>{estilo.texto}</span>
                          </td>
                          <td className="py-2 pr-3">{c.laps_completed}</td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              min={3}
                              value={fila}
                              onChange={(e) => editarFila(c.bib, e.target.value)}
                              className="w-20 h-8"
                              data-testid={`hoja-mundial-fila-${c.bib}`}
                            />
                          </td>
                          <td className="py-2 text-slate-600">
                            {c.nombre_en_hoja || (c.fila ? <span className="text-amber-700">fila sin nombre</span> : <span className="text-slate-400">sin fila</span>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {estado.filas_sin_corredor?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium mb-1">Filas de la hoja sin dorsal:</p>
                <ul className="list-disc pl-5">
                  {estado.filas_sin_corredor.map((f) => (
                    <li key={f.fila}>Fila {f.fila}: {f.nombre}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ----- Sincronización ----- */}
      {estado.spreadsheet_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5" />
              Sincronización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium text-slate-900">Actualizar la hoja con cada vuelta</p>
                <p className="text-sm text-slate-600">
                  Cada vuelta completada se escribe como mm:ss desde la salida de esa vuelta; un retiro
                  pone RTC, INC u Over en la yarda siguiente, según cómo se retiró. Una vuelta anulada
                  o un ajuste del panel también se reflejan.
                </p>
              </div>
              <Switch
                checked={estado.activa}
                onCheckedChange={cambiarActiva}
                disabled={!estado.lista || ocupado === 'activa'}
                data-testid="hoja-mundial-activa"
              />
            </div>

            {!estado.lista && (
              <p className="text-sm text-amber-700">
                Para encender la sincronización hace falta la hoja y al menos un dorsal emparejado.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button onClick={sincronizar} disabled={!estado.lista || !!ocupado} data-testid="hoja-mundial-sincronizar">
                {ocupado === 'sincronizar' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sincronizar ahora
              </Button>
              <div className="text-sm text-slate-600">
                {estado.ultima_sync
                  ? <>Última escritura: {hora(estado.ultima_sync)}</>
                  : 'Todavía no se ha escrito nada en la hoja.'}
              </div>
            </div>

            {estado.ultimo_error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 text-sm">
                <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">El último intento falló ({hora(estado.ultimo_intento)}):</p>
                  <p>{estado.ultimo_error}</p>
                </div>
              </div>
            )}

            {estado.avisos?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium mb-1">Para escribir a mano en la hoja:</p>
                <ul className="list-disc pl-5">
                  {estado.avisos.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
