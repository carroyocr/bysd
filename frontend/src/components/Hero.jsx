import React from 'react';
import { Calendar, MapPin, Clock, UserPlus } from 'lucide-react';
import { Badge } from './ui/badge';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import DescargarApp from './DescargarApp';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Hero() {
  const { getShortDate, getYear, raceLocation, getEditionLabel, getLogoUrl, config } = useRaceConfig();
  const navigate = useNavigate();
  const showInscription = config?.show_preregistration === true;
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/30 to-muted/50"></div>
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Content */}
            <div className="text-center space-y-6 animate-slide-up lg:text-left">
              <Badge className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft">
                <Clock className="w-4 h-4" />
                {getEditionLabel()}
              </Badge>
              
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-foreground leading-none tracking-tight">
                BACKYARD ULTRA
                <span className="block text-primary mt-2">SANTO DOMINGO</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Un desafío personal. Un ejercicio de disciplina. Una prueba de voluntad. Vuelta tras vuelta.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <div
                  className="flex items-center gap-3 px-5 py-3 bg-card rounded-lg border border-border shadow-soft"
                >
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground font-medium">Fecha</div>
                    <div className="text-sm font-bold text-foreground">{getShortDate()}</div>
                  </div>
                </div>
                
                <a 
                  href="https://maps.app.goo.gl/ZRMgpWA65jDLZgwcA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 bg-card rounded-lg border border-border shadow-soft hover:shadow-medium hover:border-primary transition-all duration-300 group"
                >
                  <MapPin className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground font-medium">Lugar</div>
                    <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Hotel Caribbean Adventure</div>
                  </div>
                </a>

                {showInscription && (
                  <button
                    onClick={() => navigate('/mi-perfil')}
                    className="flex items-center gap-3 px-5 py-3 bg-primary/10 rounded-lg border-2 border-primary shadow-soft hover:shadow-medium hover:bg-primary/20 transition-all duration-300 group animate-pulse hover:animate-none"
                    data-testid="inscription-open-card"
                  >
                    <UserPlus className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="text-xs text-primary font-semibold">Inscripciones</div>
                      <div className="text-sm font-bold text-primary">Abiertas</div>
                    </div>
                  </button>
                )}
              </div>
              
              {/* Bajar la app: arriba del pliegue, se ve sin hacer scroll */}
              <div className="pt-2">
                <DescargarApp />
              </div>
            </div>

            {/* Logo Image - Hidden on mobile, visible on desktop */}
            <div className="hidden lg:flex items-center justify-center animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                <img
                  src={getLogoUrl('home')}
                  alt="Backyard Ultra Santo Domingo Logo"
                  className="relative w-full max-w-md mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16 border-t border-border">
            <div className="text-center space-y-2">
              <div className="font-display text-4xl sm:text-5xl text-primary">6.7</div>
              <div className="text-sm text-muted-foreground font-medium">KM por vuelta</div>
            </div>
            <div className="text-center space-y-2">
              <div className="font-display text-4xl sm:text-5xl text-primary">60</div>
              <div className="text-sm text-muted-foreground font-medium">Minutos límite</div>
            </div>
            <div className="text-center space-y-2">
              <div className="font-display text-4xl sm:text-5xl text-primary">24h+</div>
              <div className="text-sm text-muted-foreground font-medium">Duración estimada</div>
            </div>
            <div className="text-center space-y-2">
              <div className="font-display text-4xl sm:text-5xl text-primary">1</div>
              <div className="text-sm text-muted-foreground font-medium">Último en pie</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}