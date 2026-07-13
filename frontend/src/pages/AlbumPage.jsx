import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '../components/ui/carousel';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Camera, Download, Loader2, LayoutGrid, GalleryHorizontal, Check, X, CheckCheck, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const thumb = (url) => `${url}=w500-h500`;
const display = (url) => `${url}=w1600`;

export default function AlbumPage() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('carousel'); // 'carousel' | 'grid'
  const [api, setApi] = useState(null);
  const [autoplay, setAutoplay] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const intervalRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/album/photos`);
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch {
      toast.error('No se pudieron cargar las fotos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  // Autoplay for the carousel
  useEffect(() => {
    if (!api || !autoplay || view !== 'carousel') return;
    intervalRef.current = setInterval(() => { api.scrollNext(); }, 3500);
    return () => clearInterval(intervalRef.current);
  }, [api, autoplay, view]);

  const downloadSingle = (url) => {
    const a = document.createElement('a');
    a.href = `${API_URL}/api/album/download?u=${encodeURIComponent(url)}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleSelect = (index) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(photos.map(p => p.index)));
  const clearSelection = () => setSelected(new Set());

  const downloadSelected = async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos una foto'); return; }
    if (selected.size > 60) { toast.error('Máximo 60 fotos por descarga'); return; }
    setDownloading(true);
    try {
      const urls = photos.filter(p => selected.has(p.index)).map(p => p.url);
      const res = await fetch(`${API_URL}/api/album/download-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) { toast.error('Error al preparar la descarga'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fotos-backyard-2026.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Descargando ${selected.size} fotos`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-28 pb-20" data-testid="album-page">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground mb-3">Álbum del Evento 2026</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Revive los mejores momentos de la Backyard Ultra Santo Domingo 2026.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
        ) : photos.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Aún no hay fotos disponibles.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* View toggle */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <span className="text-sm text-muted-foreground">{photos.length} fotos</span>
              <div className="flex items-center gap-2">
                <Button
                  variant={view === 'carousel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('carousel')}
                  className={view === 'carousel' ? 'bg-primary hover:bg-primary/90' : ''}
                  data-testid="view-carousel-btn"
                >
                  <GalleryHorizontal className="w-4 h-4 mr-2" />Carrusel
                </Button>
                <Button
                  variant={view === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('grid')}
                  className={view === 'grid' ? 'bg-primary hover:bg-primary/90' : ''}
                  data-testid="view-grid-btn"
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />Vista múltiple
                </Button>
              </div>
            </div>

            {/* Carousel view */}
            {view === 'carousel' && (
              <div className="px-12" data-testid="album-carousel">
                <Carousel opts={{ loop: true }} setApi={setApi}>
                  <CarouselContent>
                    {photos.map((p) => (
                      <CarouselItem key={p.index}>
                        <Card className="overflow-hidden">
                          <div className="bg-neutral-900 flex items-center justify-center">
                            <img
                              src={display(p.url)}
                              alt={`Foto ${p.index + 1}`}
                              className="max-h-[70vh] w-auto object-contain"
                              loading="lazy"
                              data-testid={`carousel-photo-${p.index}`}
                            />
                          </div>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious data-testid="album-prev" />
                  <CarouselNext data-testid="album-next" />
                </Carousel>

                <div className="flex items-center justify-center gap-3 mt-5">
                  <Button variant="outline" size="sm" onClick={() => setAutoplay(!autoplay)} data-testid="autoplay-toggle">
                    {autoplay ? <><Pause className="w-4 h-4 mr-2" />Pausar</> : <><Play className="w-4 h-4 mr-2" />Reproducir</>}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      const idx = api ? api.selectedScrollSnap() : 0;
                      const p = photos[idx];
                      if (p) downloadSingle(p.url);
                    }}
                    data-testid="download-current-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />Descargar foto
                  </Button>
                </div>
              </div>
            )}

            {/* Grid / multi-select view */}
            {view === 'grid' && (
              <div data-testid="album-grid">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-16 bg-background/90 backdrop-blur py-2 z-10">
                  <span className="text-sm font-medium text-foreground">{selected.size} seleccionada(s)</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} data-testid="select-all-btn">
                      <CheckCheck className="w-4 h-4 mr-2" />Todo
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection} disabled={selected.size === 0}>
                      <X className="w-4 h-4 mr-2" />Limpiar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={downloadSelected}
                      disabled={downloading || selected.size === 0}
                      data-testid="download-selected-btn"
                    >
                      {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Descargar seleccionadas
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {photos.map((p) => {
                    const isSel = selected.has(p.index);
                    return (
                      <button
                        key={p.index}
                        onClick={() => toggleSelect(p.index)}
                        className={`relative aspect-square overflow-hidden rounded-lg group ${isSel ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        data-testid={`grid-photo-${p.index}`}
                      >
                        <img src={thumb(p.url)} alt={`Foto ${p.index + 1}`} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <span className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSel ? 'bg-primary border-primary text-white' : 'bg-black/30 border-white/70 text-transparent'}`}>
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
