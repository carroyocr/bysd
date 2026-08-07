import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mountain, Plus, Trash2, Save, Loader2, ExternalLink, Edit, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EMPTY_RESULT = { date: '', race: '', distance_km: '', time: '', position: '' };

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * Experiencia ITRA del atleta (enlace + snapshot manual).
 *
 * ITRA no tiene API pública y bloquea la lectura desde servidores, así que el
 * atleta copia aquí sus datos de itra.run; se muestran en su ficha de BYSD Live.
 */
export default function ItraExperienceSection({ athlete, onSaved }) {
  const snapshot = athlete?.itra_snapshot || {};

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      itra_url: athlete?.itra_url || '',
      performance_index: snapshot.performance_index ?? '',
      level: snapshot.level || '',
      age_category: snapshot.age_category || '',
      finished_races: snapshot.finished_races ?? '',
      total_distance_km: snapshot.total_distance_km ?? '',
      total_elevation_m: snapshot.total_elevation_m ?? '',
      total_race_time: snapshot.total_race_time || '',
      results: (snapshot.results || []).map((r) => ({
        date: r.date || '', race: r.race || '',
        distance_km: r.distance_km ?? '', time: r.time || '', position: r.position || '',
      })),
    });
    setEditing(true);
  };

  const setResult = (index, field, value) => {
    setForm((prev) => {
      const results = [...prev.results];
      results[index] = { ...results[index], [field]: value };
      return { ...prev, results };
    });
  };

  const handleSave = async () => {
    const url = form.itra_url.trim();
    if (url && !url.startsWith('https://itra.run/')) {
      toast.error('El enlace debe ser de itra.run (https://itra.run/...)');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        itra_url: url,
        itra_snapshot: {
          performance_index: num(form.performance_index),
          level: form.level.trim() || null,
          age_category: form.age_category.trim() || null,
          finished_races: num(form.finished_races),
          total_distance_km: num(form.total_distance_km),
          total_elevation_m: num(form.total_elevation_m),
          total_race_time: form.total_race_time.trim() || null,
          results: form.results
            .filter((r) => (r.race || '').trim())
            .map((r) => ({
              date: r.date || null,
              race: r.race.trim(),
              distance_km: num(r.distance_km),
              time: r.time.trim() || null,
              position: String(r.position || '').trim() || null,
            })),
        },
      };
      const res = await fetch(`${API_URL}/api/athletes/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('athlete_token')}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Experiencia ITRA guardada');
        setEditing(false);
        onSaved?.();
      } else {
        toast.error(data.detail || 'No se pudo guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const hasData = athlete?.itra_url || snapshot.performance_index != null || (snapshot.results || []).length > 0;

  return (
    <Card data-testid="itra-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-primary" /> Experiencia ITRA
          </CardTitle>
          <CardDescription className="mt-1">
            Copia aquí los datos de tu perfil en itra.run; los espectadores los verán en tu ficha durante la carrera.
          </CardDescription>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Edit className="w-4 h-4 mr-1.5" /> {hasData ? 'Editar' : 'Agregar'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        {!editing ? (
          !hasData ? (
            <p className="text-sm text-muted-foreground">
              Aún no has agregado tu experiencia. Busca tu perfil en{' '}
              <a href="https://itra.run" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                itra.run
              </a>{' '}
              y copia tus datos con «Agregar».
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {snapshot.performance_index != null && (
                  <div>
                    <span className="text-2xl font-bold text-primary">{snapshot.performance_index}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">Performance Index</span>
                  </div>
                )}
                {snapshot.level && <span className="text-sm font-semibold">{snapshot.level}</span>}
                {snapshot.age_category && <span className="text-sm text-muted-foreground">{snapshot.age_category}</span>}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                {snapshot.finished_races != null && <span>{snapshot.finished_races} carreras</span>}
                {snapshot.total_distance_km != null && <span>{Math.round(snapshot.total_distance_km).toLocaleString()} km</span>}
                {snapshot.total_elevation_m != null && <span>+{Math.round(snapshot.total_elevation_m).toLocaleString()} m</span>}
                {snapshot.total_race_time && <span>{snapshot.total_race_time} en carrera</span>}
              </div>
              {(snapshot.results || []).length > 0 && (
                <p className="text-xs text-muted-foreground">{snapshot.results.length} resultado(s) registrados</p>
              )}
              {athlete?.itra_url && (
                <a
                  href={athlete.itra_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                >
                  Ver perfil en ITRA <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Enlace a tu perfil ITRA</Label>
              <Input
                value={form.itra_url}
                onChange={(e) => setForm({ ...form, itra_url: e.target.value })}
                placeholder="https://itra.run/RunnerSpace/tu.nombre.123456"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Performance Index</Label>
                <Input type="number" value={form.performance_index}
                  onChange={(e) => setForm({ ...form, performance_index: e.target.value })} placeholder="430" />
              </div>
              <div className="space-y-2">
                <Label>Nivel</Label>
                <Input value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Intermediate 3" />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input value={form.age_category}
                  onChange={(e) => setForm({ ...form, age_category: e.target.value })} placeholder="M 45-49" />
              </div>
              <div className="space-y-2">
                <Label>Carreras terminadas</Label>
                <Input type="number" value={form.finished_races}
                  onChange={(e) => setForm({ ...form, finished_races: e.target.value })} placeholder="14" />
              </div>
              <div className="space-y-2">
                <Label>Km totales</Label>
                <Input type="number" value={form.total_distance_km}
                  onChange={(e) => setForm({ ...form, total_distance_km: e.target.value })} placeholder="1073" />
              </div>
              <div className="space-y-2">
                <Label>Desnivel total (m)</Label>
                <Input type="number" value={form.total_elevation_m}
                  onChange={(e) => setForm({ ...form, total_elevation_m: e.target.value })} placeholder="51020" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Tiempo total en carrera</Label>
                <Input value={form.total_race_time}
                  onChange={(e) => setForm({ ...form, total_race_time: e.target.value })} placeholder="187:39:05" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Resultados (los más recientes primero)</Label>
                <Button size="sm" variant="outline"
                  onClick={() => setForm({ ...form, results: [...form.results, { ...EMPTY_RESULT }] })}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                </Button>
              </div>
              {form.results.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin resultados. Agrega tus carreras más importantes.</p>
              )}
              <div className="space-y-2">
                {form.results.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-[110px_1fr_80px_90px_70px_36px] gap-2 items-center">
                    <Input type="date" value={r.date} onChange={(e) => setResult(i, 'date', e.target.value)} />
                    <Input value={r.race} onChange={(e) => setResult(i, 'race', e.target.value)} placeholder="Nombre de la carrera" />
                    <Input type="number" value={r.distance_km} onChange={(e) => setResult(i, 'distance_km', e.target.value)} placeholder="km" />
                    <Input value={r.time} onChange={(e) => setResult(i, 'time', e.target.value)} placeholder="41:43:04" />
                    <Input value={r.position} onChange={(e) => setResult(i, 'position', e.target.value)} placeholder="Pos." />
                    <Button size="sm" variant="ghost" className="text-destructive px-2"
                      onClick={() => setForm({ ...form, results: form.results.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
