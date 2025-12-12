import React from 'react';
import { Ban, CheckCircle2, XCircle, AlertTriangle, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export default function Rules() {
  const formatRules = [
    { text: 'Circuito de 6.706 km (4.167 millas) por vuelta', icon: <CheckCircle2 className="w-5 h-5 text-primary" /> },
    { text: 'Cada vuelta debe completarse en 60 minutos o menos', icon: <CheckCircle2 className="w-5 h-5 text-primary" /> },
    { text: 'Todas las vueltas comienzan puntualmente al inicio de cada hora', icon: <CheckCircle2 className="w-5 h-5 text-primary" /> },
    { text: 'Tres llamadas antes de iniciar: 3 minutos, 2 minutos y 1 minuto', icon: <CheckCircle2 className="w-5 h-5 text-primary" /> },
    { text: 'Los corredores deben estar dentro del corral al inicio', icon: <CheckCircle2 className="w-5 h-5 text-primary" /> },
  ];

  const mandatoryRules = [
    'Los corredores que no regresen antes de que el tiempo llegue a cero son eliminados',
    'No se puede iniciar una vuelta antes de que el reloj oficial comience',
    'Las vueltas deben completarse únicamente por el atleta (sin acompañantes)',
    'No se permite compañía, bicicletas, mascotas o cualquier otro tipo de ayuda en el circuito',
    'Los corredores pueden descansar, hidratarse y comer en el área de meta entre vueltas',
  ];

  const prohibitions = [
    { text: 'Consumo de alcohol durante la competencia', icon: <Ban className="w-5 h-5" /> },
    { text: 'Correr con dolor intenso, mareos, juicio alterado o agotamiento extremo', icon: <Ban className="w-5 h-5" /> },
    { text: 'Conducta ofensiva, agresiva, irrespetuosa o discriminatoria', icon: <Ban className="w-5 h-5" /> },
    { text: 'Interferir con el rendimiento o área de descanso de otros corredores', icon: <Ban className="w-5 h-5" /> },
    { text: 'Tirar basura en el circuito o áreas comunes', icon: <Ban className="w-5 h-5" /> },
    { text: 'Alterar vegetación, fauna o estructuras naturales', icon: <Ban className="w-5 h-5" /> },
    { text: 'Hacer fogatas', icon: <Ban className="w-5 h-5" /> },
    { text: 'Tomar atajos o cortar camino', icon: <Ban className="w-5 h-5" /> },
  ];

  const winnerRules = [
    'Solo hay un ganador: el "Último en Pie" (Last One Standing)',
    'El ganador es el último corredor en completar una vuelta válida',
    'Para ganar, el atleta debe completar una vuelta adicional después de que todos los demás hayan abandonado o sido eliminados',
    'Si no se completa esta última vuelta, no hay ganador',
  ];

  const sportsmanship = [
    'Mantener actitud respetuosa hacia atletas, voluntarios, personal, acompañantes y público',
    'Se espera deportividad ejemplar y apoyo saludable entre participantes',
    'Cualquier conflicto debe reportarse al Comité Organizador',
    'Moderar volumen de música y conversación en área de carpas',
    'Los atletas que decidan retirarse deben notificar al personal en la línea de meta',
    'No se permite reingreso después del retiro',
    'Los corredores no pueden permanecer en el corral durante vueltas posteriores',
  ];

  return (
    <section id="reglas" className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <Badge className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
              Reglamento Oficial
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Reglas del Backyard Ultra
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Basadas en el formato oficial de Backyard Ultra, complementadas con reglas internas
              para seguridad, convivencia y respeto ambiental
            </p>
          </div>

          {/* Format Rules */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Formato de Carrera
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {formatRules.map((rule, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {rule.icon}
                    <span className="text-foreground">{rule.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mandatory Rules */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Reglas Obligatorias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {mandatoryRules.map((rule, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Determinación del Ganador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {winnerRules.map((rule, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Prohibitions */}
          <Card className="border-destructive/30 bg-destructive/5 shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <XCircle className="w-6 h-6 text-destructive" />
                Prohibiciones
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Las siguientes conductas y acciones están estrictamente prohibidas. El incumplimiento
                puede resultar en descalificación inmediata.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {prohibitions.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background border border-destructive/20"
                  >
                    <div className="text-destructive flex-shrink-0 mt-0.5">{item.icon}</div>
                    <span className="text-sm text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sportsmanship and Conduct */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Deportividad y Conducta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sportsmanship.map((rule, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{rule}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Environmental Protection */}
          <Card className="bg-gradient-to-br from-accent/10 to-primary/5 border-accent/30 shadow-medium">
            <CardContent className="p-8 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-accent" />
                </div>
                <div className="space-y-3">
                  <h3 className="font-display text-2xl text-foreground">Protección Ambiental</h3>
                  <p className="text-muted-foreground">
                    La preservación ambiental es una prioridad del evento. Se aplica estrictamente la política
                    <strong className="text-foreground"> "Leave No Trace"</strong> (No Dejar Rastro).
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0"></span>
                      <span>Toda la basura debe ser traída de vuelta al área de meta</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0"></span>
                      <span>Puntos de eliminación de basura estarán disponibles, pero no se permite basura en carpas ni en el circuito</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0"></span>
                      <span>Respetar áreas de camping designadas</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0"></span>
                      <span className="font-semibold text-destructive">El incumplimiento puede llevar a descalificación inmediata</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Rules */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-2xl">Adherencia al Recorrido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Los corredores deben adherirse estrictamente a la distancia y ruta oficial.
                  Tomar atajos está prohibido y resultará en descalificación.
                </p>
                <div className="grid md:grid-cols-2 gap-4 pt-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Señalización del Circuito</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        150 banderas cada 40 metros
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Material reflectante en banderas
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Señales adicionales en puntos clave
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Cinta/marcadores en giros
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Terreno del Circuito</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Tierra compactada
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Áreas sombreadas y expuestas
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Tramos amplios para ritmo consistente
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Curvas suaves, no técnico
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}