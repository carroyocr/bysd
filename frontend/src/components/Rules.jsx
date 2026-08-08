import React from 'react';
import { Ban, CheckCircle2, XCircle, AlertTriangle, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { REGLAS } from '../content/eventInfo';

export default function Rules() {
  const formatRules = REGLAS.formato.map((text) => ({ text, icon: <CheckCircle2 className="w-5 h-5 text-primary" /> }));
  const mandatoryRules = REGLAS.obligatorias;
  const prohibitions = REGLAS.prohibiciones.map((text) => ({ text, icon: <Ban className="w-5 h-5" /> }));
  const winnerRules = REGLAS.ganador;
  const sportsmanship = REGLAS.deportividad;

  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
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
                    {REGLAS.ambiental.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0"></span>
                        <span className={index === REGLAS.ambiental.length - 1 ? 'font-semibold text-destructive' : ''}>{item}</span>
                      </li>
                    ))}
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
                      {REGLAS.senalizacion.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Terreno del Circuito</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {REGLAS.terreno.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                          {item}
                        </li>
                      ))}
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