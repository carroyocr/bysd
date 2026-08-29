"""Version publicada de la app BYSD Live, para invitar a actualizar.

La app pregunta aqui al abrir y compara con la version que trae dentro. Si la
tienda tiene una mas nueva, ensena el aviso con el enlace a la ficha.

Lo que se escribe abajo es **lo que hay publicado en cada tienda**, no lo que
hay en el repositorio: si aqui se pone una version que la tienda todavia no
sirve, se invita a la gente a una actualizacion que no puede instalar. Se toca
cuando la tienda aprueba y publica, que es un momento distinto del despliegue
del sitio.

Las dos tiendas van por separado porque casi nunca publican a la vez: Apple
revisa y Android pasa por prueba cerrada.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/app", tags=["app"])

VERSIONES = {
    "ios": {
        "version": "1.3.1",
        "url": "https://apps.apple.com/do/app/bysd-live/id6802661105",
    },
    "android": {
        # En prueba cerrada de Play: la ficha solo la abre quien sea tester.
        "version": "1.3.3",
        "url": "https://play.google.com/store/apps/details?id=com.backyardultrasd.app",
    },
}


@router.get("/version")
async def version_publicada():
    """Version en tienda de cada plataforma (publico, sin autenticacion)."""
    return VERSIONES
