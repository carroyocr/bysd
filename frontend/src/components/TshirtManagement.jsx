import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Shirt, Upload, Trash2, Loader2, User, Vote, ImageIcon, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TshirtManagement() {
  const [designs, setDesigns] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [name, setName] = useState('');
  const [proposedBy, setProposedBy] = useState('');
  const [file, setFile] = useState(null);

  const token = localStorage.getItem('admin_token');

  const loadDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tshirt/designs`);
      const data = await res.json();
      setDesigns(data.designs || []);
      setTotalVotes(data.total_votes || 0);
    } catch {
      toast.error('Error al cargar diseños');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDesigns(); }, [loadDesigns]);

  const handleUpload = async () => {
    if (!file) { toast.error('Selecciona una imagen'); return; }
    if (!proposedBy.trim()) { toast.error('Indica quién la postuló'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('proposed_by', proposedBy.trim());
      fd.append('name', name.trim());
      const res = await fetch(`${API_URL}/api/tshirt/admin/designs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        toast.success('Diseño publicado');
        setName(''); setProposedBy(''); setFile(null);
        document.getElementById('tshirt-file-input').value = '';
        loadDesigns();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.detail || 'Error al subir');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este diseño y todos sus votos?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/tshirt/admin/designs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success('Diseño eliminado'); loadDesigns(); }
      else { toast.error('Error al eliminar'); }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('¿Reiniciar TODA la votación? Se eliminarán todos los votos (los diseños se conservan). Esta acción no se puede deshacer.')) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_URL}/api/tshirt/admin/reset-votes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        toast.success(`Votación reiniciada (${d.deleted} votos eliminados)`);
        loadDesigns();
      } else {
        toast.error('Error al reiniciar la votación');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="tshirt-management">
      {/* Upload form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#E8772E]" />
            Publicar nueva propuesta de camiseta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del diseño (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Diseño Lagarto" data-testid="tshirt-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Postulada por *</Label>
              <Input value={proposedBy} onChange={(e) => setProposedBy(e.target.value)} placeholder="Nombre de quien la propuso" data-testid="tshirt-proposedby-input" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Imagen *</Label>
            <Input id="tshirt-file-input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} data-testid="tshirt-file-input" />
            <p className="text-xs text-muted-foreground">Formatos de imagen. Máximo 8MB.</p>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="tshirt-upload-btn">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Publicar diseño
          </Button>
        </CardContent>
      </Card>

      {/* Designs list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Shirt className="w-4 h-4 text-[#E8772E]" />
              Diseños publicados
              <span className="text-xs font-normal text-muted-foreground ml-1">({designs.length}) · {totalVotes} votos totales</span>
            </CardTitle>
            <Button
              size="sm" variant="outline"
              onClick={handleReset}
              disabled={resetting || totalVotes === 0}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              data-testid="reset-votes-btn"
            >
              {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reiniciar votación
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" /></div>
          ) : designs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Aún no hay diseños. Sube el primero arriba.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {designs.map((d) => (
                <div key={d.id} className="border rounded-lg overflow-hidden" data-testid={`admin-design-${d.id}`}>
                  <div className="bg-neutral-900 aspect-square flex items-center justify-center p-2">
                    <img src={`${API_URL}${d.image_url}`} alt={d.name} className="max-h-full w-auto object-contain" />
                  </div>
                  <div className="p-3 space-y-1">
                    {d.name && <p className="font-medium text-sm truncate">{d.name}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />{d.proposed_by}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-primary flex items-center gap-1"><Vote className="w-3 h-3" />{d.vote_count} votos</span>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)} disabled={deletingId === d.id} className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50" data-testid={`delete-design-${d.id}`}>
                        {deletingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
