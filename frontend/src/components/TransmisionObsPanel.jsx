import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Copy, ExternalLink, Loader2, MonitorPlay, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import { useAdminRace } from '../contexts/AdminRaceContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Las tres vistas que se pegan en OBS. El alto es el del lienzo de cada una:
// la barra solo ocupa la franja de abajo, así que no hace falta traerse los
// 1080 enteros y taparlo todo con una fuente transparente.
const VISTAS = [
  {
    id: 'barra',
    nombre: 'Barra inferior',
    descripcion: 'Hora de inicio, vuelta, kilómetros, en carrera, DNS y cuenta regresiva. Al llegar un atleta lo anuncia y vuelve sola. En los últimos tres minutos de cada vuelta el cronómetro lleva el globo de aviso: amarillo, naranja y rojo.',
    ancho: 1920,
    alto: 1080,
  },
  {
    id: 'crono',
    nombre: 'Cronómetro (esquina)',
    descripcion: 'Solo la cuenta regresiva hasta la próxima salida, en una caja en la esquina inferior derecha, con el globo de aviso en los últimos tres minutos. Para escenas sin barra; ocupa el mismo sitio que ella.',
    ancho: 1920,
    alto: 1080,
  },
  {
    id: 'salida',
    nombre: 'Pantalla de salida',
    descripcion: 'Pantalla completa, con fondo, para el monitor o proyector del corral: la cuenta regresiva grande hasta la salida y luego hasta cada vuelta, el anillo de la vuelta, y el globo de aviso a 3, 2 y 1 minutos que se vacía como un reloj al revés. Al llegar a cero destella «¡SALIDA!». Para ensayarla sin tocar la carrera, añade &inicio=2027-01-23T07:00 con la hora que quieras.',
    ancho: 1920,
    alto: 1080,
  },
  {
    id: 'patrocinadores',
    nombre: 'Patrocinadores',
    descripcion: 'La misma barra, con el patrocinador de turno (logo, nombre y su frase), la vuelta en curso y la cuenta regresiva. Rota por los patrocinadores encendidos para la app, cada 10 segundos.',
    ancho: 1920,
    alto: 1080,
  },
  {
    id: 'patrocinador-esquina',
    nombre: 'Patrocinador (esquina)',
    descripcion: 'Solo el patrocinador de turno —logo, nombre y su frase— en la esquina inferior derecha, sin datos de carrera. Sirve con la barra puesta o sin ella. Rota cada 10 segundos y no necesita la clave.',
    ancho: 1920,
    alto: 1080,
  },
  {
    id: 'clasificacion',
    nombre: 'Clasificación',
    descripcion: 'Los primeros puestos con dorsal, nombre, vueltas y kilómetros. Con &filas=15 se alarga.',
    ancho: 1920,
    alto: 1080,
  },
];

/**
 * Las direcciones de las vistas de la transmisión, listas para copiar.
 *
 * OBS solo sabe abrir una dirección, así que todo lo que hay que decidir
 * (carrera, clave, número de filas) va dentro de ella. Aquí se arman y se
 * copian; la clave se puede cambiar si la dirección se comparte de más.
 */
