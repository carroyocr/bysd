import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  AlertTriangle, Check, Download, Eye, Flag, Image as ImageIcon, Loader2,
  QrCode, RotateCcw, Save, Trash2, Type, Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { adminFetch } from '../lib/adminApi';
import { descargarBlob } from '../lib/nativeExport';
import { useAdminRace } from '../contexts/AdminRaceContext';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Los dorsales de una carrera, para mandar a la imprenta.
 *
 * Una sola pantalla para las carreras que conviven: se elige cuál arriba y
 * todo lo demás —los corredores, el diseño guardado, el arte de fondo— va con
 * ella. El campeonato mundial sale completo, titulares y reservas, porque
 * ambos están inscritos como corredores; el filtro de categoría es para
 * imprimir por tandas, no para dejar a nadie fuera.
 *
 * Lo que se imprime debajo del número **no** es el nombre completo: es la
 * personalización que el propio atleta escribió. Se puede corregir línea a
 * línea antes de mandar nada, que es más barato que reimprimir 160 dorsales.
 *
 * La vista previa es el PDF de verdad, generado por el mismo código que la
 * descarga. Un preview dibujado aparte en el navegador mentiría justo en lo
 * que importa: dónde cae el corte y cómo queda el color en CMYK.
 */

const COLORES = [
  { campo: 'color_fondo', etiqueta: 'Fondo' },
  { campo: 'color_banda', etiqueta: 'Bandas' },
  { campo: 'color_texto_banda', etiqueta: 'Evento y pie' },
  { campo: 'color_numero', etiqueta: 'Número' },
  { campo: 'color_nombre', etiqueta: 'Nombre' },
];

const CATEGORIAS = [
  { valor: 'todas', texto: 'Todos' },
  { valor: 'titular', texto: 'Selección' },
  { valor: 'reserva', texto: 'Reserva' },
];

// Los tres sitios donde entra una imagen, tal como se ven en el dorsal de
// 2026: el arte de fondo, el logo de la carrera arriba y el del patrocinador
// abajo. `fuente` no es una imagen, pero se sube y se quita igual.
const RANURAS = [
  {
    id: 'logo',
    etiqueta: 'Logo de la carrera',
    ayuda: 'Va arriba a la izquierda, junto al nombre. Cuadrado, PNG con fondo transparente.',
  },
  {
    id: 'patrocinador',
    etiqueta: 'Logo del patrocinador',
    ayuda: 'Va centrado en la banda de abajo. Apaisado, PNG con fondo transparente.',
  },
  {
    id: 'fondo',
    etiqueta: 'Arte de fondo (opcional)',
    ayuda: 'Sustituye las bandas de color. A tamaño sangrado: 8,5 × 5,75 pulgadas '
      + '(2550 × 1725 px a 300 dpi), y el arte debe llegar hasta el borde. Si lo usas, '
      + 'los logos tienen que venir ya dentro del arte.',
  },
];

const rutaDe = (que) =>
  que === 'fuente' ? '/api/dorsales/fuente' : `/api/dorsales/imagen/${que}`;

const nombreDeArchivo = (code, cuantos) =>
  `dorsales-${code}-${cuantos === 1 ? 'muestra' : `${cuantos}`}.pdf`;

/**
 * Una ranura de archivo: lo que hay cargado, o el botón para cargarlo.
 *
 * Va a nivel de módulo y no dentro del render: definirlo anidado remonta el
 * `input` en cada tecleo y le quita el foco al resto del formulario.
 */
function Ranura({ ranura, diseno, subiendo, onSubir, onQuitar }) {
  const entrada = useRef(null);
  const archivo = diseno[`${ranura.id}_archivo`];
  const dpi = diseno[`${ranura.id}_dpi`];
  const ocupado = subiendo === ranura.id;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{ranura.etiqueta}</Label>
      {archivo ? (
        <div className="flex items-center gap-2 text-sm rounded-md border border-border p-2">
          <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">
            {diseno[`${ranura.id}_nombre_original`] || 'Imagen cargada'}
          </span>
          {dpi ? (
            <Badge variant={dpi >= 200 ? 'outline' : 'destructive'}>{dpi} dpi</Badge>
          ) : null}
          <Button size="icon" variant="ghost" onClick={() => onQuitar(ranura.id)} disabled={ocupado}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          disabled={ocupado}
          onClick={() => entrada.current?.click()}
        >
          {ocupado
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Upload className="w-4 h-4 mr-2" />}
          Cargar
        </Button>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { onSubir(ranura.id, e.target.files?.[0]); e.target.value = ''; }}
      />
      <p className="text-xs text-muted-foreground">{ranura.ayuda}</p>
    </div>
  );
}

