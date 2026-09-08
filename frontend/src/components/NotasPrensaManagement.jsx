import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RichTextEditor } from './RichTextEditor';
import {
  Newspaper, Plus, Pencil, Trash2, Loader2, X, ExternalLink, Link2,
  Eye, EyeOff, ImagePlus, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VACIA = {
  tipo: 'aparicion',
  titulo: '',
  fecha: new Date().toISOString().slice(0, 10),
  resumen: '',
  medio: '',
  url: '',
  contenido: '',
  imagen_url: '',
  publicada: true,
};

const fmtFecha = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  if (!a) return iso;
  return new Date(a, m - 1, d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const urlImagen = (u) => (u && u.startsWith('/api') ? `${API_URL}${u}` : u);

/**
 * Notas de prensa: lo que se publica sobre la carrera.
 *
 * Dos clases en la misma lista. La *aparición* es de un medio y solo se
 * enlaza; el *comunicado* lo escribe la organización y se lee en el sitio, con
 * su propia página. Lo que se pide en el formulario cambia según cuál sea.
 */
export default function NotasPrensaManagement() {
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null); // null = nueva
  const [form, setForm] = useState(VACIA);
  const archivoRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await adminFetch(`${API_URL}/api/prensa/admin/notas`);
      if (r.ok) {
        const d = await r.json();
        setNotas(d.notas || []);
      } else {
        toast.error('No se pudieron cargar las notas');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return notas;
    return notas.filter((n) => `${n.titulo} ${n.medio || ''}`.toLowerCase().includes(t));
  }, [notas, busqueda]);

  const abrirNueva = () => { setEditando(null); setForm(VACIA); setModal(true); };
  const abrirEdicion = (n) => {
    setEditando(n);
    setForm({ ...VACIA, ...n, resumen: n.resumen || '', medio: n.medio || '', url: n.url || '', contenido: n.contenido || '', imagen_url: n.imagen_url || '' });
    setModal(true);
  };

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const subirImagen = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append('file', archivo);
      const r = await adminFetch(`${API_URL}/api/prensa/admin/notas/imagen`, { method: 'POST', body: datos });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setForm((f) => ({ ...f, imagen_url: d.url }));
      } else {
        toast.error(typeof d.detail === 'string' ? d.detail : 'No se pudo subir la imagen');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const destino = editando
        ? `${API_URL}/api/prensa/admin/notas/${editando.id}`
        : `${API_URL}/api/prensa/admin/notas`;
      const r = await adminFetch(destino, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success(editando ? 'Nota actualizada' : 'Nota creada');
        setModal(false);
        cargar();
      } else {
        // Un 422 de validación trae `detail` como lista de objetos, no como texto
        toast.error(typeof d.detail === 'string' ? d.detail : 'No se pudo guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (n) => {
    if (!window.confirm(`¿Borrar «${n.titulo}»? No se puede deshacer.`)) return;
    try {
      const r = await adminFetch(`${API_URL}/api/prensa/admin/notas/${n.id}`, { method: 'DELETE' });
      if (r.ok) { toast.success('Nota borrada'); cargar(); }
      else toast.error('No se pudo borrar');
    } catch {
      toast.error('Error de conexión');
    }
  };

  const cambiarPublicada = async (n) => {
    try {
      const r = await adminFetch(`${API_URL}/api/prensa/admin/notas/${n.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicada: !n.publicada }),
      });
      if (r.ok) { toast.success(n.publicada ? 'Pasó a borrador' : 'Publicada'); cargar(); }
      else toast.error('No se pudo cambiar');
    } catch {
      toast.error('Error de conexión');
    }
  };

  const copiarEnlace = async (n) => {
    const enlace = n.tipo === 'aparicion' ? n.url : `${window.location.origin}/prensa/${n.slug}`;
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success('Enlace copiado');
    } catch {
      window.prompt('Copia el enlace:', enlace);
    }
  };

  const esAparicion = form.tipo === 'aparicion';

  return (
    <div className="space-y-4" data-testid="notas-prensa">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#E8772E]" />Notas de Prensa
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Se ven en <a href="/prensa" target="_blank" rel="noopener noreferrer" className="underline">backyardultrasantodomingo.com/prensa</a>.
            La sección aparece en el menú del sitio en cuanto haya una nota publicada.
          </p>
        </div>
        <Button onClick={abrirNueva} className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="nueva-nota">
          <Plus className="w-4 h-4 mr-1.5" />Nueva nota
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título o medio"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" /></div>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{notas.length === 0 ? 'Todavía no hay notas. Crea la primera.' : 'Ninguna nota coincide con la búsqueda.'}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtradas.map((n) => (
            <Card key={n.id} data-testid={`nota-${n.id}`}>
              <CardContent className="p-4 flex items-start gap-4">
                {n.imagen_url && (
                  <img src={urlImagen(n.imagen_url)} alt="" className="w-24 aspect-[16/10] object-cover rounded-lg shrink-0 bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${
                      n.tipo === 'aparicion' ? 'bg-sky-100 text-sky-700' : 'bg-[#E8772E]/15 text-[#E8772E]'
                    }`}>
                      {n.tipo === 'aparicion' ? 'Aparición' : 'Comunicado'}
                    </span>
                    <span>{fmtFecha(n.fecha)}</span>
                    {n.medio && <span className="font-medium text-foreground">{n.medio}</span>}
                    {!n.publicada && (
                      <span className="font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Borrador</span>
                    )}
                  </div>
                  <h3 className="titular-nota font-semibold leading-snug break-words">{n.titulo}</h3>
                  {n.resumen && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.resumen}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => cambiarPublicada(n)}
                    title={n.publicada ? 'Pasar a borrador' : 'Publicar'} data-testid={`publicar-${n.id}`}>
                    {n.publicada ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copiarEnlace(n)} title="Copiar enlace">
                    {n.tipo === 'aparicion' ? <ExternalLink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirEdicion(n)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => borrar(n)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50" title="Borrar">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">{editando ? 'Editar nota' : 'Nueva nota'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: 'aparicion' }))}
                  className={`px-3 py-3 rounded-lg border text-left text-sm transition-all ${
                    esAparicion ? 'border-[#E8772E] bg-[#E8772E]/10 font-medium' : 'hover:bg-gray-50'
                  }`}
                  data-testid="tipo-aparicion"
                >
                  Aparición en un medio
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">Se enlaza a la publicación</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: 'comunicado' }))}
                  className={`px-3 py-3 rounded-lg border text-left text-sm transition-all ${
                    !esAparicion ? 'border-[#E8772E] bg-[#E8772E]/10 font-medium' : 'hover:bg-gray-50'
                  }`}
                  data-testid="tipo-comunicado"
                >
                  Comunicado propio
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">Se lee en el sitio</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={form.titulo} onChange={cambiar('titulo')} data-testid="nota-titulo" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha">Fecha de publicación</Label>
                  <Input id="fecha" type="date" value={form.fecha} onChange={cambiar('fecha')} data-testid="nota-fecha" />
                </div>
                {esAparicion && (
                  <div className="space-y-1.5">
                    <Label htmlFor="medio">Medio</Label>
                    <Input id="medio" value={form.medio} onChange={cambiar('medio')}
                      placeholder="Diario Libre" data-testid="nota-medio" />
                  </div>
                )}
              </div>

              {esAparicion && (
                <div className="space-y-1.5">
                  <Label htmlFor="url">Enlace a la publicación</Label>
                  <Input id="url" value={form.url} onChange={cambiar('url')}
                    placeholder="https://..." data-testid="nota-url" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="resumen">Resumen</Label>
                <Textarea id="resumen" rows={2} value={form.resumen} onChange={cambiar('resumen')}
                  placeholder="Una o dos líneas: es lo que se lee en la lista." data-testid="nota-resumen" />
              </div>

              {!esAparicion && (
                <div className="space-y-1.5">
                  <Label>Texto del comunicado</Label>
                  <RichTextEditor
                    value={form.contenido}
                    onChange={(html) => setForm((f) => ({ ...f, contenido: html }))}
                    placeholder="Escribe la nota…"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Imagen</Label>
                <div className="flex items-center gap-3">
                  {form.imagen_url && (
                    <img src={urlImagen(form.imagen_url)} alt="" className="w-28 aspect-[16/10] object-cover rounded-lg bg-gray-100" />
                  )}
                  <input ref={archivoRef} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={subirImagen} className="hidden" id="imagen-nota" />
                  <Button type="button" variant="outline" size="sm" disabled={subiendo}
                    onClick={() => archivoRef.current?.click()}>
                    {subiendo ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
                    {form.imagen_url ? 'Cambiar' : 'Subir imagen'}
                  </Button>
                  {form.imagen_url && (
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setForm((f) => ({ ...f, imagen_url: '' }))}>
                      Quitar
                    </Button>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm pt-1">
                <input type="checkbox" checked={form.publicada}
                  onChange={(e) => setForm((f) => ({ ...f, publicada: e.target.checked }))}
                  data-testid="nota-publicada" />
                Publicada (visible en el sitio)
              </label>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button onClick={guardar} disabled={guardando}
                className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="guardar-nota">
                {guardando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {editando ? 'Guardar' : 'Crear nota'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
