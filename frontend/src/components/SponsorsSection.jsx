import React, { useState, useEffect } from 'react';
import { LEGACY_SPONSORS, LEGACY_RACE_CODES } from '../content/legacySponsors';
import { ExternalLink, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useRaceConfig } from '../contexts/RaceConfigContext';

// Legacy sponsors for BYSD-2026 (hardcoded)


// Legacy race codes that use hardcoded sponsors

export default function SponsorsSection({ raceCode }) {
  const { raceName, config } = useRaceConfig();
  
  // Determine which race to show - from URL param or active race
  const displayRaceCode = raceCode ? raceCode.toUpperCase() : config?.code;
  const [raceInfo, setRaceInfo] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch race info if viewing a specific race
  useEffect(() => {
    const fetchRaceInfo = async () => {
      if (displayRaceCode) {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race-config/${displayRaceCode}`);
          if (response.ok) {
            const data = await response.json();
            setRaceInfo(data);
          }
        } catch (error) {
          console.error('Error fetching race info:', error);
        }
      }
    };
    fetchRaceInfo();
  }, [displayRaceCode]);

  // Fetch sponsors based on race code
  useEffect(() => {
    const fetchSponsors = async () => {
      setLoading(true);
      
      // Use legacy sponsors for BYSD-2026
      if (displayRaceCode && LEGACY_RACE_CODES.includes(displayRaceCode)) {
        setSponsors(LEGACY_SPONSORS);
        setLoading(false);
        return;
      }
      
      // Fetch from API for new races
      if (displayRaceCode) {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sponsors/race/${displayRaceCode}`);
          if (response.ok) {
            const data = await response.json();
            // Map API response to match the expected format
            const mappedSponsors = (data.sponsors || []).map(s => ({
              name: s.name,
              description: s.description,
              instagram: s.instagram,
              // Convert relative logo URL to full URL
              logo: s.logo_url ? `${process.env.REACT_APP_BACKEND_URL}${s.logo_url}` : null
            }));
            setSponsors(mappedSponsors);
          }
        } catch (error) {
          console.error('Error fetching sponsors:', error);
        }
      }
      
      setLoading(false);
    };
    
    fetchSponsors();
  }, [displayRaceCode]);

  // Get display name for the race
  const getDisplayRaceName = () => {
    if (raceInfo) return raceInfo.name;
    return raceName;
  };

  if (loading) {
    return (
      <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Patrocinadores
            </h2>
            <p className="text-muted-foreground">
              {getDisplayRaceName()}
            </p>
            {displayRaceCode && (
              <Badge variant="outline" className="text-primary border-primary">
                {displayRaceCode}
              </Badge>
            )}
          </div>

          {/* Show message if no sponsors */}
          {sponsors.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="py-12 text-center">
                <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Aún no hay patrocinadores registrados para esta carrera
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Introduction */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 md:p-10 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    El {getDisplayRaceName()} es posible gracias al apoyo de marcas e instituciones líderes en sus respectivos sectores, que creen en el deporte, la resiliencia y el poder de la comunidad.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Cada patrocinador aporta experiencia, calidad y compromiso, haciendo posible que atletas locales e internacionales vivan una competencia segura, bien organizada y al nivel de un evento de clase mundial. Sin su apoyo, nada de esto sería posible.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-8" />

          {/* Sponsors Grid */}
          <div>
            <h3 className="font-display text-2xl text-foreground mb-6 text-center">
              Patrocinadores (orden alfabético)
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sponsors.map((sponsor, index) => (
                <Card
                  key={index}
                  className="bg-card border-border shadow-soft hover-lift hover:shadow-medium transition-all duration-300 group"
                >
                  <CardHeader className="space-y-4">
                    {/* Logo */}
                    {sponsor.logo ? (
                      <div className="w-full h-32 flex items-center justify-center bg-muted/20 rounded-lg p-4">
                        <img
                          src={sponsor.logo}
                          alt={`Logo de ${sponsor.name}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-muted/20 rounded-lg">
                        <span className="text-muted-foreground text-sm">Logo próximamente</span>
                      </div>
                    )}
                    <CardTitle className="text-xl font-bold text-foreground flex items-start justify-between gap-2">
                      <span>{sponsor.name}</span>
                      <a
                        href={sponsor.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        aria-label={`Instagram de ${sponsor.name}`}
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {sponsor.description}
                    </p>
                    <a
                      href={sponsor.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Ver en Instagram
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Thank You Message */}
          <Card className="bg-gradient-to-br from-secondary/30 to-muted/30 border-border shadow-medium">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">
                Gracias a Todos Nuestros Patrocinadores
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Su compromiso hace posible que este evento sea una realidad. Juntos, estamos creando
                una experiencia inolvidable para todos los atletas y la comunidad.
              </p>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}