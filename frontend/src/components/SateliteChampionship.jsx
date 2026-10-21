import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Globe, Users, Trophy, CalendarCheck, Award, Target } from 'lucide-react';
import ResultadosMundial from './ResultadosMundial';

export default function SateliteChampionship() {
  return (
    <section className="py-10 bg-background" data-testid="satelite-championship">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* Header */}
          <div className="text-center space-y-4">
            <Badge className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
              <Globe className="w-4 h-4" />
              Evento Internacional
            </Badge>
            <h2 className="font-display uppercase text-5xl sm:text-6xl leading-none tracking-tight text-foreground">
              Campeonato Mundial por Equipos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              República Dominicana compitió por primera vez en el Campeonato Mundial por Equipos del Backyard Ultra, el 17 de octubre de 2026
            </p>
          </div>

          {/* Resultados: sale solo cuando la carrera tiene vueltas anotadas */}
          <ResultadosMundial />

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
          <Card className="bg-secondary border-border">
            <CardContent className="p-8 space-y-6">
              <h3 className="font-display text-2xl text-foreground flex items-center gap-3">
                <Target className="w-6 h-6 text-primary" />
                Cómo funciona
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground leading-relaxed">
                <div className="space-y-3">
                  <p>El Campeonato Mundial por Equipos es la <strong className="text-foreground">principal competencia por naciones</strong> dentro del formato Backyard Ultra. Equipos nacionales de múltiples países compiten simultáneamente.</p>
                  <p>La puntuación por equipo se calcula a razón de <strong className="text-foreground">un (1) punto por cada vuelta completada</strong> por cada miembro del equipo.</p>
                </div>
                <div className="space-y-3">
                  <p>La carrera concluye cuando solo un atleta logra completar una vuelta dentro del tiempo límite. El último atleta en competencia es declarado <strong className="text-foreground">campeón nacional</strong>.</p>
                  <p>Todas las carreras comienzan a la <strong className="text-foreground">misma hora sincronizada por satélite</strong> para asegurar una comparación internacional directa.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bronze Category */}
          {/* La medalla va en ámbar porque es bronce; la tarjeta, en la
              superficie suave del sitio, como las demás. */}
          <Card className="bg-secondary border-border">
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
