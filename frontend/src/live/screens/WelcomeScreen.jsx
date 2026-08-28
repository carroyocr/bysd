import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VERSION_CORTA } from '../version';
import { rutaDeEntrada } from '../sesion';
import PresentedBy from '../../components/PresentedBy';

/**
 * Pantalla de bienvenida: marca a pantalla completa y pase automático a la
 * pantalla de acceso (o toque para saltarla).
 *
 * De aquí se sale al acceso, que es donde se elige quién entra: corredor,
 * staff o espectador. Antes se caía directo en el selector de carreras y el
 * acceso quedaba escondido en el menú lateral.
 *
 * Con la sesión ya abierta no se pregunta nada: se entra directo a lo que le
 * toca a cada uno (ver rutaDeEntrada).
 */
export default function WelcomeScreen() {
  const navigate = useNavigate();
  // Se resuelve al montar, no al saltar: así el toque y el temporizador van
  // al mismo sitio.
  const destino = rutaDeEntrada();

  useEffect(() => {
    // 4 s: da tiempo a leer la version antes de pasar, y se puede saltar tocando
    const id = setTimeout(() => navigate(destino, { replace: true }), 4000);
    return () => clearTimeout(id);
  }, [navigate, destino]);

  return (
    <div
      className="min-h-[100dvh] bg-[#0C0C0C] text-white flex flex-col items-center justify-center px-8 cursor-pointer"
      onClick={() => navigate(destino, { replace: true })}
    >
      {/* El sello de la carrera, no un icono generico. Va el archivo que
          viaja dentro de la app: esta pantalla se ve antes de hablar con el
          servidor, asi que no puede depender de la red. */}
      <img
        src="/icon-bu.png"
        alt="Backyard Ultra Santo Domingo"
        className="w-28 h-28 drop-shadow-[0_0_60px_rgba(231,118,34,0.45)] animate-pulse"
      />
      <h1 className="mt-8 text-3xl font-extrabold tracking-wide text-center">
        BYSD <span className="text-[#E77622]">LIVE</span>
      </h1>
      <p className="mt-2 text-sm text-[#9a9a9a] text-center">
        Backyard Ultra Santo Domingo
      </p>
      <p className="mt-1.5 text-[11px] font-mono text-[#6b6b6b] text-center">{VERSION_CORTA}</p>
      <p className="mt-10 text-[11px] tracking-[0.25em] text-[#666666] uppercase">
        Last One Standing
      </p>
      <PresentedBy size="sm" fondo="oscuro" className="mt-8" />
    </div>
  );
}
