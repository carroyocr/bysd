import React from 'react';
import { Flag, ChevronDown, Check, Radio, CalendarDays, Archive, FileEdit } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAdminRace } from '../contexts/AdminRaceContext';

/**
 * Selector de carrera del panel: una sola elección que vale para todas las
 * pantallas. Va siempre visible en la cabecera porque lo peligroso no es
 * elegir mal, sino no saber sobre cuál se está trabajando.
 */

const ESTADOS = {
  en_carrera: { texto: 'En carrera', icono: Radio, clase: 'text-red-600' },
  inscripcion: { texto: 'Inscripción abierta', icono: CalendarDays, clase: 'text-emerald-600' },
  borrador: { texto: 'Borrador', icono: FileEdit, clase: 'text-muted-foreground' },
  cerrada: { texto: 'Cerrada', icono: Archive, clase: 'text-muted-foreground' },
};

function estadoDe(carrera) {
  if (!carrera) return ESTADOS.borrador;
  if (carrera.is_legacy) return ESTADOS.cerrada;
  return ESTADOS[carrera.estado] || ESTADOS.inscripcion;
}

const fechaCorta = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export default function RaceSelector() {
  const { carreras, carrera, raceCode, setRaceCode, loading } = useAdminRace();

  if (loading) {
    return <div className="h-9 w-56 rounded-md bg-muted animate-pulse" />;
  }

  const actual = estadoDe(carrera);
  const IconoActual = actual.icono;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 max-w-full" data-testid="selector-carrera">
          <Flag className="w-4 h-4 shrink-0" />
          <span className="flex flex-col items-start leading-tight min-w-0">
            <span className="truncate font-medium">{carrera?.name || 'Elegir carrera'}</span>
            <span className={`text-[11px] flex items-center gap-1 ${actual.clase}`}>
              <IconoActual className="w-3 h-3" />
              {actual.texto}
            </span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Trabajar sobre</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {carreras.map((c) => {
          const estado = estadoDe(c);
          const Icono = estado.icono;
          return (
            <DropdownMenuItem
              key={c.code}
              onSelect={() => setRaceCode(c.code)}
              className="gap-2 cursor-pointer"
              data-testid={`carrera-${c.code}`}
            >
              <Icono className={`w-4 h-4 shrink-0 ${estado.clase}`} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {estado.texto}
                  {c.date ? ` · ${fechaCorta(c.date)}` : ''}
                </span>
              </span>
              {c.code === raceCode && <Check className="w-4 h-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
