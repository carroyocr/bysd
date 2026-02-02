import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ClipboardList, Users, Heart, Eye, RefreshCw, Star, ChevronDown, ChevronUp, Download } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Rating labels helper
const getRatingLabel = (rating) => {
  const labels = { 1: 'Malo', 2: 'Regular', 3: 'Bueno', 4: 'Muy bueno', 5: 'Excelente' };
  return labels[rating] || rating;
};

// Color for rating
const getRatingColor = (rating) => {
  if (rating >= 4.5) return 'text-green-600 bg-green-100';
  if (rating >= 3.5) return 'text-blue-600 bg-blue-100';
  if (rating >= 2.5) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
};

// Survey Response Card
const SurveyResponseCard = ({ response, type, isExpanded, onToggle }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-DO', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get rating fields based on survey type
  const getRatingFields = () => {
    if (type === 'athletes') {
      return [
        { key: 'satisfaccion_general', label: 'Satisfacción general' },
        { key: 'organizacion_evento', label: 'Organización' },
        { key: 'comunicacion_previa', label: 'Comunicación previa' },
        { key: 'proceso_registro', label: 'Proceso de registro' },
        { key: 'kit_corredor', label: 'Kit del corredor' },
        { key: 'marcacion_ruta', label: 'Marcación de ruta' },
        { key: 'seguridad_ruta', label: 'Seguridad en ruta' },
        { key: 'estaciones_hidratacion', label: 'Estaciones de hidratación' },
        { key: 'atencion_medica', label: 'Atención médica' },
        { key: 'instalaciones', label: 'Instalaciones' },
        { key: 'ambiente_comunidad', label: 'Ambiente y comunidad' }
      ];
    } else if (type === 'volunteers') {
      return [
        { key: 'satisfaccion_general', label: 'Satisfacción general' },
        { key: 'claridad_funciones', label: 'Claridad de funciones' },
        { key: 'capacitacion_recibida', label: 'Capacitación' },
        { key: 'comunicacion_coordinadores', label: 'Comunicación' },
        { key: 'materiales_recursos', label: 'Materiales/Recursos' },
        { key: 'trato_organizacion', label: 'Trato recibido' },
        { key: 'alimentacion_hidratacion', label: 'Alimentación' },
        { key: 'horarios_turnos', label: 'Horarios/Turnos' },
        { key: 'ambiente_equipo', label: 'Ambiente de equipo' },
        { key: 'reconocimiento', label: 'Reconocimiento' }
      ];
    } else {
      return [
        { key: 'satisfaccion_general', label: 'Satisfacción general' },
        { key: 'facilidad_acceso', label: 'Facilidad de acceso' },
        { key: 'informacion_evento', label: 'Información' },
        { key: 'visibilidad_recorrido', label: 'Visibilidad' },
        { key: 'servicios_disponibles', label: 'Servicios' },
        { key: 'ambiente_general', label: 'Ambiente general' },
        { key: 'atencion_personal', label: 'Atención personal' }
      ];
    }
  };

  const ratingFields = getRatingFields();
  const avgRating = ratingFields.reduce((sum, f) => sum + (response[f.key] || 0), 0) / ratingFields.length;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header - always visible */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRatingColor(avgRating)}`}>
            <span className="font-bold">{avgRating.toFixed(1)}</span>
          </div>
          <div>
            <p className="font-semibold">{response.nombre}</p>
            <p className="text-sm text-muted-foreground">{response.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {formatDate(response.created_at)}
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4 bg-muted/30">
          {/* Additional info */}
          {type === 'athletes' && response.bib && (
            <Badge variant="outline">Dorsal: {response.bib}</Badge>
          )}
          {type === 'volunteers' && response.area_voluntariado && (
            <Badge variant="outline">Área: {response.area_voluntariado}</Badge>
          )}
          {type === 'spectators' && response.relacion_evento && (
            <Badge variant="outline">Relación: {response.relacion_evento}</Badge>
          )}

          {/* Ratings grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ratingFields.map(({ key, label }) => (
              <div key={key} className="bg-background p-2 rounded border">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{response[key]}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
              </div>
            ))}
          </div>

          {/* Text responses */}
          {response.lo_mejor && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">Lo mejor del evento:</p>
              <p className="text-sm text-green-900">{response.lo_mejor}</p>
            </div>
          )}
          
          {response.areas_mejora && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Áreas de mejora:</p>
              <p className="text-sm text-amber-900">{response.areas_mejora}</p>
            </div>
          )}

          {response.comentarios_adicionales && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">Comentarios adicionales:</p>
              <p className="text-sm text-blue-900">{response.comentarios_adicionales}</p>
            </div>
          )}

          {/* Yes/No answers */}
          <div className="flex flex-wrap gap-2">
            {type === 'athletes' && (
              <>
                <Badge variant={response.participaria_nuevamente === 'Sí' ? 'default' : 'secondary'}>
                  Participaría de nuevo: {response.participaria_nuevamente}
                </Badge>
                <Badge variant={response.recomendaria === 'Sí' ? 'default' : 'secondary'}>
                  Recomendaría: {response.recomendaria}
                </Badge>
              </>
            )}
            {type === 'volunteers' && (
              <>
                <Badge variant={response.voluntario_nuevamente === 'Sí' ? 'default' : 'secondary'}>
                  Sería voluntario de nuevo: {response.voluntario_nuevamente}
                </Badge>
                <Badge variant={response.recomendaria === 'Sí' ? 'default' : 'secondary'}>
                  Recomendaría: {response.recomendaria}
                </Badge>
              </>
            )}
            {type === 'spectators' && (
              <>
                <Badge variant={response.asistiria_nuevamente === 'Sí' ? 'default' : 'secondary'}>
                  Asistiría de nuevo: {response.asistiria_nuevamente}
                </Badge>
                <Badge variant={response.recomendaria === 'Sí' ? 'default' : 'secondary'}>
                  Recomendaría: {response.recomendaria}
                </Badge>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Stats Summary Component
const StatsSummary = ({ responses, type }) => {
  if (!responses || responses.length === 0) return null;

  const getRatingFields = () => {
    if (type === 'athletes') {
      return ['satisfaccion_general', 'organizacion_evento', 'kit_corredor', 'seguridad_ruta', 'ambiente_comunidad'];
    } else if (type === 'volunteers') {
      return ['satisfaccion_general', 'claridad_funciones', 'trato_organizacion', 'ambiente_equipo'];
    } else {
      return ['satisfaccion_general', 'facilidad_acceso', 'ambiente_general'];
    }
  };

  const keyFields = getRatingFields();
  const averages = keyFields.map(field => {
    const sum = responses.reduce((acc, r) => acc + (r[field] || 0), 0);
    return { field, avg: (sum / responses.length).toFixed(1) };
  });

  const overallAvg = (averages.reduce((acc, a) => acc + parseFloat(a.avg), 0) / averages.length).toFixed(1);

  const wouldReturn = responses.filter(r => 
    r.participaria_nuevamente === 'Sí' || 
    r.voluntario_nuevamente === 'Sí' || 
    r.asistiria_nuevamente === 'Sí'
  ).length;

  const wouldRecommend = responses.filter(r => r.recomendaria === 'Sí').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className={`p-4 rounded-lg ${getRatingColor(overallAvg)}`}>
        <p className="text-xs font-medium opacity-80">Promedio General</p>
        <p className="text-3xl font-bold">{overallAvg}</p>
        <p className="text-xs opacity-80">de 5.0</p>
      </div>
      <div className="p-4 rounded-lg bg-blue-100 text-blue-800">
        <p className="text-xs font-medium opacity-80">Total Respuestas</p>
        <p className="text-3xl font-bold">{responses.length}</p>
      </div>
      <div className="p-4 rounded-lg bg-green-100 text-green-800">
        <p className="text-xs font-medium opacity-80">Volvería</p>
        <p className="text-3xl font-bold">{Math.round((wouldReturn / responses.length) * 100)}%</p>
        <p className="text-xs opacity-80">{wouldReturn} de {responses.length}</p>
      </div>
      <div className="p-4 rounded-lg bg-purple-100 text-purple-800">
        <p className="text-xs font-medium opacity-80">Recomendaría</p>
        <p className="text-3xl font-bold">{Math.round((wouldRecommend / responses.length) * 100)}%</p>
        <p className="text-xs opacity-80">{wouldRecommend} de {responses.length}</p>
      </div>
    </div>
  );
};

export default function SurveyResultsSection() {
  const [stats, setStats] = useState({ athletes: 0, volunteers: 0, spectators: 0, total: 0 });
  const [athletesResponses, setAthletesResponses] = useState([]);
  const [volunteersResponses, setVolunteersResponses] = useState([]);
  const [spectatorsResponses, setSpectatorsResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [activeTab, setActiveTab] = useState('athletes');

  const fetchSurveyData = async () => {
    setLoading(true);
    try {
      const [statsRes, athletesRes, volunteersRes, spectatorsRes] = await Promise.all([
        fetch(`${API_URL}/api/surveys/stats`),
        fetch(`${API_URL}/api/surveys/athletes/responses`),
        fetch(`${API_URL}/api/surveys/volunteers/responses`),
        fetch(`${API_URL}/api/surveys/spectators/responses`)
      ]);

      const statsData = await statsRes.json();
      const athletesData = await athletesRes.json();
      const volunteersData = await volunteersRes.json();
      const spectatorsData = await spectatorsRes.json();

      setStats(statsData);
      setAthletesResponses(athletesData.responses || []);
      setVolunteersResponses(volunteersData.responses || []);
      setSpectatorsResponses(spectatorsData.responses || []);
    } catch (error) {
      console.error('Error fetching survey data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const exportToCSV = (responses, filename) => {
    if (responses.length === 0) return;
    
    const headers = Object.keys(responses[0]);
    const csvContent = [
      headers.join(','),
      ...responses.map(r => headers.map(h => `"${r[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Resultados de Encuestas</h2>
          <p className="text-muted-foreground">Feedback de atletas, voluntarios y espectadores</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSurveyData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-primary" />
            <CardTitle>Resumen</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSurveyData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats.athletes}</p>
              <p className="text-sm text-blue-600">Atletas</p>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <p className="text-3xl font-bold text-pink-600">{stats.volunteers}</p>
              <p className="text-sm text-pink-600">Voluntarios</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">{stats.spectators}</p>
              <p className="text-sm text-purple-600">Espectadores</p>
            </div>
          </div>

          {/* Tabs for each survey type */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="athletes" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Atletas ({stats.athletes})
              </TabsTrigger>
              <TabsTrigger value="volunteers" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Voluntarios ({stats.volunteers})
              </TabsTrigger>
              <TabsTrigger value="spectators" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Espectadores ({stats.spectators})
              </TabsTrigger>
            </TabsList>

            {/* Athletes Tab */}
            <TabsContent value="athletes">
              {athletesResponses.length > 0 ? (
                <>
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportToCSV(athletesResponses, 'encuestas_atletas')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                  <StatsSummary responses={athletesResponses} type="athletes" />
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {athletesResponses.map((response, idx) => (
                      <SurveyResponseCard 
                        key={idx}
                        response={response}
                        type="athletes"
                        isExpanded={expandedCard === `athletes-${idx}`}
                        onToggle={() => setExpandedCard(
                          expandedCard === `athletes-${idx}` ? null : `athletes-${idx}`
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay respuestas de atletas aún</p>
                </div>
              )}
            </TabsContent>

            {/* Volunteers Tab */}
            <TabsContent value="volunteers">
              {volunteersResponses.length > 0 ? (
                <>
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportToCSV(volunteersResponses, 'encuestas_voluntarios')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                  <StatsSummary responses={volunteersResponses} type="volunteers" />
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {volunteersResponses.map((response, idx) => (
                      <SurveyResponseCard 
                        key={idx}
                        response={response}
                        type="volunteers"
                        isExpanded={expandedCard === `volunteers-${idx}`}
                        onToggle={() => setExpandedCard(
                          expandedCard === `volunteers-${idx}` ? null : `volunteers-${idx}`
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay respuestas de voluntarios aún</p>
                </div>
              )}
            </TabsContent>

            {/* Spectators Tab */}
            <TabsContent value="spectators">
              {spectatorsResponses.length > 0 ? (
                <>
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportToCSV(spectatorsResponses, 'encuestas_espectadores')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                  <StatsSummary responses={spectatorsResponses} type="spectators" />
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {spectatorsResponses.map((response, idx) => (
                      <SurveyResponseCard 
                        key={idx}
                        response={response}
                        type="spectators"
                        isExpanded={expandedCard === `spectators-${idx}`}
                        onToggle={() => setExpandedCard(
                          expandedCard === `spectators-${idx}` ? null : `spectators-${idx}`
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay respuestas de espectadores aún</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
