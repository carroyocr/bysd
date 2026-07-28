import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Plus, Edit, Trash2, Save, X, Upload, Instagram, 
  Building2, GripVertical, ExternalLink, Image
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SponsorsManagement() {
  const { raceCode, raceName } = useRaceConfig();
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instagram: ''
  });

  const loadSponsors = useCallback(async () => {
    if (!raceCode) return;
    
    setLoading(true);
    try {
      const response = await adminFetch(`${API_URL}/api/sponsors/admin/race/${raceCode}`);
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
  }, [raceCode]);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  const resetForm = () => {
    setFormData({ name: '', description: '', instagram: '' });
    setShowAddForm(false);
    setEditingSponsor(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error('Nombre y descripción son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      if (editingSponsor) {
        // Update existing sponsor
        const response = await adminFetch(
          `${API_URL}/api/sponsors/update/${encodeURIComponent(editingSponsor)}?race_code=${raceCode}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              instagram: formData.instagram || null
            })
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
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            instagram: formData.instagram || null,
            race_code: raceCode
          })
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
      instagram: sponsor.instagram || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (sponsorName) => {
    if (!window.confirm(`¿Eliminar permanentemente el patrocinador "${sponsorName}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      const response = await adminFetch(
        `${API_URL}/api/sponsors/hard-delete/${encodeURIComponent(sponsorName)}?race_code=${raceCode}`,
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
        `${API_URL}/api/sponsors/upload-logo/${encodeURIComponent(sponsorName)}?race_code=${raceCode}`,
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
          <p className="text-muted-foreground">Gestiona los patrocinadores del evento • {sponsors.length} registrados</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddForm(true); }} data-testid="add-sponsor-btn">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Patrocinador
        </Button>
      </div>

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

      {/* Sponsors List */}
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
          sponsors.map((sponsor, index) => (
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
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {sponsor.name}
                          {!sponsor.is_active && (
                            <Badge variant="outline" className="text-xs">Inactivo</Badge>
                          )}
                        </h3>
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
                      <div className="flex gap-1">
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info for legacy races */}
      {raceCode === 'BYSD-2026' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800">
              <strong>Nota:</strong> Los patrocinadores de BYSD-2026 están configurados de forma estática 
              y no se pueden modificar desde este panel. Esta funcionalidad está disponible para nuevas carreras.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
