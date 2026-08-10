import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Plus, Edit, Trash2, Save, X, Upload, Instagram,
  Building2, ExternalLink, Image, Phone, Mail, Globe, User,
  NotebookPen, Eye, EyeOff, Landmark, BadgeDollarSign, ChevronDown, ChevronRight,
  History, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { adminFetch } from '../lib/adminApi';

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

// Orden del pipeline (sin "declinado", que nunca se publica). Cada
// patrocinador se publica al alcanzar el momento elegido en publicar_desde
// (por defecto "cierre").
const PIPELINE_ORDER = STATUS_OPTIONS.filter((s) => s.value !== 'declinado').map((s) => s.value);
const DEFAULT_PUBLICAR_DESDE = 'cierre';

const getStatusInfo = (status) =>
  STATUS_OPTIONS.find((s) => s.value === (status || 'prospecto')) || STATUS_OPTIONS[0];

const isPublished = (sponsor) => {
  if (!sponsor.is_active) return false;
  // Publicación apagada por defecto: sin status cuenta como "prospecto"
  const idx = PIPELINE_ORDER.indexOf(sponsor.status || 'prospecto');
  if (idx === -1) return false; // declinado
  let threshold = PIPELINE_ORDER.indexOf(sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE);
  if (threshold === -1) threshold = PIPELINE_ORDER.indexOf(DEFAULT_PUBLICAR_DESDE);
  return idx >= threshold;
};

