import React, { useState, useEffect } from 'react';
import { Backpack, Clock, Lightbulb, Shield, AlertTriangle, CheckCircle2, Download, MapIcon, BookOpen, Loader2, Users, UserRound, Hash } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import PDFFlipViewer from './PDFFlipViewer';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RunnersSection() {
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const { config, getFormattedDate, getYear } = useRaceConfig();
  const [manualUrl, setManualUrl] = useState(null);
  const [loadingManual, setLoadingManual] = useState(true);
  const [participantsData, setParticipantsData] = useState(null);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Load registered participants for active race
  useEffect(() => {
    const loadParticipants = async () => {
      if (!config?.code) {
        setLoadingParticipants(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/registration/public/participants/${config.code}`);
        if (response.ok) {
          setParticipantsData(await response.json());
        }
      } catch (error) {
        console.error('Error loading participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    };
    loadParticipants();
  }, [config?.code]);

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
          setManualUrl(data.runners_manual);
        }
      } catch (error) {
        console.error('Error loading manual:', error);
      } finally {
        setLoadingManual(false);
      }
    };
    
    loadManual();
  }, [config?.code]);
  
  const mandatoryEquipment = [
    'Linterna frontal con batería suficiente para al menos 8 horas',
    'Luz trasera roja visible y fija',
    'Contenedor de hidratación personal (botella o soft flask)',
    'Calzado apropiado para suelo blando y grava',
    'Identificación personal (documento guardado en carpa)',
  ];

  const recommendedEquipment = [
    { category: 'Para Correr', items: ['2-3 pares de zapatos para alternar', 'Calcetines extra (cada 4-6 horas)', 'Ropa seca para cambios frecuentes'] },
    { category: 'Para Acampar', items: ['Silla plegable', 'Lona o carpa liviana', 'Nevera pequeña para alimentos', 'Mesa pequeña', 'Power bank'] },
    { category: 'Para la Noche', items: ['Baterías extra o segunda linterna', 'Ropa térmica ligera', 'Manta o chaqueta', 'Toalla pequeña'] },
    { category: 'Cuidado Personal', items: ['Crema anti-rozaduras', 'Protector solar', 'Botiquín básico', 'Repelente de mosquitos'] },
  ];

  const schedule = [
    { time: '06:00 - 08:30', event: 'Apertura Acceso al Área', detail: 'Llegada de atletas. Montaje de carpas y zona personal' },
    { time: '06:00 - 08:30', event: 'Check-in de la Carrera Abierto', detail: 'Registro de participantes' },
    { time: '08:30', event: 'Apertura del Corral de Salida', detail: 'Los corredores pueden ingresar al corral' },
    { time: '08:57', event: 'Primera Señal (un pitido)', detail: '3 minutos para el inicio' },
    { time: '08:58', event: 'Segunda Señal (dos pitidos)', detail: '2 minutos para el inicio' },
    { time: '08:59', event: 'Tercera Señal (tres pitidos)', detail: '1 minuto para el inicio' },
    { time: '09:00', event: 'Inicio Oficial - Vuelta #1', detail: 'Comienza la primera vuelta' },
  ];

  const keyRules = [
    { icon: <Clock className="w-5 h-5" />, title: 'Tiempo Límite', text: 'Cada vuelta debe completarse en 60 minutos o menos' },
    { icon: <AlertTriangle className="w-5 h-5" />, title: 'Eliminación', text: 'Los corredores que no regresen antes de que el tiempo llegue a cero son eliminados' },
    { icon: <CheckCircle2 className="w-5 h-5" />, title: 'Presencia en Corral', text: 'Deben estar dentro del corral al inicio de cada vuelta' },
    { icon: <Shield className="w-5 h-5" />, title: 'Sin Ayuda Externa', text: 'No se permite compañía, bicicletas, mascotas o ayuda en el circuito' },
  ];

  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Sección Corredores
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Todo lo que necesitas saber para prepararte para el desafío
            </p>
          </div>

          {/* Inscritos para el evento */}
          <div className="space-y-6" data-testid="inscritos-section">
            <div className="text-center space-y-2">
              <h3 className="font-display text-3xl text-foreground">
                Inscritos {getYear()}
              </h3>
              <p className="text-muted-foreground">
                Atletas que ya aseguraron su lugar en la carrera
              </p>
            </div>

            {loadingParticipants ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border shadow-soft" data-testid="stat-total">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground leading-none">{participantsData?.total ?? 0}</p>
                        <p className="text-sm text-muted-foreground mt-1">Total inscritos</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border shadow-soft" data-testid="stat-hombres">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <UserRound className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground leading-none">{participantsData?.masculino ?? 0}</p>
                        <p className="text-sm text-muted-foreground mt-1">Hombres</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border shadow-soft" data-testid="stat-mujeres">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                        <UserRound className="w-6 h-6 text-pink-500" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground leading-none">{participantsData?.femenino ?? 0}</p>
                        <p className="text-sm text-muted-foreground mt-1">Mujeres</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border shadow-soft" data-testid="stat-plazas">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground leading-none">{participantsData?.plazas_disponibles ?? 0}</p>
                        <p className="text-sm text-muted-foreground mt-1">Plazas disponibles</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Participant List */}
                <Card className="border-border shadow-soft">
                  <CardContent className="p-6">
                    {participantsData?.participants?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                        {participantsData.participants.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0"
                            data-testid={`participant-row-${p.bib}`}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-1 min-w-[3rem] justify-center">
                              <Hash className="w-3 h-3" />
                              {p.bib}
                            </span>
                            <span className="text-sm text-foreground truncate">
                              {p.nombre} {p.apellidos}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p>Aún no hay atletas inscritos. ¡Sé el primero!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Lista de Espera (solo si hay atletas en espera) */}
          {!loadingParticipants && participantsData?.waitlist?.length > 0 && (
            <div className="space-y-6" data-testid="waitlist-section">
              <div className="text-center space-y-2">
                <h3 className="font-display text-3xl text-foreground">
                  Atletas en Lista de Espera
                </h3>
                <p className="text-muted-foreground">
                  Estos atletas serán contactados por orden si se libera un cupo
                </p>
              </div>

              <Card className="border-amber-200 bg-amber-50/40 shadow-soft">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                    {participantsData.waitlist.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 py-2 border-b border-amber-200/60 last:border-0"
                        data-testid={`waitlist-row-${p.bib}`}
                      >
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-500/15 rounded-md px-2 py-1 min-w-[3rem] justify-center">
                          <Hash className="w-3 h-3" />
                          {p.bib}
                        </span>
                        <span className="text-sm text-foreground truncate">
                          {p.nombre} {p.apellidos}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Download Manual */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-7 h-7 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-2xl text-foreground">Guía del Corredor</h3>
                    <p className="text-muted-foreground">
                      {manualUrl 
                        ? 'Consulta la guía completa con toda la información necesaria para participar en el evento'
                        : 'La guía del corredor estará disponible próximamente'}
                    </p>
                  </div>
                </div>
                {loadingManual ? (
                  <Button size="lg" disabled>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Cargando...
                  </Button>
                ) : manualUrl ? (
                  <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                    <Button 
                      size="lg" 
                      onClick={() => setIsPdfViewerOpen(true)}
                      className="bg-primary hover:bg-accent text-primary-foreground shadow-medium hover:shadow-strong transition-all duration-300"
                    >
                      <BookOpen className="w-5 h-5 mr-2" />
                      Ver Guía
                    </Button>
                    <a
                      href={`${API_URL}${manualUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full sm:w-auto border-primary/30 hover:bg-primary/10"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Descargar
                      </Button>
                    </a>
                  </div>
                ) : (
                  <Button size="lg" variant="outline" disabled className="text-muted-foreground">
                    <Clock className="w-5 h-5 mr-2" />
                    Próximamente
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PDF Viewer Modal */}
          {manualUrl && (
            <PDFFlipViewer
              isOpen={isPdfViewerOpen}
              onClose={() => setIsPdfViewerOpen(false)}
              pdfUrl={`${API_URL}${manualUrl}`}
            />
          )}

          {/* Route Map Image */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium overflow-hidden">
            <CardContent className="p-0">
              <img
                src="/circuito-backyard-ultra.png"
                alt="Mapa del Circuito Backyard Ultra Santo Domingo - Ruta de la Carrera"
                className="w-full h-auto object-cover"
              />
            </CardContent>
          </Card>

          {/* Download Route GPX */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapIcon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-2xl text-foreground">Descarga la Ruta del Evento</h3>
                    <p className="text-muted-foreground">
                      Obtén el archivo GPX del circuito de 6.7 km para cargar en tu dispositivo GPS o aplicación de running
                    </p>
                  </div>
                </div>
                <a
                  href="/ruta-backyard-ultra.gpx"
                  download="Backyard-Ultra-Santo-Domingo-Ruta.gpx"
                  className="flex-shrink-0"
                >
                  <Button size="lg" className="bg-primary hover:bg-accent text-primary-foreground shadow-medium hover:shadow-strong transition-all duration-300">
                    <Download className="w-5 h-5 mr-2" />
                    Descargar Ruta GPX
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Key Rules Highlights */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {keyRules.map((rule, index) => (
              <Card key={index} className="bg-card border-border shadow-soft">
                <CardContent className="p-6 space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {rule.icon}
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{rule.title}</h4>
                  <p className="text-sm text-muted-foreground leading-snug">{rule.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="equipment" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-3 bg-muted/50 p-1">
              <TabsTrigger value="equipment" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Backpack className="w-4 h-4 mr-2" />
                Equipo
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Clock className="w-4 h-4 mr-2" />
                Horario
              </TabsTrigger>
              <TabsTrigger value="safety" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Shield className="w-4 h-4 mr-2" />
                Seguridad
              </TabsTrigger>
            </TabsList>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-6 mt-6">
              <Card className="border-primary/20 shadow-medium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <AlertTriangle className="w-6 h-6 text-primary" />
                    Equipo Obligatorio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {mandatoryEquipment.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Lightbulb className="w-6 h-6 text-primary" />
                    Equipo Recomendado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {recommendedEquipment.map((section, index) => (
                      <div key={index} className="space-y-3">
                        <h4 className="font-bold text-primary">{section.category}</h4>
                        <ul className="space-y-2">
                          {section.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6 mt-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-2xl">Cronograma del Día del Evento</CardTitle>
                  <p className="text-sm text-muted-foreground">{getFormattedDate()}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {schedule.map((item, index) => (
                      <div key={index} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        <div className="flex-shrink-0">
                          <Badge variant="outline" className="font-accent text-base px-3 py-1">
                            {item.time}
                          </Badge>
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="font-bold text-foreground">{item.event}</h4>
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Importante:</strong> Después de la primera vuelta, cada nueva
                    vuelta comienza exactamente al inicio de cada hora. Los corredores tienen el tiempo restante
                    para descansar, hidratarse y alimentarse.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Safety Tab */}
            <TabsContent value="safety" className="space-y-6 mt-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Shield className="w-6 h-6 text-primary" />
                    Información de Seguridad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="medical">
                      <AccordionTrigger className="text-left">
                        <span className="font-bold">Asistencia Médica</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 text-muted-foreground">
                        <p>
                          Personal médico estará presente las 24 horas del día, incluyendo paramédicos certificados
                          y una ambulancia de apoyo básico.
                        </p>
                        <p className="font-semibold text-foreground">
                          Contacto directo para el equipo médico (solo emergencias): [Número oficial a incluir]
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="emergency">
                      <AccordionTrigger className="text-left">
                        <span className="font-bold">Protocolo de Emergencia</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 text-muted-foreground">
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            En caso de incidente, lesión o situación que impida continuar, dirígete
                            inmediatamente a la línea de meta donde se encuentra el equipo médico
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            Si un atleta en el circuito no puede moverse por su cuenta, debe notificar al
                            corredor más cercano, quien informará al personal al llegar a la meta
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            Solo personal autorizado puede ingresar al circuito para asistir a atletas
                          </li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="night">
                      <AccordionTrigger className="text-left">
                        <span className="font-bold">Procedimientos Nocturnos</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 text-muted-foreground">
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            Linterna frontal y luz trasera roja son obligatorias desde el atardecer
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            Se recomienda baterías de repuesto suficientes para más de 8 horas
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                            La ruta estará supervisada, pero los atletas son responsables de mantener
                            visibilidad adecuada
                          </li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="withdrawal">
                      <AccordionTrigger className="text-left">
                        <span className="font-bold">Retiro Voluntario</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 text-muted-foreground">
                        <p>
                          Los atletas que decidan retirarse deben notificar al personal en la línea de meta.
                          No se permite el reingreso después del retiro. Los corredores no pueden permanecer
                          en el corral o área de salida durante vueltas posteriores para evitar interferencias.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground">Control de Esfuerzo</h4>
                      <p className="text-sm text-muted-foreground">
                        Los corredores deben mantener control total de su esfuerzo y detenerse si experimentan
                        síntomas de descompensación. Correr con dolor intenso, mareos, juicio alterado o
                        agotamiento extremo puede llevar al retiro forzoso.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Additional Important Info */}
          <Card className="bg-gradient-to-br from-secondary/30 to-muted/30 border-border shadow-medium">
            <CardContent className="p-8 space-y-4">
              <h3 className="font-display text-2xl text-foreground">Información Adicional Importante</h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground">Hidratación y Alimentación</h4>
                  <p>
                    Hidratación oficial exclusivamente en la línea de salida/meta. Agua y bebidas isotónicas
                    disponibles. No hay otros puntos de hidratación en el circuito.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground">Política de Residuos</h4>
                  <p>
                    Política "Leave No Trace" estrictamente aplicada. Cada atleta es responsable de su basura.
                    No se permite basura en carpas ni en el circuito. El incumplimiento es motivo de descalificación.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground">Estacionamiento y Camping</h4>
                  <p>
                    Estacionamiento seguro y gratuito disponible en la propiedad. Zona de camping disponible.
                    Cada atleta tiene asignado un espacio de 4m x 4m para carpas personales.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}