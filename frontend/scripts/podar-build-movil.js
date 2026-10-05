// Quita del build lo que es solo del sitio web, antes de copiarlo a los
// proyectos nativos.
//
// Todo lo que hay en `public/` acaba dentro de la app, se use o no. La
// propuesta de patrocinio de 226ers se sirve desde el sitio y pesa 3,8 MB:
// viajo dentro de la 1.3.10 y la 1.3.11, y Google Play aviso de que el paquete
// habia crecido de golpe. En la app no la abre nada.
//
// Solo se quita lo que es seguro que la app no usa. Lo que se anada a
// `public/` para el sitio y no para la app, se apunta aqui.
const fs = require('fs');
const path = require('path');

// `correo/`: las imagenes que enlazan los correos (botones de las tiendas).
const SOLO_DEL_SITIO = ['propuesta', 'correo'];

const build = path.join(__dirname, '..', 'build');
SOLO_DEL_SITIO.forEach((nombre) => {
  const ruta = path.join(build, nombre);
  if (fs.existsSync(ruta)) {
    fs.rmSync(ruta, { recursive: true, force: true });
    console.log(`Fuera del paquete de la app: ${nombre}/`);
  }
});