// Separador de miles para el campo de monto (se guarda sin comas)
const formatMontoInput = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const [ent, dec] = String(value).split('.');
  const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${entFmt}.${dec}` : entFmt;
};

const parseMontoInput = (str) => (str || '').replace(/,/g, '').replace(/[^0-9.]/g, '');

const EMPTY_FORM = {
  name: '',
  description: '',
  instagram: '',
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
  const [uploadingLogo, setUploadingLogo] = useState(null);

  // Bitácora (acordeón dentro de la tarjeta)
  const [expandedBitacora, setExpandedBitacora] = useState(null); // sponsor.name
  const [bitacoraNota, setBitacoraNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

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
    setShowAddForm(false);
    setEditingSponsor(null);
  };

  const buildPayload = () => ({
    name: formData.name,
    description: formData.description,
    instagram: formData.instagram || null,
    razon_social: formData.razon_social || null,
    rnc: formData.rnc || null,
    nombre_contacto: formData.nombre_contacto || null,
    posicion_contacto: formData.posicion_contacto || null,
    telefono: formData.telefono || null,
    correo: formData.correo || null,
    pagina_web: formData.pagina_web || null,
    propuesta_categoria: formData.propuesta_categoria || null,
    propuesta_monto: formData.propuesta_monto !== '' ? parseFloat(formData.propuesta_monto) : null,
    status: formData.status || 'prospecto',
    publicar_desde: formData.publicar_desde || DEFAULT_PUBLICAR_DESDE,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error('Nombre y descripción son requeridos');
      return;
    }
    if (formData.propuesta_monto !== '' && isNaN(parseFloat(formData.propuesta_monto))) {
      toast.error('El monto de la propuesta debe ser un número');
      return;
    }

    setSaving(true);
    try {
      if (editingSponsor) {
        // Update existing sponsor
        const response = await adminFetch(
          `${API_URL}/api/sponsors/update/${encodeURIComponent(editingSponsor)}?race_code=${selectedRace}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload())
          }
        );

        if (response.ok) {
          toast.success('Patrocinador actualizado');
          loadSponsors();
          resetForm();
        } else {
          const error = await response.json();
          toast.error(error.detail || 'Error al actualizar');
        }
      } else {
        // Create new sponsor
        const response = await adminFetch(`${API_URL}/api/sponsors/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildPayload(), race_code: selectedRace })
        });

        if (response.ok) {
          toast.success('Patrocinador creado');
          loadSponsors();
          resetForm();
        } else {
          const error = await response.json();
          toast.error(error.detail || 'Error al crear');
        }
      }
    } catch (error) {
      console.error('Error saving sponsor:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sponsor) => {
    setEditingSponsor(sponsor.name);
    setFormData({
      name: sponsor.name,
      description: sponsor.description,
      instagram: sponsor.instagram || '',
      razon_social: sponsor.razon_social || '',
      rnc: sponsor.rnc || '',
      nombre_contacto: sponsor.nombre_contacto || '',
      posicion_contacto: sponsor.posicion_contacto || '',
      telefono: sponsor.telefono || '',
      correo: sponsor.correo || '',
      pagina_web: sponsor.pagina_web || '',
      propuesta_categoria: sponsor.propuesta_categoria || '',
      propuesta_monto: sponsor.propuesta_monto ?? '',
      status: sponsor.status || 'prospecto',
      publicar_desde: sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE,
    });
    setShowAddForm(true);
  };

  const handleStatusChange = async (sponsor, status) => {
    if ((sponsor.status || 'prospecto') === status) return;
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/update/${encodeURIComponent(sponsor.name)}?race_code=${selectedRace}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      if (response.ok) {
        const info = getStatusInfo(status);
        toast.success(`Status actualizado a "${info.label}"`);
        loadSponsors();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al actualizar status');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDelete = async (sponsorName) => {
    if (!window.confirm(`¿Eliminar permanentemente el patrocinador "${sponsorName}"? Esta acción no se puede deshacer.`)) return;

    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/hard-delete/${encodeURIComponent(sponsorName)}?race_code=${selectedRace}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Patrocinador eliminado permanentemente');
        // Update local state immediately for better UX
        setSponsors(prev => prev.filter(s => s.name !== sponsorName));
      } else {
        toast.error('Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      toast.error('Error al eliminar');
    }
  };

  const handleLogoUpload = async (sponsorName, file) => {
    if (!file) return;

    setUploadingLogo(sponsorName);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/upload-logo/${encodeURIComponent(sponsorName)}?race_code=${selectedRace}`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (response.ok) {
        toast.success('Logo subido exitosamente');
        loadSponsors();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al subir logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Error al subir logo');
    } finally {
      setUploadingLogo(null);
    }
  };

  /* ---------------- Bitácora ---------------- */

  const toggleBitacora = (sponsor) => {
    setExpandedBitacora(expandedBitacora === sponsor.name ? null : sponsor.name);
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
          body: JSON.stringify({ nota: bitacoraNota })
        }
      );
      if (response.ok) {
        toast.success('Contacto registrado');
        setBitacoraNota('');
        loadSponsors();
      } else {
        const error = await response.json();
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
    if (entradas.length === 0) return null;
    return entradas[entradas.length - 1];
  };

  /* ---------------- Traer de otra edición ---------------- */

  const abrirImport = () => {
    const otras = races.filter((r) => r.code !== selectedRace);
    setImportFrom(otras[0]?.code || '');
    setImportCandidates([]);
    setImportSelected([]);
    setShowImport(true);
  };

  // Los que ya están en esta carrera se muestran, pero no se pueden marcar
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Patrocinadores</h2>
          <p className="text-muted-foreground">
            Gestiona los patrocinadores y su proceso de cierre • {sponsors.length} registrados •{' '}
            {sponsors.filter(isPublished).length} publicados en el sitio
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

      {/* Traer patrocinadores de otra edición */}
      {showImport && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-[#E8772E]" />
              Traer patrocinadores a {races.find((r) => r.code === selectedRace)?.name || selectedRace}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-from">Edición de origen</Label>
              <select
                id="import-from"
                value={importFrom}
                onChange={(e) => setImportFrom(e.target.value)}
                className="w-full md:w-96 px-3 py-2 border rounded-md bg-background"
                data-testid="import-from-select"
              >
                {races.filter((r) => r.code !== selectedRace).map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Llegan con su descripción, logo y datos de contacto, pero el proceso vuelve a
                empezar en "Prospecto": no se publican hasta que cierres el patrocinio.
              </p>
            </div>

            {loadingCandidates ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : importCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                Esa edición no tiene patrocinadores registrados
              </p>
            ) : (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {importCandidates.map((c) => {
                  const repetido = yaEstaEnEstaCarrera(c.name);
                  const marcado = importSelected.includes(c.name);
                  return (
                    <label
                      key={c.name}
                      className={`flex items-center gap-3 px-3 py-2 ${repetido ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={repetido}
                        onChange={() => toggleImportSelected(c.name)}
                        className="w-4 h-4"
                        data-testid={`import-check-${c.name}`}
                      />
                      {c.logo_url ? (
                        <img
                          src={`${API_URL}${c.logo_url}`}
                          alt={c.name}
                          className="w-9 h-9 object-contain bg-white rounded border"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded border border-dashed flex items-center justify-center">
                          <Image className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="flex-1 min-w-0 text-sm truncate">{c.name}</span>
                      {repetido && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          <Check className="w-3 h-3 mr-1" />Ya está
                        </Badge>
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

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingSponsor ? 'Editar Patrocinador' : 'Nuevo Patrocinador'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Patrocinador *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Café Santo Domingo"
                    disabled={!!editingSponsor}
                    data-testid="sponsor-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram (URL completa)</Label>
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="instagram"
                      value={formData.instagram}
                      onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                      placeholder="https://www.instagram.com/usuario/"
                      className="pl-10"
                      data-testid="sponsor-instagram-input"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del patrocinador..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md bg-background resize-none"
                  data-testid="sponsor-description-input"
                />
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
                      onChange={(e) => setFormData(prev => ({ ...prev, razon_social: e.target.value }))}
                      placeholder="Ej: Industrias Banilejas, S.A.S."
                      data-testid="sponsor-razon-social-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rnc">RNC</Label>
                    <Input
                      id="rnc"
                      value={formData.rnc}
                      onChange={(e) => setFormData(prev => ({ ...prev, rnc: e.target.value }))}
                      placeholder="1-01-00000-0"
                      data-testid="sponsor-rnc-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre_contacto">Nombre de Contacto</Label>
                    <Input
                      id="nombre_contacto"
                      value={formData.nombre_contacto}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre_contacto: e.target.value }))}
                      placeholder="Persona con quien se gestiona"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="posicion_contacto">Posición del Contacto</Label>
                    <Input
                      id="posicion_contacto"
                      value={formData.posicion_contacto}
                      onChange={(e) => setFormData(prev => ({ ...prev, posicion_contacto: e.target.value }))}
                      placeholder="Ej: Gerente de Mercadeo"
                      data-testid="sponsor-posicion-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                      placeholder="809-000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="correo">Correo</Label>
                    <Input
                      id="correo"
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                      placeholder="contacto@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagina_web">Página Web</Label>
                    <Input
                      id="pagina_web"
                      value={formData.pagina_web}
                      onChange={(e) => setFormData(prev => ({ ...prev, pagina_web: e.target.value }))}
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
                    <Input
                      id="propuesta_categoria"
                      value={formData.propuesta_categoria}
                      onChange={(e) => setFormData(prev => ({ ...prev, propuesta_categoria: e.target.value }))}
                      placeholder="Ej: Platino, Oro, Plata, Bronce"
                      data-testid="sponsor-categoria-input"
                    />
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
                        setFormData(prev => ({ ...prev, propuesta_monto: raw }));
                      }}
                      placeholder="100,000.00"
                      data-testid="sponsor-monto-input"
                    />
                  </div>
                </div>
              </div>

              {/* Status + publicación */}
              <div className="pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status del Proceso de Cierre</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    data-testid="sponsor-status-select"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicar_desde">Publicar en el sitio a partir de</Label>
                  <select
                    id="publicar_desde"
                    value={formData.publicar_desde}
                    onChange={(e) => setFormData(prev => ({ ...prev, publicar_desde: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    data-testid="sponsor-publicar-desde-select"
                  >
                    {STATUS_OPTIONS.filter((s) => s.value !== 'declinado').map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    El patrocinador aparece en la página de patrocinadores cuando el proceso alcanza este momento.
                  </p>
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

      {/* Sponsors List (oculta mientras el formulario está abierto, para
          concentrar la vista en el patrocinador que se edita) */}
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
          sponsors.map((sponsor) => {
            const statusInfo = getStatusInfo(sponsor.status);
            const publicado = isPublished(sponsor);
            const ultima = ultimoContacto(sponsor);
            return (
            <Card key={sponsor.name} className={!sponsor.is_active ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
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

                    {/* Logo Upload */}
                    <label className="block mt-2 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(sponsor.name, e.target.files[0])}
                        disabled={uploadingLogo === sponsor.name}
                      />
                      <div className={`w-full text-xs px-2 py-1.5 border rounded-md flex items-center justify-center gap-1 transition-colors ${uploadingLogo === sponsor.name ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}`}>
                        <Upload className="w-3 h-3" />
                        {uploadingLogo === sponsor.name ? 'Subiendo...' : 'Subir Logo'}
                      </div>
                    </label>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                          {sponsor.name}
                          {!sponsor.is_active && (
                            <Badge variant="outline" className="text-xs">Inactivo</Badge>
                          )}
                          <Badge className={`text-xs ${statusInfo.badgeClass} hover:${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </Badge>
                          {publicado ? (
                            <Badge className="text-xs bg-green-600 text-white hover:bg-green-600 flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Publicado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              No publicado
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
                        {sponsor.instagram && (
                          <a
                            href={sponsor.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-pink-500 hover:text-pink-600 flex items-center gap-1 mt-1"
                          >
                            <Instagram className="w-3 h-3" />
                            Instagram
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleBitacora(sponsor)}
                          title="Bitácora de contactos"
                          data-testid={`bitacora-sponsor-${sponsor.name}`}
                        >
                          <NotebookPen className="w-4 h-4" />
                          <span className="ml-1 text-xs hidden md:inline">
                            Bitácora{(sponsor.bitacora || []).length > 0 ? ` (${sponsor.bitacora.length})` : ''}
                          </span>
                          {expandedBitacora === sponsor.name ? (
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

                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {sponsor.description}
                    </p>

                    {/* Contact + proposal summary */}
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
                      {(sponsor.propuesta_categoria || sponsor.propuesta_monto != null) && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <BadgeDollarSign className="w-3 h-3" />
                          {sponsor.propuesta_categoria || 'Propuesta'}
                          {formatMonto(sponsor.propuesta_monto) ? ` · ${formatMonto(sponsor.propuesta_monto)}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Status quick-change + último contacto */}
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mt-3">
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
                      {!publicado && sponsor.status !== 'declinado' && (
                        <span className="text-xs text-muted-foreground">
                          Se publica al llegar a: <strong>{getStatusInfo(sponsor.publicar_desde || DEFAULT_PUBLICAR_DESDE).label}</strong>
                        </span>
                      )}
                      {ultima && (
                        <span className="text-xs text-muted-foreground">
                          Último contacto: {formatFechaHora(ultima.fecha)} — {ultima.nota}
                        </span>
                      )}
                    </div>

                    {/* Bitácora (acordeón) */}
                    {expandedBitacora === sponsor.name && (
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
