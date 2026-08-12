/**
 * Paquete de iconos del sitio.
 *
 * Un solo sitio donde se decide como se ve un icono y como se llama. Las
 * pantallas importan el nombre de lo que significa (`IconGanador`,
 * `IconVueltas`) y no el del dibujo, asi que cambiar el glifo se hace aqui una
 * vez y no en veinte archivos.
 *
 * Reglas del paquete:
 *  - Trazo fino y uniforme (1.75). Los iconos de lucide vienen a 2 y a tamano
 *    pequeno se ven pesados y sucios al lado de la tipografia.
 *  - Nunca emojis. Los emojis los dibuja el sistema operativo: cambian de un
 *    telefono a otro, no heredan el color del texto y no se pueden alinear.
 *  - Tamano por clase de Tailwind (`w-5 h-5`), como el resto del sitio.
 */
import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  Flag,
  Globe,
  Heart,
  Home,
  Image,
  Loader2,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  RefreshCw,
  Repeat,
  Route,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Trophy,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const TRAZO = 1.75;

// Envuelve un icono de lucide para fijarle el trazo del paquete y evitar que se
// encoja dentro de un flex. Quien lo use puede seguir pasando className.
function definir(Glifo, nombre) {
  const Icono = React.forwardRef(({ className, strokeWidth, ...props }, ref) => (
    <Glifo
      ref={ref}
      strokeWidth={strokeWidth ?? TRAZO}
      className={cn('shrink-0', className)}
      {...props}
    />
  ));
  Icono.displayName = nombre;
  return Icono;
}

/* --- Estado del atleta en carrera --- */
export const IconGanador = definir(Trophy, 'IconGanador');
export const IconInvitada = definir(Medal, 'IconInvitada');
export const IconEnCarrera = definir(Activity, 'IconEnCarrera');
export const IconDNF = definir(UserMinus, 'IconDNF');
export const IconDNS = definir(UserX, 'IconDNS');

/* --- Metricas de la carrera --- */
export const IconVueltas = definir(Repeat, 'IconVueltas');
export const IconKmEvento = definir(Flag, 'IconKmEvento');
export const IconKmAtletas = definir(Route, 'IconKmAtletas');
export const IconAtletas = definir(Users, 'IconAtletas');
export const IconLugar = definir(MapPin, 'IconLugar');
export const IconPais = definir(Globe, 'IconPais');
export const IconReloj = definir(Clock, 'IconReloj');

/* --- Publico: seguir, animar, suscribirse --- */
export const IconSeguir = definir(Heart, 'IconSeguir');
export const IconSeguidores = definir(UserCheck, 'IconSeguidores');
export const IconAnimo = definir(MessageCircle, 'IconAnimo');
export const IconNotificar = definir(Bell, 'IconNotificar');
export const IconEmail = definir(Mail, 'IconEmail');
export const IconEnviar = definir(Send, 'IconEnviar');

/* --- Certificados y descargas --- */
export const IconCertificado = definir(BadgeCheck, 'IconCertificado');
export const IconPDF = definir(FileText, 'IconPDF');
export const IconImagen = definir(Image, 'IconImagen');
export const IconDescargar = definir(Download, 'IconDescargar');

/* --- Acciones generales --- */
export const IconBuscar = definir(Search, 'IconBuscar');
export const IconFiltro = definir(SlidersHorizontal, 'IconFiltro');
export const IconCompartir = definir(Share2, 'IconCompartir');
export const IconCopiar = definir(Copy, 'IconCopiar');
export const IconHecho = definir(Check, 'IconHecho');
export const IconCerrar = definir(X, 'IconCerrar');
export const IconActualizar = definir(RefreshCw, 'IconActualizar');
export const IconCargando = definir(Loader2, 'IconCargando');
export const IconAvanzar = definir(ArrowRight, 'IconAvanzar');
export const IconDesplegar = definir(ChevronDown, 'IconDesplegar');
export const IconInicio = definir(Home, 'IconInicio');
export const IconAviso = definir(AlertTriangle, 'IconAviso');

/* --- Marcas (no son de lucide: cada red tiene su logo y hay que dibujarlo) --- */
export const IconTwitterX = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={cn('shrink-0', className)}
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
));
IconTwitterX.displayName = 'IconTwitterX';

export const IconWhatsApp = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={cn('shrink-0', className)}
    {...props}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
));
IconWhatsApp.displayName = 'IconWhatsApp';

/**
 * Recuadro para un icono. Es lo que le da a las tarjetas el mismo aire: el
 * icono nunca va suelto sobre el fondo, va dentro de un cuadro redondeado del
 * mismo color a baja opacidad.
 */
export function IconChip({ children, className, size = 'md' }) {
  const medidas = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-20 h-20 rounded-3xl',
  };
  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0 bg-primary/10 text-primary',
        medidas[size],
        className
      )}
    >
      {children}
    </div>
  );
}
