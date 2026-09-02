import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Plus, Edit, Trash2, Save, X, Upload,
  Building2, Image, Phone, Mail, Globe, User, Smartphone,
  NotebookPen, Eye, EyeOff, Landmark, BadgeDollarSign, ChevronDown, ChevronRight,
  History, Megaphone, MousePointerClick, Instagram, ArrowUp, ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { adminFetch } from '../lib/adminApi';
import { SPONSOR_CATEGORIES, getCategory } from '../lib/sponsorCategories';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Pipeline del proceso de cierre (mismo orden que el backend). "Prospecto" y
// "Declinado" complementan la lista original: inicio y salida negativa.
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

// Si el proceso comercial ya llegó al momento de publicar. Es la puerta
// comercial —«no lo enseñes hasta que firme»—, distinta de los interruptores
// de dónde se ve. Las dos tienen que dar el visto bueno.
const procesoPermitePublicar = (sponsor) => {
  if (!sponsor.is_active) return false;
  const idx = PIPELINE_ORDER.indexOf(sponsor.status || 'prospecto');
  if (idx === -1) return false; // declinado
  let desde = PIPELINE_ORDER.indexOf(sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE);
  if (desde === -1) desde = PIPELINE_ORDER.indexOf(DEFAULT_PUBLICAR_DESDE);
  return idx >= desde;
};

// Las tres piezas gráficas, con lo que hay que saber al subir cada una.
const PIEZAS = [
  { tipo: 'logo', campo: 'logo_url', label: 'Logo', ayuda: 'El cuadrado de la marca. Sirve a la vitrina del sitio y al pie de la app: es un solo archivo.' },
  { tipo: 'banner', campo: 'banner_url', label: 'Banner 1200×240', ayuda: 'Ocupa la barra completa del pie. Cuando existe, sustituye al logo y al texto.' },
  { tipo: 'detail', campo: 'detail_url', label: 'Imagen ampliada', ayuda: 'Se abre dentro de la app al tocar el banner. 1080 px de ancho, alto libre.' },
];

const tienePieza = (s) => PIEZAS.some((p) => s[p.campo]);

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

const EMPTY_FORM = {
  name: '',
  // Comercial
  razon_social: '',
  rnc: '',
  nombre_contacto: '',
  posicion_contacto: '',
  telefono: '',
  correo: '',
  pagina_web: '',
  propuesta_categoria: '',
  propuesta_monto: '',
  status: 'prospecto',
  publicar_desde: DEFAULT_PUBLICAR_DESDE,
  // Marca
  description: '',
  instagram: '',
  text: '',
  link_url: '',
  // Publicación
  publicar_web: true,
  publicar_app: true,
  mostrar_marca: true,
  weight: 1,
  start_at: '',
  end_at: '',
};

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

const formatMonto = (monto) => {
  if (monto === null || monto === undefined || monto === '') return null;
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(monto);
};

const vigenciaLabel = (s) => {
  if (!s.start_at && !s.end_at) return 'Todo el evento';
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '…');
  return `${fmt(s.start_at)} → ${fmt(s.end_at)}`;
};

