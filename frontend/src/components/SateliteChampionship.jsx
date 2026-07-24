import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Globe, Users, Trophy, CalendarCheck, Flag, Star, Timer, Award, Target, Shield } from 'lucide-react';

const teamMembers = [
  { name: 'Jordano Martínez Abreu', laps: 47 },
  { name: 'Livio Feliz', laps: 30 },
  { name: 'Jorge Lewis Camilo Tejada', laps: 23 },
  { name: 'Iván Ortega', laps: 19 },
  { name: 'Daiyi Shiguetome Rodríguez', laps: 18 },
  { name: 'Cristian Minaya Domínguez', laps: 17 },
  { name: 'Carlos Alberto Ovalle', laps: 17 },
  { name: 'Yeirys Soto', laps: 17 },
  { name: 'Juan Pérez', laps: 17 },
  { name: 'Pedro Pablo Taveras', laps: 16 },
  { name: 'Simón Bolívar Cepeda Lora', laps: 15 },
  { name: 'Joan Gómez Velázquez', laps: 15 },
  { name: 'José Antonio Santos Leonardo', laps: 15 },
  { name: 'Rodrigo Farach Aldana', laps: 13 },
  { name: 'Luis Antonio De León Encarnación', laps: 13 },
];

const reserveMembers = [

];

export default function SateliteChampionship() {
  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background" data-testid="satelite-championship">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* Header */}
          <div className="text-center space-y-4">
            <Badge className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
              <Globe className="w-4 h-4" />
              Evento Internacional
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Campeonato Satélite por Equipos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              República Dominicana ha sido seleccionada para participar en el Campeonato Satélite por Equipos del Backyard Ultra
            </p>
          </div>

          {/* Key Info Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover-lift shadow-soft hover:shadow-medium transition-all duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarCheck className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl text-foreground">Fecha</h3>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">17 de octubre de 2026</strong><br />
                  Simultáneo a nivel mundial
                </p>
              </CardContent>
            </Card>
            <Card className="hover-lift shadow-soft hover:shadow-medium transition-all duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl text-foreground">Formato</h3>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">15 atletas</strong> por equipo nacional<br />
                  Inicio sincronizado por satélite
                </p>
              </CardContent>
            </Card>
            <Card className="hover-lift shadow-soft hover:shadow-medium transition-all duration-300">
              <CardContent className="p-6 space-y-3">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl text-foreground">Clasificación</h3>
                <p className="text-sm text-muted-foreground">
                  El campeón nacional con <strong className="text-foreground">24+ vueltas</strong> clasifica al Mundial Individual (Tennessee, 2027)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How it works */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 space-y-6">
              <h3 className="font-display text-2xl text-foreground flex items-center gap-3">
                <Target className="w-6 h-6 text-primary" />
                Cómo funciona
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground leading-relaxed">
                <div className="space-y-3">
                  <p>El Campeonato Satélite por Equipos es la <strong className="text-foreground">principal competencia por naciones</strong> dentro del formato Backyard Ultra. Equipos nacionales de múltiples países compiten simultáneamente.</p>
                  <p>La puntuación por equipo se calcula a razón de <strong className="text-foreground">un (1) punto por cada vuelta completada</strong> por cada miembro del equipo.</p>
                </div>
                <div className="space-y-3">
                  <p>La carrera concluye cuando solo un atleta logra completar una vuelta dentro del tiempo límite. El último atleta en competencia es declarado <strong className="text-foreground">campeón nacional</strong>.</p>
                  <p>Todas las carreras comienzan a la <strong className="text-foreground">misma hora sincronizada por satélite</strong> para asegurar una comparación internacional directa.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* National Team */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="font-display text-3xl text-foreground flex items-center justify-center gap-3">
                <Flag className="w-6 h-6 text-primary" />
                Selección Nacional
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Coordinador Nacional: <strong className="text-foreground">Cristian Arroyo López</strong>
              </p>
            </div>

            {/* Main Team */}
            <Card className="shadow-soft">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-primary" />
                  <h4 className="font-display text-lg text-foreground">Equipo Titular (Top 15)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="team-main-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase">#</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase">Atleta</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase">Vueltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((m, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`team-member-${i+1}`}>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">{String(i + 1).padStart(2, '0')}</td>
                          <td className="py-2.5 px-3 font-medium text-foreground">{m.name}</td>
                          <td className="py-2.5 px-3 text-right">
                            <Badge variant="outline" className="font-mono">
                              <Timer className="w-3 h-3 mr-1" />{m.laps}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

 

            {/* Deadline Note */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800" data-testid="deadline-note">
              <strong>Fecha límite de clasificación:</strong> 1 de septiembre de 2026. La nómina podrá actualizarse si algún atleta dominicano registra un mayor número de vueltas en otro evento oficial de Backyard Ultra antes de esa fecha.
            </div>
          </div>

          {/* Bronze Category */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 shadow-medium">
            <CardContent className="p-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Award className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-foreground">Categoría Bronce</h3>
                  <p className="text-sm text-muted-foreground">Circuito Internacional de Backyard Ultra</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Backyard Ultra Santo Domingo ha sido oficialmente reconocido como una carrera de <strong className="text-foreground">Categoría Bronce</strong> dentro del circuito internacional. Esta designación incrementa la visibilidad internacional del evento, fortalece la presencia de la República Dominicana en la comunidad global de ultradistancia y posiciona aún más el evento como una importante plataforma de turismo deportivo para el país.
              </p>
            </CardContent>
          </Card>

          {/* Signature */}
          <div className="text-center text-sm text-muted-foreground space-y-1 pt-4">
            <p className="font-semibold text-foreground">Lazarus Lake</p>
            <p>Creator, Backyard Ultra</p>
            <p>Big's Backyard Ultra</p>
          </div>

        </div>
      </div>
    </section>
  );
}
