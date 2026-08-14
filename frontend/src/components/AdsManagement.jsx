import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Plus, Edit, Trash2, Save, X, Upload, Megaphone,
  ArrowUp, ArrowDown, MousePointerClick, Eye, Globe, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EMPTY_FORM = {
  name: '',
  text: '',
  link_url: '',
  weight: 1,
  start_at: '',
  end_at: '',
  is_active: true,
  mostrar_marca: true,
};

// datetime-local usa "YYYY-MM-DDTHH:MM"; el backend guarda ISO tal cual
const toInputValue = (iso) => (iso ? iso.slice(0, 16) : '');

export default function AdsManagement() {
  const { raceCode } = useRaceConfig();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const uploadTargetRef = useRef(null);
  const fileInputRef = useRef(null);
  // Los patrocinadores de la carrera, para decidir aquí dónde se ve cada uno.
  // Quién se ve de verdad no se recalcula aquí: se pregunta a las dos listas
  // públicas, que son exactamente lo que reciben el sitio y la app.
  const [sponsors, setSponsors] = useState([]);
  const [visibles, setVisibles] = useState({ web: [], app: [] });

  const fetchSponsors = useCallback(async () => {
    if (!raceCode) return;
    try {
      const [admin, web, app] = await Promise.all([
        adminFetch(`${API_URL}/api/sponsors/admin/race/${raceCode}`),
        fetch(`${API_URL}/api/sponsors/race/${raceCode}`),
        fetch(`${API_URL}/api/sponsors/race/${raceCode}?destino=app`),
      ]);
      if (!admin.ok) return;
      const { sponsors: todos } = await admin.json();
      const enWeb = web.ok ? (await web.json()).sponsors : [];
      const enApp = app.ok ? (await app.json()).sponsors : [];
      setSponsors(todos || []);
      setVisibles({
        web: (enWeb || []).map((x) => x.name),
        app: (enApp || []).map((x) => x.name),
      });
    } catch (error) {
      /* la publicidad se puede llevar igual sin esta lista */
    }
  }, [raceCode]);

  const cambiarVisibilidad = async (sponsor, campo) => {
    const siguiente = sponsor[campo] === false;
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/update/${encodeURIComponent(sponsor.name)}?race_code=${raceCode}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [campo]: siguiente }),
        }
      );
      if (response.ok) {
        fetchSponsors();
      } else {
        toast.error('No se pudo cambiar la visibilidad');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const fetchBanners = useCallback(async () => {
    if (!raceCode) return;
    setLoading(true);
    try {
      const response = await adminFetch(`${API_URL}/api/ads/admin?race_code=${raceCode}`);
      if (response.ok) {
        setBanners(await response.json());
      } else {
        toast.error('No se pudieron cargar los banners');
      }
    } catch (error) {
      toast.error('Error de conexión al cargar los banners');
    } finally {
      setLoading(false);
    }
  }, [raceCode]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (banner) => {
    setEditingId(banner.id);
    setForm({
      name: banner.name || '',
      text: banner.text || '',
      link_url: banner.link_url || '',
      weight: banner.weight || 1,
      start_at: toInputValue(banner.start_at),
      end_at: toInputValue(banner.end_at),
      is_active: banner.is_active !== false,
      mostrar_marca: banner.mostrar_marca !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre del patrocinador es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        text: form.text.trim(),
        link_url: form.link_url.trim(),
        weight: Number(form.weight) || 1,
        start_at: form.start_at || '',
        end_at: form.end_at || '',
        is_active: form.is_active,
        mostrar_marca: form.mostrar_marca,
      };
      let response;
      if (editingId) {
        response = await adminFetch(`${API_URL}/api/ads/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await adminFetch(`${API_URL}/api/ads/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, race_code: raceCode }),
        });
      }
      if (response.ok) {
        toast.success(editingId ? 'Banner actualizado' : 'Banner creado');
        setShowForm(false);
        fetchBanners();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.detail || 'No se pudo guardar el banner');
      }
    } catch (error) {
      toast.error('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  // La etiqueta "Patrocinador" se enciende también desde la lista: dentro del
  // formulario había que abrir el banner para verla, y no se encontraba.
  const handleToggleMarca = async (banner) => {
    const siguiente = banner.mostrar_marca === false;
    try {
      const response = await adminFetch(`${API_URL}/api/ads/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mostrar_marca: siguiente }),
      });
      if (response.ok) {
        toast.success(siguiente ? 'Se marcará como «Patrocinador»' : 'Sin la marca de «Patrocinador»');
        fetchBanners();
      } else {
        toast.error('No se pudo cambiar la marca');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      const response = await adminFetch(`${API_URL}/api/ads/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !banner.is_active }),
      });
      if (response.ok) {
        fetchBanners();
      } else {
        toast.error('No se pudo cambiar el estado');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleDelete = async (banner) => {
    if (!window.confirm(`¿Eliminar el banner de "${banner.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const response = await adminFetch(`${API_URL}/api/ads/${banner.id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Banner eliminado');
        fetchBanners();
      } else {
        toast.error('No se pudo eliminar el banner');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleMove = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;
    const reordered = [...banners];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBanners(reordered);
    try {
      const response = await adminFetch(`${API_URL}/api/ads/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((b) => b.id) }),
      });
      if (!response.ok) {
        toast.error('No se pudo guardar el orden');
        fetchBanners();
      }
    } catch (error) {
      toast.error('Error de conexión');
      fetchBanners();
    }
  };

  // Cada banner puede tener tres imágenes; el input de archivo es uno solo y
  // se recuerda para cuál se abrió.
  const ETIQUETA_IMAGEN = { logo: 'Logo', banner: 'Banner completo', detail: 'Imagen ampliada' };

  const triggerImageUpload = (bannerId, tipo) => {
    uploadTargetRef.current = { bannerId, tipo };
    fileInputRef.current?.click();
  };

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const destino = uploadTargetRef.current;
    if (!file || !destino) return;
    const { bannerId, tipo } = destino;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await adminFetch(`${API_URL}/api/ads/${bannerId}/imagen/${tipo}`, {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        toast.success(`${ETIQUETA_IMAGEN[tipo]} subido`);
        fetchBanners();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.detail || 'No se pudo subir la imagen');
      }
    } catch (error) {
      toast.error('Error de conexión al subir la imagen');
    }
  };

  const quitarImagen = async (bannerId, tipo) => {
    if (!window.confirm(`¿Quitar ${ETIQUETA_IMAGEN[tipo].toLowerCase()}?`)) return;
    try {
      const response = await adminFetch(`${API_URL}/api/ads/${bannerId}/imagen/${tipo}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Imagen quitada');
        fetchBanners();
      } else {
        toast.error('No se pudo quitar la imagen');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const vigenciaLabel = (banner) => {
    if (!banner.start_at && !banner.end_at) return 'Todo el evento';
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '…');
    return `${fmt(banner.start_at)} → ${fmt(banner.end_at)}`;
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Publicidad — banners de BYSD Live
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1.5">
            Rotan en el pie de la vista <code>/live</code> según su peso. El orden define la secuencia.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Agregar banner
        </Button>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleImageFile}
        />

        {showForm && (
          <div className="border rounded-xl p-4 mb-5 bg-muted/30">
            <p className="font-semibold mb-3">{editingId ? 'Editar banner' : 'Nuevo banner'}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Patrocinador *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Agua Cristal"
                />
              </div>
              <div>
                <Label>Texto del banner</Label>
                <Input
                  value={form.text}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder="Hidratación oficial del BYSD"
                />
              </div>
              <div>
                <Label>Enlace (al tocar el banner)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://aguacristal.do"
                />
              </div>
              <div>
                <Label>Peso de rotación (1–10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
              <div>
                <Label>Vigencia — desde (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Vigencia — hasta (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Activo (visible en la rotación)
            </label>
            <label className="flex items-start gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.mostrar_marca}
                onChange={(e) => setForm({ ...form, mostrar_marca: e.target.checked })}
              />
              <span>
                Marcar como &laquo;Patrocinador&raquo; sobre el banner
                <span className="block text-xs text-gray-500">
                  Distingue la publicidad del contenido de la app. Quítalo solo si la
                  propia pieza ya deja claro de quién es.
                </span>
              </span>
            </label>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1.5" /> Guardar
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 mr-1.5" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando banners…</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay banners para esta carrera. Crea el primero con «Agregar banner».
          </p>
        ) : (
          <div className="space-y-2.5">
            {banners.map((banner, index) => (
              <div
                key={banner.id}
                className={`flex flex-wrap items-center gap-3 border rounded-xl px-3 py-2.5 ${banner.is_active ? '' : 'opacity-55'}`}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    className="text-muted-foreground disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                    aria-label="Subir"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="text-muted-foreground disabled:opacity-30"
                    disabled={index === banners.length - 1}
                    onClick={() => handleMove(index, 1)}
                    aria-label="Bajar"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {banner.banner_url ? (
                  <img
                    src={`${API_URL}${banner.banner_url}`}
                    alt={banner.name}
                    className="w-28 aspect-[5/1] rounded-lg object-cover bg-white border"
                  />
                ) : banner.logo_url ? (
                  <img
                    src={`${API_URL}${banner.logo_url}`}
                    alt={banner.name}
                    className="w-11 h-11 rounded-lg object-contain bg-white border"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                    SIN LOGO
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">
                    {banner.name}{' '}
                    <Badge variant="outline" className="ml-1 align-middle">peso {banner.weight}×</Badge>
                    {banner.banner_url && (
                      <Badge variant="secondary" className="ml-1 align-middle">banner completo</Badge>
                    )}
                    {banner.detail_url && (
                      <Badge variant="secondary" className="ml-1 align-middle">con imagen ampliada</Badge>
                    )}
                    {banner.mostrar_marca === false && (
                      <Badge variant="outline" className="ml-1 align-middle opacity-70">sin marca</Badge>
                    )}
                  </p>
                  {banner.text && <p className="text-xs text-muted-foreground truncate">{banner.text}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {vigenciaLabel(banner)}
                    <span className="inline-flex items-center gap-1 ml-3">
                      <Eye className="w-3 h-3" /> {banner.impressions || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 ml-2">
                      <MousePointerClick className="w-3 h-3" /> {banner.clicks || 0}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 ml-auto justify-end">
                  <Button
                    size="sm"
                    variant={banner.mostrar_marca === false ? 'outline' : 'secondary'}
                    onClick={() => handleToggleMarca(banner)}
                    title="La nota «Patrocinador» sobre el banner"
                  >
                    Marca {banner.mostrar_marca === false ? 'no' : 'sí'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => triggerImageUpload(banner.id, 'logo')}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Logo
                  </Button>
                  <Button
                    size="sm"
                    variant={banner.banner_url ? 'secondary' : 'outline'}
                    onClick={() => (banner.banner_url ? quitarImagen(banner.id, 'banner') : triggerImageUpload(banner.id, 'banner'))}
                    title="PNG de 1200×240 px (proporción 5:1). Ocupa la barra completa y sustituye al logo y al texto."
                  >
                    {banner.banner_url
                      ? <><X className="w-3.5 h-3.5 mr-1" /> Quitar banner</>
                      : <><Upload className="w-3.5 h-3.5 mr-1" /> Banner 1200×240</>}
                  </Button>
                  <Button
                    size="sm"
                    variant={banner.detail_url ? 'secondary' : 'outline'}
                    onClick={() => (banner.detail_url ? quitarImagen(banner.id, 'detail') : triggerImageUpload(banner.id, 'detail'))}
                    title="Imagen que se abre dentro de la app al tocar el banner. 1080 px de ancho, alto libre."
                  >
                    {banner.detail_url
                      ? <><X className="w-3.5 h-3.5 mr-1" /> Quitar ampliada</>
                      : <><Upload className="w-3.5 h-3.5 mr-1" /> Ampliada</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={banner.is_active ? 'secondary' : 'default'}
                    onClick={() => handleToggleActive(banner)}
                  >
                    {banner.is_active ? 'Pausar' : 'Activar'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(banner)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vista previa: el banner tal como se ve en el pie de /live (modo oscuro) */}
        {banners.filter((b) => b.is_active).length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Vista previa del pie (modo oscuro)
            </p>
            <div className="rounded-xl bg-[#161616] border border-[#262626] h-[72px] flex items-center gap-3 px-4 relative max-w-md">
              <span className="absolute top-1 right-3 text-[8px] tracking-widest uppercase text-[#777777]">
                Patrocinador
              </span>
              {(() => {
                const first = banners.find((b) => b.is_active);
                return (
                  <>
                    {first.logo_url ? (
                      <img
                        src={`${API_URL}${first.logo_url}`}
                        alt={first.name}
                        className="w-12 h-12 rounded-xl object-contain bg-white"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#F2E8C7] text-[#333333] flex items-center justify-center text-[10px] font-extrabold">
                        {first.name.slice(0, 6)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{first.name}</p>
                      {first.text && <p className="text-[11px] text-[#999999] truncate">{first.text}</p>}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Dónde se ve cada patrocinador. Vive aquí y no en Patrocinadores porque
        aquella sección es la gestión comercial —el proceso, los contactos, la
        bitácora— y esto es publicación: lo mismo que se decide de los banners. */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" /> Dónde se ve cada patrocinador
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          El sitio y la app se encienden por separado. Un patrocinador puede estar en la
          página de patrocinadores y no en la app, o al revés.
        </p>
      </CardHeader>
      <CardContent>
        {sponsors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta carrera no tiene patrocinadores.</p>
        ) : (
          <div className="space-y-2">
            {sponsors.map((sponsor) => {
              const enWeb = visibles.web.includes(sponsor.name);
              const enApp = visibles.app.includes(sponsor.name);
              const apagadoWeb = sponsor.publicar_web === false;
              const apagadoApp = sponsor.publicar_app === false;
              return (
                <div
                  key={sponsor.name}
                  className={`flex flex-wrap items-center gap-3 border rounded-xl px-3 py-2.5 ${sponsor.is_active ? '' : 'opacity-55'}`}
                >
                  {sponsor.logo_url ? (
                    <img
                      src={`${API_URL}${sponsor.logo_url}`}
                      alt={sponsor.name}
                      className="w-10 h-10 rounded-lg object-contain bg-white border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                      SIN LOGO
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{sponsor.name}</p>
                    {/* El interruptor encendido no basta: si el proceso comercial
                        no ha llegado al momento de publicar, no se ve igual. */}
                    {!enWeb && !apagadoWeb && !enApp && !apagadoApp && (
                      <p className="text-[11px] text-muted-foreground">
                        Todavía no se publica: el proceso no ha llegado al momento elegido en Patrocinadores.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant={apagadoWeb ? 'outline' : 'secondary'}
                      onClick={() => cambiarVisibilidad(sponsor, 'publicar_web')}
                      title="Página de patrocinadores del sitio"
                    >
                      <Globe className="w-3.5 h-3.5 mr-1" /> Sitio {apagadoWeb ? 'no' : 'sí'}
                    </Button>
                    <Button
                      size="sm"
                      variant={apagadoApp ? 'outline' : 'secondary'}
                      onClick={() => cambiarVisibilidad(sponsor, 'publicar_app')}
                      title="Menú, pantalla de patrocinadores y pie publicitario de BYSD Live"
                    >
                      <Smartphone className="w-3.5 h-3.5 mr-1" /> App {apagadoApp ? 'no' : 'sí'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
