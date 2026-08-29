import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// El navegador restaura por su cuenta el scroll de cada entrada del historial
// al volver atras. En una app de una sola pagina eso llega tarde y a destiempo:
// al volver de la ficha de un corredor, la lista se vuelve a pedir y por un
// momento esta vacia, asi que la restauracion cae sobre una pagina corta y deja
// la vista en una zona sin nada. En el telefono eso es una pantalla negra que
// parece un cuelgue, y en realidad basta con subir el dedo para ver que la
// pantalla estaba entera.
//
// Con "manual" la restauracion la lleva este componente y solo este: al cambiar
// de ruta, arriba.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // If there's a hash, scroll to that element after a small delay
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 100);
    } else {
      // Scroll to top whenever the route changes (no hash)
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant',
      });
    }
  }, [pathname, hash]);

  return null;
}
