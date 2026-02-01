import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, AlertCircle, Phone, Shirt, Download, Heart, UserPlus, Edit2, Mail, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VolunteersSection() {
  const { config } = useRaceConfig();
  
  // State for edit link modal
  const [showEditLinkModal, setShowEditLinkModal] = useState(false);
  const [editLinkEmail, setEditLinkEmail] = useState('');
  const [sendingEditLink, setSendingEditLink] = useState(false);
  const [manualUrl, setManualUrl] = useState(null);
  const [loadingManual, setLoadingManual] = useState(true);

  // Load manual URL for active race
  useEffect(() => {
    const loadManual = async () => {
      if (!config?.code) {
        setLoadingManual(false);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/race-config/manuals/${config.code}`);
        if (response.ok) {
          const data = await response.json();
          setManualUrl(data.volunteers_manual);
        }
      } catch (error) {
        console.error('Error loading manual:', error);
      } finally {
        setLoadingManual(false);
      }
    };
    
    loadManual();
  }, [config?.code]);

  // Handle request edit link
  const handleRequestEditLink = async () => {
    if (!editLinkEmail.trim() || !editLinkEmail.includes('@')) {
      toast.error('Por favor ingresa un email válido');
      return;
    }
    
    setSendingEditLink(true);
    
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/request-edit-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editLinkEmail.trim().toLowerCase() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('¡Link de edición enviado a tu correo!');
        setShowEditLinkModal(false);
        setEditLinkEmail('');
      } else {
        toast.error(data.detail || 'Error al enviar el link');
      }
    } catch (error) {
      console.error('Error requesting edit link:', error);
      toast.error('Error de conexión. Intenta de nuevo.');
    } finally {
      setSendingEditLink(false);
    }
  };

  const volunteerRoles = [
    {
      title: 'Staff de Registro y Check-in',
      description: 'Manejo de check-in de corredores, responder preguntas sobre el evento',
      requirements: ['Excelente comunicación verbal', 'Rapidez en procesamiento de información', 'Actitud amigable y paciente'],
    },
    {
      title: 'Control de Corral de Salida y Animación',
      description: 'Energizar corredores antes del inicio, controlar acceso al corral, señalizar conteos regresivos',
      requirements: ['Firmeza y autoridad respetuosa', 'Capacidad de seguir horarios exactos', 'Buena comunicación'],
    },
    {
      title: 'Punto de Hidratación y Snacks',
      description: 'Reponer agua y electrolitos, mantener orden, monitorear atletas por signos de agotamiento',
      requirements: ['Agilidad en reposición', 'Atención a atletas con señales de agotamiento', 'Buena higiene'],
    },
    {
      title: 'Control de Vueltas',
      description: 'Crear lista de atletas que iniciaron cada vuelta, confirmar retiros, actualizar marcador',
      requirements: ['Precisión absoluta en datos', 'Concentración por largos períodos', 'Alto sentido de responsabilidad'],
      critical: true,
    },
    {
      title: 'Área de Carpas / Zona de Atletas',
      description: 'Asegurar que cada carpa esté en su espacio, mantener pasillos despejados, manejar preguntas',
      requirements: ['Buena comunicación', 'Capacidad de organización espacial', 'Actitud calmada'],
    },
    {
      title: 'Orden y Limpieza',
      description: 'Recoger basura visible, reponer bolsas, verificar baños estén usables',
      requirements: ['Energía física ligera', 'Sentido de orden', 'Compromiso con cuidado ambiental'],
    },
    {
      title: 'Equipo Médico y Apoyo de Seguridad',
      description: 'Guiar personal médico a atletas con problemas, notificar al comité organizador',
      requirements: ['Comunicación rápida y efectiva', 'Calma en situaciones médicas', 'Respeto por protocolos'],
    },
    {
      title: 'Marcación de Ruta',
      description: 'Marcar la ruta el viernes, colocar banderas y señalización, inspeccionar la ruta',
      requirements: ['Capacidad de caminar largos tramos', 'Atención visual', 'Trabajo en equipo'],
    },
    {
      title: 'Decoración, Montaje y Ambientación',
      description: 'Dirigir montaje de arcos, carpas, zonas; colocar banners y señalización estética',
      requirements: ['Excelente organización espacial', 'Sentido estético', 'Disponibilidad el viernes'],
    },
  ];

  const importantRules = [
    'Puntualidad en todos los turnos',
    'Portar identificación del evento',
    'Hidratación y alimentación personal',
    'Mantener comunicación con coordinadores',
    'Respetar tiempos de descanso',
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Sección Voluntarios
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Únete a nuestro equipo y sé parte fundamental de esta experiencia única
            </p>
          </div>

          {/* Volunteer Registration CTA */}
          <Card className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-300/30 shadow-medium">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-7 h-7 text-pink-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-2xl text-foreground">¡Únete al Equipo!</h3>
                  <p className="text-muted-foreground">
                    ¿Quieres ser parte de esta experiencia única? Regístrate como voluntario y ayuda a hacer realidad este evento.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <Link to="/voluntarios/registro">
                  <Button size="lg" className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-medium hover:shadow-strong transition-all duration-300 w-full sm:w-auto">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Postular como Voluntario
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => setShowEditLinkModal(true)}
                  className="border-pink-300 text-pink-700 hover:bg-pink-50 w-full sm:w-auto"
                  data-testid="edit-volunteer-btn"
                >
                  <Edit2 className="w-5 h-5 mr-2" />
                  Editar mi Postulación
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Download */}
        <Card className="mb-8 border-border shadow-soft">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-foreground">Manual de Voluntarios</h3>
                <p className="text-muted-foreground text-sm">
                  {manualUrl 
                    ? 'Guía completa para el equipo de voluntarios del evento'
                    : 'El manual estará disponible próximamente'}
                </p>
              </div>
              {loadingManual ? (
                <Button variant="outline" disabled>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cargando...
                </Button>
              ) : manualUrl ? (
                <a href={`${API_URL}${manualUrl}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Manual
                  </Button>
                </a>
              ) : (
                <Button variant="outline" disabled className="text-muted-foreground">
                  <Clock className="w-4 h-4 mr-2" />
                  Próximamente
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
            <TabsTrigger value="roles" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
              <Shirt className="w-4 h-4 mr-2" />
              Reglas
            </TabsTrigger>
            <TabsTrigger value="emergency" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
              <Phone className="w-4 h-4 mr-2" />
              Emergencias
            </TabsTrigger>
          </TabsList>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-6 mt-6">
            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle className="text-2xl">Roles y Responsabilidades</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Los voluntarios son cruciales para logística, seguridad, hidratación, control de vueltas y orden general
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {volunteerRoles.map((role, index) => (
                    <Card
                      key={index}
                      className={`${
                        role.critical
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-card'
                      } shadow-soft hover-lift`}
                    >
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-bold text-foreground">{role.title}</h4>
                          {role.critical && (
                            <Badge variant="destructive" className="text-xs">
                              Crítico
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Requisitos:</p>
                          <div className="flex flex-wrap gap-2">
                            {role.requirements.map((req, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {req}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-6 mt-6">
            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle className="text-2xl">Reglas Importantes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Lineamientos que todo voluntario debe seguir
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {importantRules.map((rule, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      <p className="text-foreground">{rule}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">Código de Vestimenta</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Se proporcionará camiseta oficial del evento. Usar calzado cómodo y cerrado. 
                        Protección solar recomendada.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emergency Tab */}
          <TabsContent value="emergency" className="space-y-6 mt-6">
            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle className="text-2xl">Protocolos de Emergencia</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Información crítica para situaciones de emergencia
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="p-4">
                      <h4 className="font-bold text-red-800 dark:text-red-200 mb-2">Emergencia Médica</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        1. Mantén la calma<br />
                        2. Notifica al coordinador más cercano<br />
                        3. No muevas al afectado<br />
                        4. Despeja el área
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="p-4">
                      <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">Contactos de Emergencia</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Director del Evento: Por confirmar<br />
                        Coordinador Médico: Por confirmar<br />
                        Emergencias: 911
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Punto de Encuentro</h4>
                  <p className="text-sm text-muted-foreground">
                    En caso de evacuación, el punto de encuentro será comunicado durante la reunión 
                    previa al evento. Mantente siempre atento a las instrucciones del staff.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Link Modal */}
      {showEditLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-pink-600" />
                Editar mi Postulación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa el correo electrónico con el que te registraste como voluntario. 
                Te enviaremos un link para editar tu postulación.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={editLinkEmail}
                    onChange={(e) => setEditLinkEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="pl-10"
                    data-testid="edit-link-email-input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowEditLinkModal(false);
                    setEditLinkEmail('');
                  }}
                  disabled={sendingEditLink}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white"
                  onClick={handleRequestEditLink}
                  disabled={!editLinkEmail.trim() || sendingEditLink}
                  data-testid="send-edit-link-btn"
                >
                  {sendingEditLink ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Link de Edición'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </section>
  );
}