export default function SponsorsManagement() {
  const { raceCode } = useRaceConfig();
  // El panel abre en la carrera activa, pero se puede mirar cualquier edición:
  // es lo que permite ver a los patrocinadores de años anteriores y traerlos.
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(raceCode);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Traer de otra edición
  const [showImport, setShowImport] = useState(false);
  const [importFrom, setImportFrom] = useState('');
  const [importCandidates, setImportCandidates] = useState([]);
  const [importSelected, setImportSelected] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [importing, setImporting] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [saving, setSaving] = useState(false);

  // Un solo acordeón abierto por tarjeta: "bitacora" o "publicidad".
  const [abierto, setAbierto] = useState({ name: null, panel: null });
  const [bitacoraNota, setBitacoraNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  // Las tres piezas comparten un único input de archivo, que recuerda para
  // cuál se abrió.
  const [subiendo, setSubiendo] = useState(null); // `${name}:${tipo}`
  const destinoSubida = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  // Categoría escrita a mano antes de que existiera el esquema: se muestra
  // para que quede claro qué decía, pero hay que elegir una del catálogo.
  const [categoriaFueraDeEsquema, setCategoriaFueraDeEsquema] = useState('');

  const loadSponsors = useCallback(async () => {
    if (!selectedRace) return;

    setLoading(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/admin/race/${selectedRace}`);
      if (response.ok) {
        const data = await response.json();
        setSponsors(data.sponsors || []);
      }
    } catch (error) {
      console.error('Error loading sponsors:', error);
      toast.error('Error al cargar patrocinadores');
    } finally {
      setLoading(false);
    }
  }, [selectedRace]);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  // La carrera activa llega después del primer render (la trae el contexto)
  useEffect(() => {
    if (raceCode) setSelectedRace(raceCode);
  }, [raceCode]);

  useEffect(() => {
    const loadRaces = async () => {
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
    loadRaces();
  }, []);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setCategoriaFueraDeEsquema('');
    setShowAddForm(false);
    setEditingSponsor(null);
  };

  // Cupos ya tomados en la edición que se está mirando. No bloquea nada: es
  // el aviso de que esa categoría se está quedando sin espacio. El
  // patrocinador que se edita no se cuenta a sí mismo.
  const cuposTomados = (slug) => sponsors.filter((s) => (
    s.propuesta_categoria === slug
    && s.is_active
    && s.status !== 'declinado'
    && s.name !== editingSponsor
  )).length;

  const buildPayload = () => ({
    name: formData.name,
    razon_social: formData.razon_social || '',
    rnc: formData.rnc || '',
    nombre_contacto: formData.nombre_contacto || '',
    posicion_contacto: formData.posicion_contacto || '',
    telefono: formData.telefono || '',
    correo: formData.correo || '',
    pagina_web: formData.pagina_web || '',
    // Vacío viaja como cadena, no como null: null lo descarta el backend y
    // no habría forma de quitarle la categoría a un patrocinador.
    propuesta_categoria: formData.propuesta_categoria || '',
    propuesta_monto: formData.propuesta_monto !== '' ? parseFloat(formData.propuesta_monto) : null,
    status: formData.status || 'prospecto',
    publicar_desde: formData.publicar_desde || DEFAULT_PUBLICAR_DESDE,
    description: formData.description || '',
    instagram: formData.instagram || '',
    text: formData.text || '',
    link_url: formData.link_url || '',
    publicar_web: formData.publicar_web,
    publicar_app: formData.publicar_app,
    mostrar_marca: formData.mostrar_marca,
    weight: Number(formData.weight) || 1,
    start_at: formData.start_at || '',
    end_at: formData.end_at || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (formData.propuesta_monto !== '' && isNaN(parseFloat(formData.propuesta_monto))) {
      toast.error('El monto de la propuesta debe ser un número');
      return;
    }

    setSaving(true);
    try {
      const response = editingSponsor
        ? await adminFetch(
          `${API_URL}/api/sponsors/update/${encodeURIComponent(editingSponsor)}?race_code=${selectedRace}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload()),
          }
        )
        : await adminFetch(`${API_URL}/api/sponsors/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildPayload(), race_code: selectedRace }),
        });

      if (response.ok) {
        toast.success(editingSponsor ? 'Patrocinador actualizado' : 'Patrocinador creado');
        loadSponsors();
        resetForm();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving sponsor:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sponsor) => {
    const categoriaGuardada = sponsor.propuesta_categoria || '';
    const esDelEsquema = !categoriaGuardada || !!getCategory(categoriaGuardada);
    setCategoriaFueraDeEsquema(esDelEsquema ? '' : categoriaGuardada);
    setEditingSponsor(sponsor.name);
    setFormData({
      name: sponsor.name,
      razon_social: sponsor.razon_social || '',
      rnc: sponsor.rnc || '',
      nombre_contacto: sponsor.nombre_contacto || '',
      posicion_contacto: sponsor.posicion_contacto || '',
      telefono: sponsor.telefono || '',
      correo: sponsor.correo || '',
      pagina_web: sponsor.pagina_web || '',
      propuesta_categoria: esDelEsquema ? categoriaGuardada : '',
      propuesta_monto: sponsor.propuesta_monto ?? '',
      status: sponsor.status || 'prospecto',
      publicar_desde: sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE,
      description: sponsor.description || '',
      instagram: sponsor.instagram || '',
      text: sponsor.text || '',
      link_url: sponsor.link_url || '',
      publicar_web: sponsor.publicar_web !== false,
      publicar_app: sponsor.publicar_app !== false,
      mostrar_marca: sponsor.mostrar_marca !== false,
      weight: sponsor.weight || 1,
      start_at: toInputValue(sponsor.start_at),
      end_at: toInputValue(sponsor.end_at),
    });
    setShowAddForm(true);
  };

  /* --------- Cambios sueltos desde la propia tarjeta, sin abrir el form --------- */

  const parchear = async (sponsor, cambios, mensaje) => {
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/update/${encodeURIComponent(sponsor.name)}?race_code=${selectedRace}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cambios),
        }
      );
      if (response.ok) {
        if (mensaje) toast.success(mensaje);
        loadSponsors();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'No se pudo guardar el cambio');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleStatusChange = (sponsor, status) => {
    if ((sponsor.status || 'prospecto') === status) return;
    parchear(sponsor, { status }, `Status actualizado a "${getStatusInfo(status).label}"`);
  };

  // Dónde se ve. Un interruptor por destino, en la misma tarjeta donde se
  // lleva el proceso comercial: antes vivían en la otra pestaña y el estado
  // de la vitrina del sitio se decidía desde la ficha de publicidad.
  const cambiarDonde = (sponsor, campo) =>
    parchear(sponsor, { [campo]: sponsor[campo] === false });

  const handleDelete = async (sponsorName) => {
    if (!window.confirm(`¿Eliminar permanentemente el patrocinador "${sponsorName}"? Se borran también sus imágenes. Esta acción no se puede deshacer.`)) return;

    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/hard-delete/${encodeURIComponent(sponsorName)}?race_code=${selectedRace}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Patrocinador eliminado permanentemente');
        setSponsors((prev) => prev.filter((s) => s.name !== sponsorName));
      } else {
        toast.error('Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      toast.error('Error al eliminar');
    }
  };

  /* ---------------- Piezas gráficas ---------------- */

  const pedirImagen = (sponsorName, tipo) => {
    destinoSubida.current = { sponsorName, tipo };
    fileInputRef.current?.click();
  };

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const destino = destinoSubida.current;
    if (!file || !destino) return;
    const { sponsorName, tipo } = destino;
    const etiqueta = PIEZAS.find((p) => p.tipo === tipo)?.label || 'Imagen';

    setSubiendo(`${sponsorName}:${tipo}`);
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/imagen/${tipo}/${encodeURIComponent(sponsorName)}?race_code=${selectedRace}`,
        { method: 'POST', body }
      );
      if (response.ok) {
        toast.success(`${etiqueta} subido`);
        loadSponsors();
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

  const quitarImagen = async (sponsorName, tipo) => {
    const etiqueta = PIEZAS.find((p) => p.tipo === tipo)?.label || 'la imagen';
    if (!window.confirm(`¿Quitar ${etiqueta.toLowerCase()} de "${sponsorName}"?`)) return;
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/imagen/${tipo}/${encodeURIComponent(sponsorName)}?race_code=${selectedRace}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        toast.success('Imagen quitada');
        loadSponsors();
      } else {
        toast.error('No se pudo quitar la imagen');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  /* ---------------- Orden ---------------- */

  const mover = async (index, direccion) => {
    const destino = index + direccion;
    if (destino < 0 || destino >= sponsors.length) return;
    const reordenados = [...sponsors];
    [reordenados[index], reordenados[destino]] = [reordenados[destino], reordenados[index]];
    setSponsors(reordenados);
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/reorder?race_code=${selectedRace}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reordenados.map((s, i) => ({ name: s.name, order: i + 1 }))),
        }
      );
      if (!response.ok) {
        toast.error('No se pudo guardar el orden');
        loadSponsors();
      }
    } catch {
      toast.error('Error de conexión');
      loadSponsors();
    }
  };

  /* ---------------- Bitácora ---------------- */

  const togglePanel = (sponsor, panel) => {
    setAbierto((prev) => (
      prev.name === sponsor.name && prev.panel === panel
        ? { name: null, panel: null }
        : { name: sponsor.name, panel }
    ));
    setBitacoraNota('');
  };

  const handleAddNota = async (sponsor) => {
    if (!bitacoraNota.trim()) {
      toast.error('Escribe la nota del contacto');
      return;
    }
    setSavingNota(true);
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/bitacora/${encodeURIComponent(sponsor.name)}?race_code=${selectedRace}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nota: bitacoraNota }),
        }
      );
      if (response.ok) {
        toast.success('Contacto registrado');
        setBitacoraNota('');
        loadSponsors();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'Error al registrar contacto');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingNota(false);
    }
  };

  const ultimoContacto = (sponsor) => {
    const entradas = sponsor.bitacora || [];
    return entradas.length ? entradas[entradas.length - 1] : null;
  };

  /* ---------------- Traer de otra edición ---------------- */

  const abrirImport = () => {
    const otras = races.filter((r) => r.code !== selectedRace);
    setImportFrom(otras[0]?.code || '');
    setImportCandidates([]);
    setImportSelected([]);
    setShowImport(true);
  };

  const yaEstaEnEstaCarrera = (name) => sponsors.some((s) => s.name === name);

  const loadCandidates = useCallback(async (fromRace) => {
    if (!fromRace) return;
    setLoadingCandidates(true);
    setImportSelected([]);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/admin/race/${fromRace}`);
      if (response.ok) {
        const data = await response.json();
        setImportCandidates(data.sponsors || []);
      } else {
        setImportCandidates([]);
      }
    } catch {
      toast.error('Error al cargar los patrocinadores de esa edición');
      setImportCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (showImport && importFrom) loadCandidates(importFrom);
  }, [showImport, importFrom, loadCandidates]);

  const toggleImportSelected = (name) => {
    setImportSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleImport = async () => {
    if (importSelected.length === 0) {
      toast.error('Marca al menos un patrocinador');
      return;
    }
    setImporting(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_race_code: importFrom,
          to_race_code: selectedRace,
          names: importSelected,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
        setShowImport(false);
        loadSponsors();
      } else {
        toast.error(data.detail || 'Error al traer los patrocinadores');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setImporting(false);
    }
  };

  const categoriaElegida = getCategory(formData.propuesta_categoria);
  const tomadosEnCategoria = categoriaElegida ? cuposTomados(categoriaElegida.slug) : 0;
  const sinCupos = !!categoriaElegida
    && categoriaElegida.cupos != null
    && tomadosEnCategoria >= categoriaElegida.cupos;

  // Los que de verdad se están viendo en cada sitio, para el resumen de
  // arriba: proceso cumplido, interruptor encendido y —en la app— con pieza.
  const enElSitio = sponsors.filter((s) => procesoPermitePublicar(s) && s.publicar_web !== false);
  const enLaApp = sponsors.filter((s) => procesoPermitePublicar(s) && s.publicar_app !== false && tienePieza(s));

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

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Patrocinios y Publicidad</h2>
          <p className="text-muted-foreground">
            {sponsors.length} registrados • {enElSitio.length} en el sitio • {enLaApp.length} en el pie de la app
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRace || ''}
            onChange={(e) => { resetForm(); setShowImport(false); setSelectedRace(e.target.value); }}
            className="px-3 py-2 border rounded-md bg-background text-sm"
            data-testid="sponsor-race-select"
          >
            {races.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}{r.code === raceCode ? ' (activa)' : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={abrirImport} data-testid="import-sponsors-btn">
            <History className="w-4 h-4 mr-2" />
            Traer de otra edición
          </Button>
          <Button onClick={() => { resetForm(); setShowAddForm(true); }} data-testid="add-sponsor-btn">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Patrocinador
          </Button>
        </div>
      </div>

      {/* Traer de otra edición */}
      {showImport && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" />
              Traer patrocinadores de otra edición
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Llegan los contactos, el logo, la descripción y el Instagram. El proceso
              empieza de nuevo en «Prospecto» y la copia nace apagada en los dos destinos:
              una edición que aún no ha empezado a vender no debería estrenar vitrina con
              las marcas del año pasado.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm">Desde</Label>
              <select
                value={importFrom}
                onChange={(e) => setImportFrom(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                {races.filter((r) => r.code !== selectedRace).map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            {loadingCandidates ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : importCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esa edición no tiene patrocinadores.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                {importCandidates.map((c) => {
                  const yaEsta = yaEstaEnEstaCarrera(c.name);
                  return (
                    <label
                      key={c.name}
                      className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded border ${yaEsta ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
                    >
                      <input
                        type="checkbox"
                        disabled={yaEsta}
                        checked={importSelected.includes(c.name)}
                        onChange={() => toggleImportSelected(c.name)}
                      />
                      <span className="truncate">{c.name}</span>
                      {yaEsta && (
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">ya está</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={handleImport} disabled={importing || importSelected.length === 0}>
                <Save className="w-4 h-4 mr-2" />
                {importing ? 'Trayendo...' : `Traer ${importSelected.length || ''}`.trim()}
              </Button>
              <Button variant="outline" onClick={() => setShowImport(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              {importCandidates.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportSelected(
                    importCandidates.filter((c) => !yaEstaEnEstaCarrera(c.name)).map((c) => c.name)
                  )}
                >
                  Marcar todos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alta / edición */}
      {showAddForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingSponsor ? 'Editar Patrocinador' : 'Nuevo Patrocinador'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Patrocinador *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Café Santo Domingo"
                  disabled={!!editingSponsor}
                  data-testid="sponsor-name-input"
                />
                {!editingSponsor && (
                  <p className="text-xs text-muted-foreground">
                    Las imágenes se suben después, desde su tarjeta.
                  </p>
                )}
              </div>

              {/* Datos comerciales */}
              <div className="pt-3 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  Datos Comerciales
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="razon_social">Razón Social</Label>
                    <Input
                      id="razon_social"
                      value={formData.razon_social}
                      onChange={(e) => setFormData((p) => ({ ...p, razon_social: e.target.value }))}
                      placeholder="Ej: Industrias Banilejas, S.A.S."
                      data-testid="sponsor-razon-social-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rnc">RNC</Label>
                    <Input
                      id="rnc"
                      value={formData.rnc}
                      onChange={(e) => setFormData((p) => ({ ...p, rnc: e.target.value }))}
                      placeholder="1-01-00000-0"
                      data-testid="sponsor-rnc-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre_contacto">Nombre de Contacto</Label>
                    <Input
                      id="nombre_contacto"
                      value={formData.nombre_contacto}
                      onChange={(e) => setFormData((p) => ({ ...p, nombre_contacto: e.target.value }))}
                      placeholder="Persona con quien se gestiona"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="posicion_contacto">Posición del Contacto</Label>
                    <Input
                      id="posicion_contacto"
                      value={formData.posicion_contacto}
                      onChange={(e) => setFormData((p) => ({ ...p, posicion_contacto: e.target.value }))}
                      placeholder="Ej: Gerente de Mercadeo"
                      data-testid="sponsor-posicion-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))}
                      placeholder="809-000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="correo">Correo</Label>
                    <Input
                      id="correo"
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData((p) => ({ ...p, correo: e.target.value }))}
                      placeholder="contacto@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagina_web">Página Web</Label>
                    <Input
                      id="pagina_web"
                      value={formData.pagina_web}
                      onChange={(e) => setFormData((p) => ({ ...p, pagina_web: e.target.value }))}
                      placeholder="www.empresa.com"
                    />
                  </div>
                </div>
              </div>

              {/* Propuesta */}
              <div className="pt-3 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <BadgeDollarSign className="w-4 h-4" />
                  Propuesta de Patrocinio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="propuesta_categoria">Categoría</Label>
                    <select
                      id="propuesta_categoria"
                      value={formData.propuesta_categoria}
                      onChange={(e) => setFormData((p) => ({ ...p, propuesta_categoria: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      data-testid="sponsor-categoria-input"
                    >
                      <option value="">Sin categoría asignada</option>
                      {SPONSOR_CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}{c.subtitle ? ` — ${c.subtitle}` : ''}
                        </option>
                      ))}
                    </select>
                    {categoriaFueraDeEsquema && (
                      <p className="text-xs text-amber-600">
                        Antes decía «{categoriaFueraDeEsquema}», que no es del esquema.
                        Elige la categoría que le corresponde.
                      </p>
                    )}
                    {categoriaElegida ? (
                      <p className={`text-xs ${sinCupos ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        Cupos: {categoriaElegida.cuposLabel}
                        {categoriaElegida.cupos != null && ` · ${tomadosEnCategoria} ocupado${tomadosEnCategoria === 1 ? '' : 's'}`}
                        {' · Aporte de referencia: '}
                        {categoriaElegida.monto != null ? `RD$${categoriaElegida.montoLabel}` : categoriaElegida.montoLabel}
                        {sinCupos && ' · Ya no quedan cupos'}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Es la categoría con la que entra y con la que se agrupa en la página de patrocinadores.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propuesta_monto">Monto (RD$)</Label>
                    <Input
                      id="propuesta_monto"
                      type="text"
                      inputMode="decimal"
                      value={formatMontoInput(formData.propuesta_monto)}
                      onChange={(e) => {
                        const raw = parseMontoInput(e.target.value);
                        if ((raw.match(/\./g) || []).length > 1) return;
                        setFormData((p) => ({ ...p, propuesta_monto: raw }));
                      }}
                      placeholder="100,000.00"
                      data-testid="sponsor-monto-input"
                    />
                  </div>
                </div>
              </div>

              {/* Proceso */}
              <div className="pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status del Proceso de Cierre</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    data-testid="sponsor-status-select"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicar_desde">Publicar a partir de</Label>
                  <select
                    id="publicar_desde"
                    value={formData.publicar_desde}
                    onChange={(e) => setFormData((p) => ({ ...p, publicar_desde: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    data-testid="sponsor-publicar-desde-select"
                  >
                    {STATUS_OPTIONS.filter((s) => s.value !== 'declinado').map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Hasta que el proceso no llegue aquí, no se publica en ningún sitio,
                    aunque los interruptores estén encendidos.
                  </p>
                </div>
              </div>

              {/* Marca y publicidad */}
              <div className="pt-3 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Marca y Publicidad
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="text">Texto del banner</Label>
                    <Input
                      id="text"
                      value={formData.text}
                      maxLength={80}
                      onChange={(e) => setFormData((p) => ({ ...p, text: e.target.value }))}
                      placeholder="Hidratación oficial del BYSD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link_url">Enlace (al tocar el banner)</Label>
                    <Input
                      id="link_url"
                      value={formData.link_url}
                      onChange={(e) => setFormData((p) => ({ ...p, link_url: e.target.value }))}
                      placeholder="https://empresa.do"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={formData.instagram}
                      onChange={(e) => setFormData((p) => ({ ...p, instagram: e.target.value }))}
                      placeholder="https://www.instagram.com/usuario/"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso de rotación (1–10)</Label>
                    <Input
                      id="weight"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.weight}
                      onChange={(e) => setFormData((p) => ({ ...p, weight: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Qué es y qué aporta al evento…"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md bg-background resize-none text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_at">Vigencia — desde (opcional)</Label>
                    <Input
                      id="start_at"
                      type="datetime-local"
                      value={formData.start_at}
                      onChange={(e) => setFormData((p) => ({ ...p, start_at: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_at">Vigencia — hasta (opcional)</Label>
                    <Input
                      id="end_at"
                      type="datetime-local"
                      value={formData.end_at}
                      onChange={(e) => setFormData((p) => ({ ...p, end_at: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Dónde se ve</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.publicar_web}
                      onChange={(e) => setFormData((p) => ({ ...p, publicar_web: e.target.checked }))}
                    />
                    Sitio — página de patrocinadores
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.publicar_app}
                      onChange={(e) => setFormData((p) => ({ ...p, publicar_app: e.target.checked }))}
                    />
                    App — vitrina de patrocinadores y rotación del pie
                  </label>
                  <label className="flex items-start gap-2 text-sm pt-1">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={formData.mostrar_marca}
                      onChange={(e) => setFormData((p) => ({ ...p, mostrar_marca: e.target.checked }))}
                    />
                    <span>
                      Marcar como «Patrocinador» sobre el banner
                      <span className="block text-xs text-muted-foreground">
                        Distingue la publicidad del contenido de la app. Quítalo solo si la
                        propia pieza ya deja claro de quién es.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : (editingSponsor ? 'Actualizar' : 'Crear')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista (oculta mientras el formulario está abierto, para concentrar la
          vista en el patrocinador que se edita) */}
      {!showAddForm && !showImport && (
      <div className="grid gap-4">
        {sponsors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No hay patrocinadores registrados para esta carrera</p>
              <p className="text-sm text-muted-foreground mt-1">
                Haz clic en "Agregar Patrocinador" para comenzar
              </p>
            </CardContent>
          </Card>
        ) : (
          sponsors.map((sponsor, index) => {
            const statusInfo = getStatusInfo(sponsor.status);
            const publicado = procesoPermitePublicar(sponsor);
            const ultima = ultimoContacto(sponsor);
            const categoria = getCategory(sponsor.propuesta_categoria);
            const panelAbierto = abierto.name === sponsor.name ? abierto.panel : null;
            const enWeb = publicado && sponsor.publicar_web !== false;
            const enApp = publicado && sponsor.publicar_app !== false && tienePieza(sponsor);
            return (
            <Card key={sponsor.name} className={!sponsor.is_active ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Orden */}
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      className="text-muted-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => mover(index, -1)}
                      aria-label="Subir"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="text-muted-foreground disabled:opacity-30"
                      disabled={index === sponsors.length - 1}
                      onClick={() => mover(index, 1)}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Logo */}
                  <div className="flex-shrink-0">
                    {sponsor.logo_url ? (
                      <div className="w-20 h-20 rounded-lg border overflow-hidden bg-white flex items-center justify-center">
                        <img
                          src={`${API_URL}${sponsor.logo_url}`}
                          alt={sponsor.name}
                          className="max-w-full max-h-full object-contain p-1"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border border-dashed flex items-center justify-center bg-muted/50">
                        <Image className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => pedirImagen(sponsor.name, 'logo')}
                      disabled={subiendo === `${sponsor.name}:logo`}
                      className="mt-2 w-full text-xs px-2 py-1.5 border rounded-md flex items-center justify-center gap-1 transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      {subiendo === `${sponsor.name}:logo` ? 'Subiendo...' : (sponsor.logo_url ? 'Cambiar' : 'Subir Logo')}
                    </button>
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                          {sponsor.name}
                          {!sponsor.is_active && (
                            <Badge variant="outline" className="text-xs">Inactivo</Badge>
                          )}
                          {categoria && (
                            <Badge className={`text-xs ${categoria.badgeClass} hover:${categoria.badgeClass}`}>
                              {categoria.label}
                            </Badge>
                          )}
                          {!categoria && sponsor.propuesta_categoria && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              {sponsor.propuesta_categoria}
                            </Badge>
                          )}
                          <Badge className={`text-xs ${statusInfo.badgeClass} hover:${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </Badge>
                          {publicado ? (
                            <Badge className="text-xs bg-green-600 text-white hover:bg-green-600 flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Proceso cumplido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              Aún no
                            </Badge>
                          )}
                        </h3>
                        {(sponsor.razon_social || sponsor.rnc) && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {sponsor.razon_social}
                            {sponsor.razon_social && sponsor.rnc ? ' · ' : ''}
                            {sponsor.rnc ? `RNC: ${sponsor.rnc}` : ''}
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePanel(sponsor, 'publicidad')}
                          title="Piezas gráficas, vigencia y métricas"
                          data-testid={`publicidad-sponsor-${sponsor.name}`}
                        >
                          <Megaphone className="w-4 h-4" />
                          <span className="ml-1 text-xs hidden md:inline">Publicidad</span>
                          {panelAbierto === 'publicidad' ? (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronRight className="w-3 h-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePanel(sponsor, 'bitacora')}
                          title="Bitácora de contactos"
                          data-testid={`bitacora-sponsor-${sponsor.name}`}
                        >
                          <NotebookPen className="w-4 h-4" />
                          <span className="ml-1 text-xs hidden md:inline">
                            Bitácora{(sponsor.bitacora || []).length > 0 ? ` (${sponsor.bitacora.length})` : ''}
                          </span>
                          {panelAbierto === 'bitacora' ? (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronRight className="w-3 h-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(sponsor)}
                          data-testid={`edit-sponsor-${sponsor.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sponsor.name)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contacto y propuesta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {sponsor.nombre_contacto && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {sponsor.nombre_contacto}
                          {sponsor.posicion_contacto ? ` — ${sponsor.posicion_contacto}` : ''}
                        </span>
                      )}
                      {sponsor.telefono && (
                        <a href={`tel:${sponsor.telefono}`} className="flex items-center gap-1 hover:underline">
                          <Phone className="w-3 h-3" />{sponsor.telefono}
                        </a>
                      )}
                      {sponsor.correo && (
                        <a href={`mailto:${sponsor.correo}`} className="flex items-center gap-1 hover:underline">
                          <Mail className="w-3 h-3" />{sponsor.correo}
                        </a>
                      )}
                      {sponsor.pagina_web && (
                        <a
                          href={sponsor.pagina_web.startsWith('http') ? sponsor.pagina_web : `https://${sponsor.pagina_web}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Globe className="w-3 h-3" />{sponsor.pagina_web}
                        </a>
                      )}
                      {sponsor.instagram && (
                        <a
                          href={sponsor.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Instagram className="w-3 h-3" />Instagram
                        </a>
                      )}
                      {sponsor.propuesta_monto != null && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <BadgeDollarSign className="w-3 h-3" />
                          {formatMonto(sponsor.propuesta_monto)}
                        </span>
                      )}
                    </div>

                    {/* Proceso e interruptores, juntos: lo que hace falta para
                        saber de un vistazo si esta marca se está viendo. */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <select
                        value={sponsor.status || 'prospecto'}
                        onChange={(e) => handleStatusChange(sponsor, e.target.value)}
                        className="px-2 py-1 text-xs border rounded-md bg-background"
                        data-testid={`status-select-${sponsor.name}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>

                      <Button
                        size="sm"
                        variant={sponsor.publicar_web === false ? 'outline' : 'secondary'}
                        onClick={() => cambiarDonde(sponsor, 'publicar_web')}
                        title="Página de patrocinadores del sitio"
                        data-testid={`web-toggle-${sponsor.name}`}
                      >
                        <Globe className="w-3.5 h-3.5 mr-1" />
                        Sitio {sponsor.publicar_web === false ? 'no' : 'sí'}
                      </Button>
                      <Button
                        size="sm"
                        variant={sponsor.publicar_app === false ? 'outline' : 'secondary'}
                        onClick={() => cambiarDonde(sponsor, 'publicar_app')}
                        title="Vitrina de BYSD Live y rotación del pie"
                        data-testid={`app-toggle-${sponsor.name}`}
                      >
                        <Smartphone className="w-3.5 h-3.5 mr-1" />
                        App {sponsor.publicar_app === false ? 'no' : 'sí'}
                      </Button>

                      {!publicado && sponsor.status !== 'declinado' && (
                        <span className="text-xs text-muted-foreground">
                          Se publica al llegar a <strong>{getStatusInfo(sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE).label}</strong>
                        </span>
                      )}
                      {publicado && sponsor.publicar_app !== false && !tienePieza(sponsor) && (
                        <span className="text-xs text-amber-600">
                          Sin imágenes: no se pinta en el pie de la app
                        </span>
                      )}
                    </div>

                    {ultima && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Último contacto: {formatFechaHora(ultima.fecha)} — {ultima.nota}
                      </p>
                    )}

                    {/* Publicidad (acordeón) */}
                    {panelAbierto === 'publicidad' && (
                      <div className="mt-3 pt-3 border-t space-y-3" data-testid={`publicidad-panel-${sponsor.name}`}>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-[#E8772E]" />
                          Piezas gráficas
                        </h4>

                        <div className="grid sm:grid-cols-3 gap-3">
                          {PIEZAS.map((pieza) => (
                            <div key={pieza.tipo} className="border rounded-lg p-3 space-y-2">
                              <p className="text-xs font-semibold">{pieza.label}</p>
                              {sponsor[pieza.campo] ? (
                                <img
                                  src={`${API_URL}${sponsor[pieza.campo]}`}
                                  alt={`${pieza.label} de ${sponsor.name}`}
                                  className={`w-full bg-white border rounded object-contain ${pieza.tipo === 'banner' ? 'aspect-[5/1]' : 'h-20'}`}
                                />
                              ) : (
                                <div className={`w-full border border-dashed rounded flex items-center justify-center bg-muted/40 text-[10px] text-muted-foreground ${pieza.tipo === 'banner' ? 'aspect-[5/1]' : 'h-20'}`}>
                                  sin imagen
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground leading-snug">{pieza.ayuda}</p>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  disabled={subiendo === `${sponsor.name}:${pieza.tipo}`}
                                  onClick={() => pedirImagen(sponsor.name, pieza.tipo)}
                                >
                                  <Upload className="w-3 h-3 mr-1" />
                                  {subiendo === `${sponsor.name}:${pieza.tipo}` ? '…' : (sponsor[pieza.campo] ? 'Cambiar' : 'Subir')}
                                </Button>
                                {sponsor[pieza.campo] && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => quitarImagen(sponsor.name, pieza.tipo)}
                                    title="Quitar"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Vigencia: {vigenciaLabel(sponsor)}</span>
                          <span>Peso: {sponsor.weight || 1}×</span>
                          <span>Marca «Patrocinador»: {sponsor.mostrar_marca === false ? 'no' : 'sí'}</span>
                          <span className="inline-flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {sponsor.impressions || 0} impresiones
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MousePointerClick className="w-3 h-3" /> {sponsor.clicks || 0} clics
                          </span>
                        </div>

                        {sponsor.text && (
                          <p className="text-xs text-muted-foreground">Texto: «{sponsor.text}»</p>
                        )}

                        <p className="text-xs text-muted-foreground">
                          El texto, el enlace, la descripción, la vigencia y el peso se
                          cambian desde <strong>Editar</strong>.
                        </p>

                        {/* Vista previa del pie, en el negro de la app */}
                        {(enApp || tienePieza(sponsor)) && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Vista previa del pie
                            </p>
                            {sponsor.banner_url ? (
                              <img
                                src={`${API_URL}${sponsor.banner_url}`}
                                alt={`Banner de ${sponsor.name}`}
                                className="rounded-xl border border-[#262626] max-w-md w-full aspect-[5/1] object-cover bg-[#161616]"
                              />
                            ) : (
                              <div className="rounded-xl bg-[#161616] border border-[#262626] h-[72px] flex items-center gap-3 px-4 relative max-w-md">
                                {sponsor.mostrar_marca !== false && (
                                  <span className="absolute top-1 right-3 text-[8px] tracking-widest uppercase text-[#777777]">
                                    Patrocinador
                                  </span>
                                )}
                                {sponsor.logo_url ? (
                                  <img
                                    src={`${API_URL}${sponsor.logo_url}`}
                                    alt={sponsor.name}
                                    className="w-12 h-12 rounded-xl object-contain bg-white"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-[#F2E8C7] text-[#333333] flex items-center justify-center text-[10px] font-extrabold">
                                    {sponsor.name.slice(0, 6)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-white truncate">{sponsor.name}</p>
                                  {sponsor.text && (
                                    <p className="text-[11px] text-[#999999] truncate">{sponsor.text}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bitácora (acordeón) */}
                    {panelAbierto === 'bitacora' && (
                      <div className="mt-3 pt-3 border-t space-y-3" data-testid={`bitacora-panel-${sponsor.name}`}>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <NotebookPen className="w-4 h-4 text-[#E8772E]" />
                          Bitácora de Contactos
                        </h4>

                        {/* Entradas en orden cronológico, la más nueva al final (estilo chat) */}
                        {(sponsor.bitacora || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            Aún no hay contactos registrados con este patrocinador
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(sponsor.bitacora || []).map((entrada) => (
                              <div
                                key={entrada.id}
                                className={`p-3 rounded-lg border text-sm ${
                                  entrada.tipo === 'status' ? 'bg-blue-50 border-blue-200' : 'bg-muted/40'
                                }`}
                              >
                                <div className="text-xs text-muted-foreground">{formatFechaHora(entrada.fecha)}</div>
                                <div className="mt-0.5">{entrada.nota}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Registrar contacto (abajo, como un chat) */}
                        <div className="space-y-2">
                          <textarea
                            placeholder="Registrar contacto (llamada, correo, reunión...)"
                            value={bitacoraNota}
                            onChange={(e) => setBitacoraNota(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-md bg-background resize-none text-sm"
                            data-testid="bitacora-nota-input"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleAddNota(sponsor)}
                              disabled={savingNota}
                              data-testid="bitacora-add-btn"
                            >
                              {savingNota ? 'Guardando...' : 'Registrar'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>
      )}

    </div>
  );
}