export default function DorsalesManagement() {
  const { carreras, raceCode, setRaceCode } = useAdminRace();

  const [corredores, setCorredores] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [diseno, setDiseno] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [subiendo, setSubiendo] = useState('');

  const [seleccion, setSeleccion] = useState(() => new Set());
  const [nombres, setNombres] = useState({});
  const [tocados, setTocados] = useState(() => new Set());
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todas');

  const [muestra, setMuestra] = useState(null);      // URL del PDF de la vista previa
  const [previendo, setPreviendo] = useState(false);
  const previewRef = useRef(null);
  const fuenteRef = useRef(null);

  const conCategorias = corredores.some((c) => c.categoria);

  // ---------------- Carga ----------------

  // El diseño se relee solo (tras subir el arte o la tipografía); los
  // corredores solo al cambiar de carrera, porque releerlos rehace la
  // selección y se perdería lo que ya se había marcado.
  const cargarDiseno = useCallback(async () => {
    if (!raceCode) return;
    const res = await adminFetch(
      `${API_URL}/api/dorsales/diseno?race_code=${encodeURIComponent(raceCode)}`
    );
    if (!res.ok) throw new Error('No se pudo cargar el diseño');
    setDiseno((await res.json()).diseno);
  }, [raceCode]);

  const cargar = useCallback(async () => {
    if (!raceCode) return;
    setCargando(true);
    try {
      const res = await adminFetch(
        `${API_URL}/api/dorsales/corredores?race_code=${encodeURIComponent(raceCode)}`
      );
      if (!res.ok) throw new Error('No se pudieron cargar los corredores');
      const datos = await res.json();
      setCorredores(datos.corredores || []);
      setResumen(datos);
      setSeleccion(new Set((datos.corredores || []).map((c) => c.bib)));
      setTocados(new Set());
      await cargarDiseno();
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [raceCode, cargarDiseno]);

  useEffect(() => { cargar(); }, [cargar]);

  // El nombre que va impreso: la personalización que escribió el atleta y, si
  // la dejó vacía, su nombre de pila. Lo que se haya corregido a mano se
  // respeta: es una decisión, no un valor por defecto.
  useEffect(() => {
    if (!diseno) return;
    setNombres((previos) => {
      const siguientes = {};
      corredores.forEach((c) => {
        siguientes[c.bib] = tocados.has(c.bib)
          ? previos[c.bib] ?? ''
          : c.personalizacion || (diseno.usar_nombre_si_falta ? c.nombre : '');
      });
      return siguientes;
    });
  }, [corredores, diseno, tocados]);

  // ---------------- Diseño ----------------

  const cambiar = (campo, valor) => setDiseno((d) => ({ ...d, [campo]: valor }));

  const camposDelDiseno = (d) => ({
    evento: d.evento, pie: d.pie,
    color_fondo: d.color_fondo, color_banda: d.color_banda,
    color_texto_banda: d.color_texto_banda, color_numero: d.color_numero,
    color_nombre: d.color_nombre,
    mostrar_bandas: d.mostrar_bandas, mostrar_qr: d.mostrar_qr,
    qr_posicion: d.qr_posicion, qr_lado_mm: Number(d.qr_lado_mm) || 40,
    marcas_corte: d.marcas_corte, guias: d.guias,
    usar_nombre_si_falta: d.usar_nombre_si_falta,
  });

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await adminFetch(
        `${API_URL}/api/dorsales/diseno?race_code=${encodeURIComponent(raceCode)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(camposDelDiseno(diseno)),
        }
      );
      if (!res.ok) throw new Error('No se pudo guardar el diseño');
      setDiseno((await res.json()).diseno);
      toast.success('Diseño guardado para esta carrera');
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const subirArchivo = async (que, archivo) => {
    if (!archivo) return;
    setSubiendo(que);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      const res = await adminFetch(
        `${API_URL}${rutaDe(que)}?race_code=${encodeURIComponent(raceCode)}`,
        { method: 'POST', body: cuerpo }
      );
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.detail || 'No se pudo subir el archivo');
      if (datos.aviso) toast.warning(datos.aviso);
      else toast.success('Archivo cargado');
      await cargarDiseno();
      // Un arte de fondo trae sus propias bandas: las nuestras sobran y le
      // taparían justo la cabecera. Se vuelven a encender a mano, y la previa
      // lo enseña al momento.
      if (que === 'fondo') cambiar('mostrar_bandas', false);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setSubiendo('');
    }
  };

  const quitarArchivo = async (que) => {
    setSubiendo(que);
    try {
      const res = await adminFetch(
        `${API_URL}${rutaDe(que)}?race_code=${encodeURIComponent(raceCode)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('No se pudo quitar el archivo');
      await cargarDiseno();
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setSubiendo('');
    }
  };

  // ---------------- El PDF ----------------

  const pedirPdf = useCallback(async (lista) => {
    const res = await adminFetch(
      `${API_URL}/api/dorsales/pdf?race_code=${encodeURIComponent(raceCode)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diseno: camposDelDiseno(diseno), corredores: lista }),
      }
    );
    if (!res.ok) {
      const datos = await res.json().catch(() => ({}));
      throw new Error(datos.detail || 'No se pudo generar el PDF');
    }
    return res.blob();
  }, [raceCode, diseno]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return corredores.filter((c) => {
      if (categoria !== 'todas' && c.categoria !== categoria) return false;
      if (!termino) return true;
      return `${c.bib} ${c.nombre} ${c.apellidos} ${c.personalizacion}`.toLowerCase().includes(termino);
    });
  }, [corredores, busqueda, categoria]);

  const elegidos = useMemo(
    () => filtrados.filter((c) => seleccion.has(c.bib)),
    [filtrados, seleccion]
  );

  const descargar = async () => {
    if (!elegidos.length) {
      toast.error('No hay ningún corredor seleccionado');
      return;
    }
    setDescargando(true);
    try {
      const blob = await pedirPdf(
        elegidos.map((c) => ({ bib: c.bib, nombre: nombres[c.bib] || '' }))
      );
      descargarBlob(nombreDeArchivo(raceCode, elegidos.length), blob);
      toast.success(`${elegidos.length} dorsal(es) en camino`);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setDescargando(false);
    }
  };

  // La vista previa se rehace sola al cambiar cualquier parámetro, medio
  // segundo después del último toque: mover un color no dispara una petición
  // por cada tecla.
  const paraPrevia = elegidos[0] || filtrados[0] || corredores[0];
  const claveDelDiseno = diseno ? JSON.stringify(camposDelDiseno(diseno)) : '';
  const claveDeLaPrevia = `${raceCode}|${paraPrevia?.bib || ''}|${nombres[paraPrevia?.bib] || ''}|${claveDelDiseno}`;

  useEffect(() => {
    if (!diseno || !paraPrevia) return undefined;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      setPreviendo(true);
      try {
        const blob = await pedirPdf([
          { bib: paraPrevia.bib, nombre: nombres[paraPrevia.bib] || '' },
        ]);
        if (!vigente) return;
        const url = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        setMuestra(url);
      } catch {
        /* la previa es un extra: si falla, el aviso ya salió al descargar */
      } finally {
        if (vigente) setPreviendo(false);
      }
    }, 500);
    return () => { vigente = false; clearTimeout(temporizador); };
    // Solo la clave: lleva dentro la carrera, el corredor, su nombre y el
    // diseño entero. Añadir `pedirPdf` o `nombres` dispararía la petición en
    // renders donde no ha cambiado nada de lo que se dibuja.
  }, [claveDeLaPrevia]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  // ---------------- Pintado ----------------

  const alternar = (bib) => {
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      if (siguiente.has(bib)) siguiente.delete(bib);
      else siguiente.add(bib);
      return siguiente;
    });
  };

  const todosONinguno = () => {
    const todos = filtrados.every((c) => seleccion.has(c.bib));
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      filtrados.forEach((c) => (todos ? siguiente.delete(c.bib) : siguiente.add(c.bib)));
      return siguiente;
    });
  };

  const escribirNombre = (bib, valor) => {
    setNombres((previos) => ({ ...previos, [bib]: valor }));
    setTocados((previos) => (previos.has(bib) ? previos : new Set(previos).add(bib)));
  };

  const restablecerNombres = () => setTocados(new Set());

  if (cargando || !diseno) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando dorsales…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Carrera */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5 mr-1">
            <Flag className="w-4 h-4" /> Carrera
          </span>
          {carreras.map((c) => (
            <Button
              key={c.code}
              size="sm"
              variant={c.code === raceCode ? 'default' : 'outline'}
              onClick={() => setRaceCode(c.code)}
            >
              {c.name}
            </Button>
          ))}
          {resumen && (
            <span className="ml-auto text-sm text-muted-foreground">
              {resumen.total} con dorsal
              {resumen.sin_personalizacion > 0 && (
                <span className="text-amber-600 ml-2 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {resumen.sin_personalizacion} sin personalización
                </span>
              )}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Parámetros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Diseño del dorsal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="evento">Nombre del evento</Label>
              <Input
                id="evento"
                value={diseno.evento || ''}
                onChange={(e) => cambiar('evento', e.target.value)}
                placeholder="Backyard Ultra Santo Domingo"
              />
              <p className="text-xs text-muted-foreground">
                Va arriba, a la derecha del logo, partido en dos líneas. Con una barra
                vertical mandas dónde parte: <code>Backyard Ultra|Santo Domingo</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pie">Pie (fecha, sede…)</Label>
              <Input
                id="pie"
                value={diseno.pie || ''}
                onChange={(e) => cambiar('pie', e.target.value)}
                placeholder="Déjalo vacío para quitar la banda de abajo"
              />
              <p className="text-xs text-muted-foreground">
                Solo se imprime si no hay logo de patrocinador: esa banda es suya.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Colores</Label>
              <div className="grid grid-cols-2 gap-2">
                {COLORES.map(({ campo, etiqueta }) => (
                  <label key={campo} className="flex items-center gap-2 text-sm">
                    <input
                      type="color"
                      value={diseno[campo] || '#000000'}
                      onChange={(e) => cambiar(campo, e.target.value)}
                      className="h-8 w-10 rounded border border-input bg-background p-0.5 cursor-pointer"
                    />
                    <span className="text-muted-foreground truncate">{etiqueta}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Se convierten a CMYK al generar el PDF: la imprenta no imprime RGB.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Código QR de la vuelta
                </Label>
                <Switch
                  checked={!!diseno.mostrar_qr}
                  onCheckedChange={(v) => cambiar('mostrar_qr', v)}
                />
              </div>
              {diseno.mostrar_qr && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lado</Label>
                    <div className="flex gap-1">
                      {['izquierda', 'derecha'].map((lado) => (
                        <Button
                          key={lado}
                          size="sm"
                          variant={diseno.qr_posicion === lado ? 'default' : 'outline'}
                          onClick={() => cambiar('qr_posicion', lado)}
                          className="flex-1 capitalize"
                        >
                          {lado}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor="qr-lado">
                      Tamaño: {Math.round(diseno.qr_lado_mm || 40)} mm
                    </Label>
                    <input
                      id="qr-lado"
                      type="range"
                      min={20}
                      max={70}
                      step={1}
                      value={diseno.qr_lado_mm || 40}
                      onChange={(e) => cambiar('qr_lado_mm', Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Logos, arte de fondo y tipografía */}
            <div className="space-y-4">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Imágenes
              </Label>
              {RANURAS.map((ranura) => (
                <Ranura
                  key={ranura.id}
                  ranura={ranura}
                  diseno={diseno}
                  subiendo={subiendo}
                  onSubir={subirArchivo}
                  onQuitar={quitarArchivo}
                />
              ))}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipografía</Label>
                {diseno.fuente_archivo ? (
                  <div className="flex items-center gap-2 text-sm rounded-md border border-border p-2">
                    <Type className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{diseno.fuente_nombre_original}</span>
                    <Button size="icon" variant="ghost" onClick={() => quitarArchivo('fuente')}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={subiendo === 'fuente'}
                    onClick={() => fuenteRef.current?.click()}
                  >
                    {subiendo === 'fuente'
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Type className="w-4 h-4 mr-2" />}
                    Cargar tipografía (.ttf)
                  </Button>
                )}
                <input
                  ref={fuenteRef}
                  type="file"
                  accept=".ttf,.otf"
                  className="hidden"
                  onChange={(e) => { subirArchivo('fuente', e.target.files?.[0]); e.target.value = ''; }}
                />
                <p className="text-xs text-muted-foreground">
                  Se incrusta en el PDF, así no hay que mandarla aparte a la imprenta.
                </p>
              </div>
            </div>

            {/* Interruptores */}
            <div className="space-y-2.5 pt-1">
              {[
                ['mostrar_bandas', 'Bandas de color arriba y abajo'],
                ['marcas_corte', 'Marcas de corte para la imprenta'],
                ['guias', 'Guías de corte, margen seguro y ojales'],
                ['usar_nombre_si_falta', 'Sin personalización, usar el nombre de pila'],
              ].map(([campo, texto]) => (
                <div key={campo} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{texto}</span>
                  <Switch
                    checked={!!diseno[campo]}
                    onCheckedChange={(v) => cambiar(campo, v)}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Las guías son para revisar en pantalla. Quítalas antes de mandar el archivo.
              </p>
            </div>

            <Button onClick={guardar} disabled={guardando} className="w-full">
              {guardando
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Save className="w-4 h-4 mr-2" />}
              Guardar el diseño de esta carrera
            </Button>
          </CardContent>
        </Card>

        {/* Vista previa */}
        <Card className="lg:sticky lg:top-4 self-start">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" /> Vista previa
              {previendo && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            {paraPrevia && (
              <span className="text-xs text-muted-foreground">
                Dorsal {paraPrevia.bib}
              </span>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-muted/40 p-3 flex justify-center overflow-hidden">
              {muestra ? (
                <Document file={muestra} loading="" error="No se pudo dibujar la previa">
                  <Page pageNumber={1} width={520} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                  {paraPrevia ? 'Preparando la previa…' : 'Esta carrera no tiene dorsales asignados'}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Es el PDF real, el mismo que se descarga: 8 × 5,25 pulgadas de corte con
              0,25 de sangrado, esquinas redondeadas y el QR en vectores.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Corredores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Corredores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por dorsal o nombre…"
              className="max-w-xs"
            />
            {conCategorias && CATEGORIAS.map((c) => (
              <Button
                key={c.valor}
                size="sm"
                variant={categoria === c.valor ? 'default' : 'outline'}
                onClick={() => setCategoria(c.valor)}
              >
                {c.texto}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={todosONinguno}>
              <Check className="w-4 h-4 mr-1" />
              {filtrados.every((c) => seleccion.has(c.bib)) ? 'Ninguno' : 'Todos'}
            </Button>
            <Button size="sm" variant="ghost" onClick={restablecerNombres}>
              <RotateCcw className="w-4 h-4 mr-1" /> Restablecer nombres
            </Button>
            <Button
              className="ml-auto"
              onClick={descargar}
              disabled={descargando || !elegidos.length}
            >
              {descargando
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              Descargar {elegidos.length} dorsal{elegidos.length === 1 ? '' : 'es'}
            </Button>
          </div>

          <div className="rounded-md border border-border divide-y divide-border max-h-[28rem] overflow-y-auto">
            {filtrados.map((c) => (
              <div key={c.bib} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={seleccion.has(c.bib)}
                  onChange={() => alternar(c.bib)}
                  className="w-4 h-4 accent-orange-500 cursor-pointer"
                  aria-label={`Incluir el dorsal ${c.bib}`}
                />
                <span className="font-mono font-semibold w-12 shrink-0">{c.bib}</span>
                <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                  {c.nombre} {c.apellidos}
                </span>
                {c.categoria && (
                  <Badge variant="outline" className="capitalize shrink-0">{c.categoria}</Badge>
                )}
                {!c.personalizacion && (
                  <AlertTriangle
                    className="w-4 h-4 text-amber-500 shrink-0"
                    aria-label="Sin personalización: no escribió qué nombre quiere impreso"
                  />
                )}
                <Input
                  value={nombres[c.bib] ?? ''}
                  onChange={(e) => escribirNombre(c.bib, e.target.value)}
                  maxLength={20}
                  placeholder="Nombre impreso"
                  className="w-44 h-8 shrink-0"
                />
              </div>
            ))}
            {!filtrados.length && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Ningún corredor con dorsal asignado{busqueda ? ' para esa búsqueda' : ''}.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
