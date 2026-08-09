import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Botón y gesto "atrás" de Android.
 *
 * Sin nadie escuchando el evento, Capacitor cierra la actividad: el gesto de
 * deslizar desde el borde minimizaba la app en vez de retroceder una pantalla,
 * porque Android se queda el gesto antes de que llegue al WebView y lo entrega
 * como pulsación de atrás. Aquí se atiende y se retrocede por el historial de
 * la app; solo se sale cuando ya no queda pantalla a la que volver.
 *
 * En iOS no interviene: allí el gesto lo resuelve useSwipeBack dentro del
 * WebView, que no tiene botón de atrás del sistema.
 */
export default function useAndroidBack() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let suscripcion;
    let vivo = true;
    CapApp.addListener('backButton', () => {
      if (window.history.length > 1) navigate(-1);
      else CapApp.exitApp();
    }).then((h) => {
      if (vivo) suscripcion = h;
      else h.remove();
    });

    return () => {
      vivo = false;
      suscripcion?.remove();
    };
  }, [navigate]);
}
