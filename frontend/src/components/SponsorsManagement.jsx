import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Plus, Trash2, Save, X, Upload, Search,
  Building2, Globe, Smartphone, NotebookPen, Eye, EyeOff, Landmark,
  Megaphone, MousePointerClick, Instagram, Flag, Archive,
} from 'lucide-react';
import useTextoQueCabe from '../hooks/useTextoQueCabe';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { adminFetch } from '../lib/adminApi';
import { SPONSOR_CATEGORIES, getCategory } from '../lib/sponsorCategories';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Pipeline del proceso de cierre (mismo orden que el backend). "Prospecto" y
// "Declinado" complementan la lista original: inicio y salida negativa. Se
// lleva por carrera: una marca puede estar cobrada en el Mundial y en primera
// reunión para la edición siguiente.
const STATUS_OPTIONS = [
  { value: 'prospecto', label: 'Prospecto', badgeClass: 'bg-gray-100 text-gray-700' },
  { value: 'envio_informacion', label: 'Envío de Información', badgeClass: 'bg-blue-100 text-blue-700' },
  { value: 'llamada_primer_contacto', label: 'Llamada de Primer Contacto', badgeClass: 'bg-sky-100 text-sky-700' },
  { value: 'reunion', label: 'Reunión (física o virtual)', badgeClass: 'bg-indigo-100 text-indigo-700' },
  { value: 'retroalimentacion', label: 'Retroalimentación', badgeClass: 'bg-purple-100 text-purple-700' },
  { value: 'cierre', label: 'Cierre', badgeClass: 'bg-green-100 text-green-700' },
  { value: 'facturacion', label: 'Facturación', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { value: 'pago', label: 'Pago', badgeClass: 'bg-teal-100 text-teal-700' },
  { value: 'declinado', label: 'Declinado', badgeClass: 'bg-red-100 text-red-700' },
];

const PIPELINE_ORDER = STATUS_OPTIONS.filter((s) => s.value !== 'declinado').map((s) => s.value);
const DEFAULT_PUBLICAR_DESDE = 'cierre';

const getStatusInfo = (status) =>
  STATUS_OPTIONS.find((s) => s.value === (status || 'prospecto')) || STATUS_OPTIONS[0];

// Si el proceso comercial de esa carrera ya llegó al momento de publicar. Es
// la puerta comercial —«no lo enseñes hasta que firme»—, distinta de los
// interruptores de dónde se ve. Las dos tienen que dar el visto bueno.
const procesoPermitePublicar = (ficha, part) => {
  if (!ficha.is_active) return false;
  const idx = PIPELINE_ORDER.indexOf(part.status || 'prospecto');
  if (idx === -1) return false; // declinado
  let desde = PIPELINE_ORDER.indexOf(part.publicar_desde || DEFAULT_PUBLICAR_DESDE);
  if (desde === -1) desde = PIPELINE_ORDER.indexOf(DEFAULT_PUBLICAR_DESDE);
  return idx >= desde;
};

// Las piezas gráficas. El logo es de la marca —la misma empresa no cambia de
// logo entre ediciones—; el banner y la imagen ampliada son el arte de una
// campaña concreta, así que van en la carrera.
const PIEZAS_CARRERA = [
  { tipo: 'banner', campo: 'banner_url', label: 'Banner 1200×240', ayuda: 'Se abre dentro de la app con «Conocer más» cuando no hay imagen ampliada. El pie ya no lo pinta: lleva el nombre y el texto.' },
  { tipo: 'detail', campo: 'detail_url', label: 'Imagen ampliada', ayuda: 'Se abre dentro de la app con «Conocer más». 1080 px de ancho, alto libre.' },
];

// Si tiene con qué salir en el pie de la app: el pie lleva el nombre, el texto
// y «Conocer más», que abre una imagen o, si no hay, el enlace. Misma regla
// que `tiene_pieza` del backend, con sus dos mitades.
const tienePieza = (ficha, part) => !!ficha.logo_url
  || PIEZAS_CARRERA.some((p) => part[p.campo])
  || !!(part.text || '').trim()
  || !!(part.link_url || '').trim();

// La franja del pie de la app tal como sale en el teléfono. Componente propio
// y fuera del render: necesita un hook para medir el nombre.
function VistaPreviaPie({ nombre, part }) {
  const refNombre = useRef(null);
  const tamano = useTextoQueCabe(refNombre, nombre, { max: 22, min: 14 });
  return (
    <div className="bg-[#17110C] border-t-2 border-[#E77622] h-[80px] flex items-center gap-4 px-5 max-w-[390px]">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#E77622] mb-1">
          Patrocinador
        </p>
        <p
          ref={refNombre}
          style={{ fontSize: tamano }}
          className="font-display leading-none uppercase tracking-wide text-white truncate"
        >
          {nombre}
        </p>
        {part.text && (
          <p className="text-[11px] mt-1 text-[#9a9a9a] truncate">{part.text}</p>
        )}
      </div>
      {(part.detail_url || part.banner_url || part.link_url) && (
        <span className="shrink-0 rounded-full bg-[#E77622] text-[#1a1a1a] text-[12px] font-bold px-4 py-2">
          Conocer más
        </span>
      )}
    </div>
  );
}

// Separador de miles para el campo de monto (se guarda sin comas)
const formatMontoInput = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const [ent, dec] = String(value).split('.');
  const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${entFmt}.${dec}` : entFmt;
};

const parseMontoInput = (str) => (str || '').replace(/,/g, '').replace(/[^0-9.]/g, '');

// datetime-local usa "YYYY-MM-DDTHH:MM"; el backend guarda ISO tal cual
const toInputValue = (iso) => (iso ? iso.slice(0, 16) : '');

const formatFechaHora = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const EMPTY_FICHA = {
  name: '',
  razon_social: '',
  rnc: '',
  nombre_contacto: '',
  posicion_contacto: '',
  telefono: '',
  correo: '',
  pagina_web: '',
  description: '',
  instagram: '',
};

const fichaDesde = (s) => ({
  name: s.name || '',
  razon_social: s.razon_social || '',
  rnc: s.rnc || '',
  nombre_contacto: s.nombre_contacto || '',
  posicion_contacto: s.posicion_contacto || '',
  telefono: s.telefono || '',
  correo: s.correo || '',
  pagina_web: s.pagina_web || '',
  description: s.description || '',
  instagram: s.instagram || '',
});

const partDesde = (p) => ({
  status: p.status || 'prospecto',
  publicar_desde: p.publicar_desde || DEFAULT_PUBLICAR_DESDE,
  propuesta_categoria: p.propuesta_categoria || '',
  propuesta_monto: p.propuesta_monto ?? '',
  publicar_web: p.publicar_web !== false,
  publicar_app: p.publicar_app !== false,
  mostrar_marca: p.mostrar_marca !== false,
  weight: p.weight || 1,
  order: p.order || 0,
  start_at: toInputValue(p.start_at),
  end_at: toInputValue(p.end_at),
  text: p.text || '',
  link_url: p.link_url || '',
});

/**
 * Lo que una marca patrocina en una carrera: el bloque que se abre al marcar
 * su casilla en la pestaña «Carreras». Lleva su propio estado y su propio
 * botón de guardar, porque cada edición se negocia aparte.
 */
function BloqueCarrera({
  ficha, race, part, onGuardar, onQuitar, onSubirImagen, onQuitarImagen,
  subiendo, cuposTomados,
}) {
  const [datos, setDatos] = useState(() => partDesde(part));
  const [guardando, setGuardando] = useState(false);

  // Si la participación cambia por fuera (se recarga la lista tras guardar),
  // el bloque se pone al día.
  useEffect(() => { setDatos(partDesde(part)); }, [part]);

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const toggle = (campo) => setDatos((d) => ({ ...d, [campo]: !d[campo] }));

  const categoria = getCategory(datos.propuesta_categoria);
  const tomados = categoria ? cuposTomados(race.code, categoria.slug, ficha.id) : 0;
  const sinCupos = !!categoria && categoria.cupos != null && tomados >= categoria.cupos;
  const seVe = procesoPermitePublicar(ficha, { ...part, ...datos });

  const guardar = async () => {
    if (datos.propuesta_monto !== '' && isNaN(parseFloat(datos.propuesta_monto))) {
      toast.error('El monto debe ser un número');
      return;
    }
    setGuardando(true);
    await onGuardar(race.code, {
      ...datos,
      propuesta_monto: datos.propuesta_monto !== '' ? parseFloat(datos.propuesta_monto) : null,
      weight: Number(datos.weight) || 1,
      order: Number(datos.order) || 0,
    });
    setGuardando(false);
  };

  return (
    <div className="border rounded-md p-4 space-y-4 bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{race.name}</span>
          <Badge className={getStatusInfo(datos.status).badgeClass}>
            {getStatusInfo(datos.status).label}
          </Badge>
          {seVe ? (
            <Badge variant="outline" className="text-[10px] gap-1"><Eye className="w-3 h-3" />Publicable</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><EyeOff className="w-3 h-3" />Sin publicar</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => onQuitar(race.code)}
          data-testid={`quitar-carrera-${race.code}`}
        >
          <X className="w-4 h-4 mr-1" />
          Quitar de esta carrera
        </Button>
      </div>

      {/* Proceso y propuesta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status del proceso</Label>
          <select
            value={datos.status}
            onChange={set('status')}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            data-testid={`status-${race.code}`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Publicar a partir de</Label>
          <select
            value={datos.publicar_desde}
            onChange={set('publicar_desde')}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          >
            {STATUS_OPTIONS.filter((s) => s.value !== 'declinado').map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <select
            value={datos.propuesta_categoria}
            onChange={set('propuesta_categoria')}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            data-testid={`categoria-${race.code}`}
          >
            <option value="">Sin categoría asignada</option>
            {SPONSOR_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}{c.subtitle ? ` — ${c.subtitle}` : ''}
              </option>
            ))}
          </select>
          {categoria && (
            <p className={`text-xs ${sinCupos ? 'text-amber-600' : 'text-muted-foreground'}`}>
              Cupos: {categoria.cuposLabel} · {tomados} tomado(s) en esta carrera
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Monto (RD$)</Label>
          <Input
            value={formatMontoInput(datos.propuesta_monto)}
            onChange={(e) => setDatos((d) => ({ ...d, propuesta_monto: parseMontoInput(e.target.value) }))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>
      </div>

      {/* Dónde se ve */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={datos.publicar_web} onChange={() => toggle('publicar_web')} />
          <Globe className="w-4 h-4 text-muted-foreground" />
          En la vitrina del sitio
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={datos.publicar_app} onChange={() => toggle('publicar_app')} />
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          En el pie de la app
        </label>
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <Input type="datetime-local" value={datos.start_at} onChange={set('start_at')} />
        </div>
        <div className="space-y-1.5">
          <Label>Hasta</Label>
          <Input type="datetime-local" value={datos.end_at} onChange={set('end_at')} />
        </div>
        <div className="space-y-1.5">
          <Label>Frecuencia en la rotación (1-10)</Label>
          <Input type="number" min="1" max="10" value={datos.weight} onChange={set('weight')} />
        </div>
        <div className="space-y-1.5">
          <Label>Orden en la vitrina</Label>
          <Input type="number" min="0" value={datos.order} onChange={set('order')} />
        </div>
      </div>

      {/* El anuncio de esta campaña */}
      <div className="space-y-3 pt-3 border-t">
        <h5 className="text-sm font-semibold flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          El anuncio de esta edición
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Texto del pie</Label>
            <Input value={datos.text} onChange={set('text')} placeholder="Una línea corta" />
          </div>
          <div className="space-y-1.5">
            <Label>Enlace</Label>
            <Input value={datos.link_url} onChange={set('link_url')} placeholder="https://" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PIEZAS_CARRERA.map((pieza) => (
            <div key={pieza.tipo} className="space-y-1.5">
              <Label>{pieza.label}</Label>
              {part[pieza.campo] ? (
                <div className="flex items-center gap-2">
                  <img
                    src={`${API_URL}${part[pieza.campo]}`}
                    alt={pieza.label}
                    className="h-12 rounded border bg-white object-contain"
                  />
                  <Button variant="ghost" size="sm" onClick={() => onQuitarImagen(race.code, pieza.tipo)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSubirImagen(race.code, pieza.tipo)}
                  disabled={subiendo === `${race.code}:${pieza.tipo}`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {subiendo === `${race.code}:${pieza.tipo}` ? 'Subiendo…' : 'Subir'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">{pieza.ayuda}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Así se ve en el teléfono:</p>
          <VistaPreviaPie nombre={ficha.name} part={{ ...part, ...datos }} />
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />{part.impressions || 0} impresiones
          </span>
          <span className="flex items-center gap-1">
            <MousePointerClick className="w-3 h-3" />{part.clicks || 0} clics
          </span>
        </p>
      </div>

      <Button onClick={guardar} disabled={guardando} data-testid={`guardar-carrera-${race.code}`}>
        <Save className="w-4 h-4 mr-2" />
        {guardando ? 'Guardando…' : `Guardar ${race.name}`}
      </Button>
    </div>
  );
}

export default function SponsorsManagement() {
  const { raceCode } = useRaceConfig();
  const [races, setRaces] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de la tabla
  const [filtroRace, setFiltroRace] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // La ficha abierta en la ventana emergente
  const [abiertaId, setAbiertaId] = useState(null);
  const [tab, setTab] = useState('comercial');
  const [fichaForm, setFichaForm] = useState(EMPTY_FICHA);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  // Alta
  const [creando, setCreando] = useState(false);
  const [nuevaForm, setNuevaForm] = useState({ name: '', races: [] });
  const [creandoGuardando, setCreandoGuardando] = useState(false);

  // Bitácora
  const [notaCarrera, setNotaCarrera] = useState('');
  const [nota, setNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  // Las piezas comparten un único input de archivo, que recuerda para cuál se abrió.
  const [subiendo, setSubiendo] = useState(null);
  const destinoSubida = useRef(null);
  const fileInputRef = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/admin`);
      if (response.ok) {
        const data = await response.json();
        setSponsors(data.sponsors || []);
      } else {
        toast.error('Error al cargar patrocinadores');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const cargarCarreras = async () => {
      try {
        const response = await fetch(`${API_URL}/api/race-config/all`);
        if (response.ok) {
          const data = await response.json();
          setRaces(data.races || []);
        }
      } catch (error) {
        console.error('Error loading races:', error);
      }
    };
    cargarCarreras();
  }, []);

  const abierta = sponsors.find((s) => s.id === abiertaId) || null;
  const partesDe = (s) => s.participaciones || [];
  const parteEn = (s, code) => partesDe(s).find((p) => p.race_code === code);

  // Cupos ya tomados de una categoría en una carrera. No bloquea nada: es el
  // aviso de que esa categoría se está quedando sin espacio.
  const cuposTomados = useCallback((code, slug, exceptoId) => sponsors.filter((s) => {
    if (s.id === exceptoId || !s.is_active) return false;
    const p = (s.participaciones || []).find((x) => x.race_code === code);
    return p && p.propuesta_categoria === slug && p.status !== 'declinado';
  }).length, [sponsors]);

  /* ---------------- Tabla: filtros ---------------- */

  const filtradas = useMemo(() => sponsors.filter((s) => {
    const partes = partesDe(s);
    const enCarrera = filtroRace === 'todas'
      ? partes
      : partes.filter((p) => p.race_code === filtroRace);
    if (filtroRace !== 'todas' && enCarrera.length === 0) return false;
    if (filtroStatus !== 'todos' && !enCarrera.some((p) => (p.status || 'prospecto') === filtroStatus)) {
      return false;
    }
    const texto = busqueda.trim().toLowerCase();
    if (texto) {
      const donde = [s.name, s.nombre_contacto, s.correo, s.telefono, s.razon_social]
        .filter(Boolean).join(' ').toLowerCase();
      if (!donde.includes(texto)) return false;
    }
    return true;
  }), [sponsors, filtroRace, filtroStatus, busqueda]);

  // Los que de verdad se están viendo, dentro del filtro de carrera.
  const contarEn = (destino) => sponsors.reduce((total, s) => {
    const partes = filtroRace === 'todas' ? partesDe(s) : partesDe(s).filter((p) => p.race_code === filtroRace);
    return total + partes.filter((p) => (
      procesoPermitePublicar(s, p)
      && p[destino === 'web' ? 'publicar_web' : 'publicar_app'] !== false
      && (destino === 'web' || tienePieza(s, p))
    )).length;
  }, 0);

  /* ---------------- Ficha ---------------- */

  const abrirFicha = (s) => {
    setAbiertaId(s.id);
    setFichaForm(fichaDesde(s));
    setTab('comercial');
    setNota('');
    setNotaCarrera(partesDe(s)[0]?.race_code || '');
  };

  const guardarFicha = async () => {
    if (!fichaForm.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setGuardandoFicha(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/${abiertaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fichaForm),
      });
      if (response.ok) {
        toast.success('Ficha guardada');
        cargar();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGuardandoFicha(false);
    }
  };

  const crear = async () => {
    if (!nuevaForm.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setCreandoGuardando(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nuevaForm.name.trim(), races: nuevaForm.races }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success('Patrocinador creado');
        setCreando(false);
        setNuevaForm({ name: '', races: [] });
        await cargar();
        if (data.sponsor) abrirFicha(data.sponsor);
      } else {
        toast.error(data.detail || 'Error al crear');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCreandoGuardando(false);
    }
  };

  const retirar = async () => {
    if (!window.confirm(`¿Retirar a "${abierta.name}"? Deja de salir en todas sus carreras, pero no se borra nada.`)) return;
    const response = await adminFetch(`${API_URL}/api/sponsors/${abiertaId}`, { method: 'DELETE' });
    if (response.ok) {
      toast.success('Patrocinador retirado');
      setAbiertaId(null);
      cargar();
    } else {
      toast.error('No se pudo retirar');
    }
  };

  const borrar = async () => {
    if (!window.confirm(`¿Eliminar permanentemente a "${abierta.name}"? Se borran sus imágenes y todas sus carreras. No se puede deshacer.`)) return;
    const response = await adminFetch(`${API_URL}/api/sponsors/${abiertaId}/permanente`, { method: 'DELETE' });
    if (response.ok) {
      toast.success('Patrocinador eliminado');
      setAbiertaId(null);
      cargar();
    } else {
      toast.error('No se pudo eliminar');
    }
  };

  /* ---------------- Carreras ---------------- */

  const guardarParticipacion = async (code, datos) => {
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/${abiertaId}/carrera/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (response.ok) {
        toast.success('Guardado');
        cargar();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'No se pudo guardar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const marcarCarrera = (code) => guardarParticipacion(code, {});

  const quitarCarrera = async (code) => {
    if (!window.confirm(`¿Quitar a "${abierta.name}" de ${code}? Se borra el anuncio de esa edición; el logo y los contactos se conservan.`)) return;
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/${abiertaId}/carrera/${code}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success(`Quitado de ${code}`);
        cargar();
      } else {
        toast.error('No se pudo quitar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  /* ---------------- Piezas gráficas ---------------- */

  const pedirImagen = (raceCodePieza, tipo) => {
    destinoSubida.current = { raceCodePieza, tipo };
    fileInputRef.current?.click();
  };

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const destino = destinoSubida.current;
    if (!file || !destino) return;
    const { raceCodePieza, tipo } = destino;

    setSubiendo(tipo === 'logo' ? 'logo' : `${raceCodePieza}:${tipo}`);
    const body = new FormData();
    body.append('file', file);
    const query = tipo === 'logo' ? '' : `?race_code=${raceCodePieza}`;
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/${abiertaId}/imagen/${tipo}${query}`,
        { method: 'POST', body }
      );
      if (response.ok) {
        toast.success('Imagen subida');
        cargar();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'No se pudo subir la imagen');
      }
    } catch {
      toast.error('Error de conexión al subir la imagen');
    } finally {
      setSubiendo(null);
    }
  };

  const quitarImagen = async (raceCodePieza, tipo) => {
    if (!window.confirm('¿Quitar la imagen?')) return;
    const query = tipo === 'logo' ? '' : `?race_code=${raceCodePieza}`;
    const response = await adminFetch(
      `${API_URL}/api/sponsors/${abiertaId}/imagen/${tipo}${query}`,
      { method: 'DELETE' }
    );
    if (response.ok) {
      toast.success('Imagen quitada');
      cargar();
    } else {
      toast.error('No se pudo quitar la imagen');
    }
  };

  /* ---------------- Bitácora ---------------- */

  const agregarNota = async () => {
    if (!nota.trim()) {
      toast.error('Escribe la nota del contacto');
      return;
    }
    if (!notaCarrera) {
      toast.error('Elige la carrera a la que pertenece el contacto');
      return;
    }
    setGuardandoNota(true);
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/${abiertaId}/bitacora?race_code=${notaCarrera}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nota }),
        }
      );
      if (response.ok) {
        toast.success('Contacto registrado');
        setNota('');
        cargar();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'Error al registrar el contacto');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGuardandoNota(false);
    }
  };

  // Todas las notas de la marca, de la más nueva a la más vieja, con la
  // carrera a la que pertenece cada una.
  const bitacoraCompleta = abierta
    ? partesDe(abierta)
      .flatMap((p) => (p.bitacora || []).map((b) => ({ ...b, race_code: p.race_code })))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    : [];

  const nombreCarrera = (code) => races.find((r) => r.code === code)?.name || code;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Patrocinios y Publicidad</h2>
          <p className="text-muted-foreground">
            {sponsors.length} marcas • {contarEn('web')} en el sitio • {contarEn('app')} en el pie de la app
            {filtroRace !== 'todas' && ` • ${nombreCarrera(filtroRace)}`}
          </p>
        </div>
        <Button onClick={() => { setNuevaForm({ name: '', races: raceCode ? [raceCode] : [] }); setCreando(true); }} data-testid="add-sponsor-btn">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Patrocinador
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por marca, contacto o correo"
              className="pl-9"
              data-testid="sponsor-buscar"
            />
          </div>
          <select
            value={filtroRace}
            onChange={(e) => setFiltroRace(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm"
            data-testid="sponsor-filtro-carrera"
          >
            <option value="todas">Todas las carreras</option>
            {races.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}{r.code === raceCode ? ' (activa)' : ''}
              </option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm"
            data-testid="sponsor-filtro-status"
          >
            <option value="todos">Todos los status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {(filtroRace !== 'todas' || filtroStatus !== 'todos' || busqueda) && (
            <Button
              variant="ghost"
              onClick={() => { setFiltroRace('todas'); setFiltroStatus('todos'); setBusqueda(''); }}
            >
              <X className="w-4 h-4 mr-1" />
              Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patrocinador</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No hay patrocinadores que cumplan el filtro.
                  </TableCell>
                </TableRow>
              ) : filtradas.map((s) => {
                const partes = filtroRace === 'todas'
                  ? partesDe(s)
                  : partesDe(s).filter((p) => p.race_code === filtroRace);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => abrirFicha(s)}
                    data-testid={`sponsor-row-${s.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {s.logo_url ? (
                          <img src={`${API_URL}${s.logo_url}`} alt="" className="w-8 h-8 rounded object-contain bg-white border" />
                        ) : (
                          <span className="w-8 h-8 rounded border flex items-center justify-center text-muted-foreground">
                            <Building2 className="w-4 h-4" />
                          </span>
                        )}
                        <span>
                          {s.name}
                          {!s.is_active && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Retirado</Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.nombre_contacto || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.telefono || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.correo || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partes.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Sin carreras</span>
                        ) : partes.map((p) => (
                          <Badge key={p.race_code} className={`${getStatusInfo(p.status).badgeClass} text-[11px]`}>
                            {filtroRace === 'todas' ? `${p.race_code}: ` : ''}
                            {getStatusInfo(p.status).label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alta */}
      <Dialog open={creando} onOpenChange={setCreando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo patrocinador</DialogTitle>
            <DialogDescription>
              La ficha es una sola para la marca. Marca aquí las carreras que patrocina;
              el resto de los datos se llenan después en su ficha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nueva-name">Nombre de la marca *</Label>
              <Input
                id="nueva-name"
                value={nuevaForm.name}
                onChange={(e) => setNuevaForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Café Santo Domingo"
                data-testid="sponsor-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Carreras que patrocina</Label>
              {races.map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nuevaForm.races.includes(r.code)}
                    onChange={() => setNuevaForm((f) => ({
                      ...f,
                      races: f.races.includes(r.code)
                        ? f.races.filter((c) => c !== r.code)
                        : [...f.races, r.code],
                    }))}
                  />
                  {r.name}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={crear} disabled={creandoGuardando} data-testid="sponsor-crear">
                <Save className="w-4 h-4 mr-2" />
                {creandoGuardando ? 'Creando…' : 'Crear'}
              </Button>
              <Button variant="outline" onClick={() => setCreando(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ficha */}
      <Dialog open={!!abierta} onOpenChange={(v) => !v && setAbiertaId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {abierta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {abierta.name}
                  {!abierta.is_active && <Badge variant="outline">Retirado</Badge>}
                </DialogTitle>
                <DialogDescription>
                  {partesDe(abierta).length === 0
                    ? 'Todavía no patrocina ninguna carrera.'
                    : `Patrocina ${partesDe(abierta).map((p) => p.race_code).join(', ')}.`}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="comercial" data-testid="tab-comercial">Comercial</TabsTrigger>
                  <TabsTrigger value="marca" data-testid="tab-marca">Marca</TabsTrigger>
                  <TabsTrigger value="carreras" data-testid="tab-carreras">Carreras</TabsTrigger>
                  <TabsTrigger value="bitacora" data-testid="tab-bitacora">Bitácora</TabsTrigger>
                </TabsList>

                {/* Comercial */}
                <TabsContent value="comercial" className="space-y-4 pt-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Landmark className="w-4 h-4" />
                    Datos de la empresa
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ['name', 'Nombre del Patrocinador *', 'Ej: Café Santo Domingo'],
                      ['razon_social', 'Razón Social', 'Ej: Industrias Banilejas, S.A.S.'],
                      ['rnc', 'RNC', '1-01-00000-0'],
                      ['nombre_contacto', 'Nombre de Contacto', 'Persona con quien se gestiona'],
                      ['posicion_contacto', 'Posición del Contacto', 'Ej: Gerente de Mercadeo'],
                      ['telefono', 'Teléfono', '809-000-0000'],
                      ['correo', 'Correo', 'contacto@empresa.com'],
                      ['pagina_web', 'Página Web', 'www.empresa.com'],
                    ].map(([campo, label, placeholder]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label htmlFor={`ficha-${campo}`}>{label}</Label>
                        <Input
                          id={`ficha-${campo}`}
                          value={fichaForm[campo]}
                          onChange={(e) => setFichaForm((f) => ({ ...f, [campo]: e.target.value }))}
                          placeholder={placeholder}
                          data-testid={`ficha-${campo}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estos datos son de la marca: valen para todas las carreras que patrocine.
                  </p>
                </TabsContent>

                {/* Marca */}
                <TabsContent value="marca" className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-3">
                      {abierta.logo_url ? (
                        <>
                          <img
                            src={`${API_URL}${abierta.logo_url}`}
                            alt={abierta.name}
                            className="w-20 h-20 rounded border bg-white object-contain"
                          />
                          <Button variant="outline" size="sm" onClick={() => pedirImagen(null, 'logo')}>
                            <Upload className="w-4 h-4 mr-2" />Reemplazar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => quitarImagen(null, 'logo')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pedirImagen(null, 'logo')}
                          disabled={subiendo === 'logo'}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {subiendo === 'logo' ? 'Subiendo…' : 'Subir logo'}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El cuadrado de la marca. Es uno solo: sirve a la vitrina del sitio y al
                      pie de la app en todas las ediciones.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ficha-description">Descripción</Label>
                    <textarea
                      id="ficha-description"
                      value={fichaForm.description}
                      onChange={(e) => setFichaForm((f) => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                      placeholder="Una o dos líneas sobre la marca"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ficha-instagram" className="flex items-center gap-2">
                      <Instagram className="w-4 h-4" />Instagram
                    </Label>
                    <Input
                      id="ficha-instagram"
                      value={fichaForm.instagram}
                      onChange={(e) => setFichaForm((f) => ({ ...f, instagram: e.target.value }))}
                      placeholder="@lamarca"
                    />
                  </div>
                </TabsContent>

                {/* Carreras */}
                <TabsContent value="carreras" className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Marca las carreras que patrocina. Lo que se negocia en cada una —status,
                    categoría, monto, dónde se ve y el anuncio— vive dentro de su bloque.
                  </p>
                  {races.map((r) => {
                    const part = parteEn(abierta, r.code);
                    return (
                      <div key={r.code} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!part}
                            onChange={() => (part ? quitarCarrera(r.code) : marcarCarrera(r.code))}
                            data-testid={`carrera-check-${r.code}`}
                          />
                          {r.name}
                          {r.code === raceCode && (
                            <Badge variant="outline" className="text-[10px]">activa</Badge>
                          )}
                        </label>
                        {part && (
                          <BloqueCarrera
                            ficha={abierta}
                            race={r}
                            part={part}
                            onGuardar={guardarParticipacion}
                            onQuitar={quitarCarrera}
                            onSubirImagen={pedirImagen}
                            onQuitarImagen={quitarImagen}
                            subiendo={subiendo}
                            cuposTomados={cuposTomados}
                          />
                        )}
                      </div>
                    );
                  })}
                </TabsContent>

                {/* Bitácora */}
                <TabsContent value="bitacora" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <NotebookPen className="w-4 h-4" />Registrar un contacto
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={notaCarrera}
                        onChange={(e) => setNotaCarrera(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                      >
                        <option value="">Carrera…</option>
                        {partesDe(abierta).map((p) => (
                          <option key={p.race_code} value={p.race_code}>{nombreCarrera(p.race_code)}</option>
                        ))}
                      </select>
                      <Input
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        placeholder="Qué se habló, qué quedó pendiente"
                        className="flex-1 min-w-[200px]"
                        data-testid="bitacora-nota"
                      />
                      <Button onClick={agregarNota} disabled={guardandoNota}>
                        <Save className="w-4 h-4 mr-2" />
                        {guardandoNota ? 'Guardando…' : 'Anotar'}
                      </Button>
                    </div>
                  </div>

                  {bitacoraCompleta.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay contactos registrados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bitacoraCompleta.map((b) => (
                        <li key={b.id} className="text-sm border-l-2 pl-3 py-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{b.race_code}</Badge>
                            {formatFechaHora(b.fecha)}
                            {b.tipo === 'status' && <span className="italic">cambio de status</span>}
                          </div>
                          <p>{b.nota}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>

              {/* Pie de la ficha */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                <div className="flex gap-2">
                  {(tab === 'comercial' || tab === 'marca') && (
                    <Button onClick={guardarFicha} disabled={guardandoFicha} data-testid="guardar-ficha">
                      <Save className="w-4 h-4 mr-2" />
                      {guardandoFicha ? 'Guardando…' : 'Guardar ficha'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setAbiertaId(null)}>Cerrar</Button>
                </div>
                <div className="flex gap-2">
                  {abierta.is_active && (
                    <Button variant="outline" size="sm" onClick={retirar}>
                      <Archive className="w-4 h-4 mr-2" />Retirar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={borrar}>
                    <Trash2 className="w-4 h-4 mr-2" />Eliminar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