export default function TransmisionObsPanel() {
  const { raceCode, raceName, conCarrera } = useAdminRace();
  const [clave, setClave] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState(false);
  // Las charlas tienen su propia barra, una direccion por actividad
  const [actividades, setActividades] = useState([]);

  const sitio = window.location.origin;

  const cargar = useCallback(async () => {
    if (!raceCode) return;
    setCargando(true);
    try {
      const res = await adminFetch(conCarrera(`${API_URL}/api/overlay/enlaces`));
      if (!res.ok) throw new Error('No se pudieron cargar las direcciones');
      const datos = await res.json();
      setClave(datos.clave);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [raceCode, conCarrera]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    adminFetch(`${API_URL}/api/capacitaciones/admin/list`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setActividades(d?.capacitaciones || []))
      .catch(() => { /* sin actividades no hay charlas que transmitir */ });
  }, []);

  const cambiarClave = async () => {
    if (!window.confirm('Las direcciones que ya repartiste dejarán de funcionar y habrá que volver a pegarlas en OBS. ¿Cambiar la clave?')) return;
    setCambiando(true);
    try {
      const res = await adminFetch(conCarrera(`${API_URL}/api/overlay/clave`), { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo cambiar la clave');
      const datos = await res.json();
      setClave(datos.clave);
      toast.success('Clave cambiada. Vuelve a pegar las direcciones en OBS.');
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setCambiando(false);
    }
  };

  const direccion = (vista) =>
    `${sitio}/obs/${vista}?clave=${encodeURIComponent(clave || '')}&race=${encodeURIComponent(raceCode || '')}`;

  // Sin numero, rota por todos los expositores; con numero (1, 2, 3…) se
  // queda en ese: una fuente de OBS por expositor.
  const direccionCharla = (actividad, expositor = null) =>
    `${sitio}/obs/charla?actividad=${encodeURIComponent(actividad.id)}&race=${encodeURIComponent(raceCode || '')}`
    + (expositor ? `&expositor=${expositor}` : '');

  const filaDireccion = (url, clave) => (
    <div className="flex flex-col sm:flex-row gap-2" key={clave}>
      <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-xs" data-testid={`obs-url-${clave}`} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => copiar(url)}>
          <Copy className="w-4 h-4 mr-2" />
          Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.open(`${url}&fondo=oscuro`, '_blank')} title="Verla en el navegador, sobre fondo oscuro">
          <ExternalLink className="w-4 h-4 mr-2" />
          Ver
        </Button>
      </div>
    </div>
  );

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Dirección copiada');
    } catch {
      toast.error('No se pudo copiar. Selecciona la dirección y cópiala a mano.');
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MonitorPlay className="w-6 h-6 text-primary" />
          Transmisión (OBS)
        </h2>
        <p className="text-muted-foreground">
          Vistas en vivo de {raceName || raceCode} para poner sobre el video. Se actualizan solas cada 3 segundos.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cómo se pone en OBS</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. En OBS, en Fuentes, agrega una <strong>Fuente de navegador</strong>.</p>
          <p>2. Pega la dirección de la vista y pon <strong>1920 de ancho y 1080 de alto</strong>, la misma medida de la transmisión.</p>
          <p>3. Deja el fondo transparente: no marques ningún color de fondo. La fuente se coloca encima del video.</p>
          <p>4. Desmarca <strong>Apagar la fuente cuando no esté visible</strong>, para que no pierda la cuenta regresiva al cambiar de escena.</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {VISTAS.map((vista) => (
          <Card key={vista.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{vista.nombre}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{vista.descripcion}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={direccion(vista.id)} onFocus={(e) => e.target.select()} className="font-mono text-xs" data-testid={`obs-url-${vista.id}`} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copiar(direccion(vista.id))} data-testid={`obs-copy-${vista.id}`}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${direccion(vista.id)}&fondo=oscuro`, '_blank')} title="Verla en el navegador, sobre fondo oscuro">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Charlas y actividades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La misma barra, sin datos de carrera: la hora, quien expone (nombre y especialidad) en el centro
            y el patrocinador de turno en la esquina derecha. Hay una dirección por expositor, para tener
            una fuente de OBS por cada uno y cambiar de escena cuando cambia quien habla; la dirección
            general rota por todos. Los expositores se ponen en cada actividad, en Atletas → Actividades.
            No lleva clave: no enseña nada que no sea público.
          </p>
          {actividades.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay actividades creadas.</p>
          ) : actividades.map((a) => (
            <div key={a.id} className="space-y-2">
              <div className="text-sm font-medium">
                {a.name}
                <span className="text-muted-foreground font-normal"> · {a.datetime ? String(a.datetime).slice(0, 10) : ''}</span>
                {(a.expositores || []).length === 0 && (
                  <span className="text-xs text-amber-600 ml-2">sin expositores</span>
                )}
              </div>
              {(a.expositores || []).map((e, i) => (
                <div key={i} className="space-y-1 pl-3 border-l-2 border-muted">
                  <div className="text-xs text-muted-foreground">
                    {e.nombre}{e.especialidad ? ` · ${e.especialidad}` : ''}
                  </div>
                  {filaDireccion(direccionCharla(a, i + 1), `charla-${a.id}-${i + 1}`)}
                </div>
              ))}
              {(a.expositores || []).length > 1 && (
                <div className="space-y-1 pl-3 border-l-2 border-muted">
                  <div className="text-xs text-muted-foreground">Todos, rotando cada 10 segundos</div>
                  {filaDireccion(direccionCharla(a), `charla-${a.id}`)}
                </div>
              )}
              {(a.expositores || []).length === 0 && filaDireccion(direccionCharla(a), `charla-${a.id}`)}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-500" />
            La clave
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Las direcciones llevan una clave: quien la tenga ve la carrera en vivo con las horas
            de paso de cada atleta. Compártela solo con quien maneja la transmisión.
          </p>
          <Button variant="outline" size="sm" onClick={cambiarClave} disabled={cambiando} data-testid="obs-rotate-key">
            {cambiando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Cambiar la clave
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
