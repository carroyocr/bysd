// Comprueba que la version de la app sea la misma en los tres sitios donde se
// escribe, antes de compilar para el telefono.
//
// La app ensena (splash y Acerca de) la version de package.json, pero las
// tiendas leen la de los proyectos nativos. En la 1.3.6 solo se subieron las
// nativas: la tienda la recibio como 1.3.6 y la app seguia diciendo 1.3.5.
// Con esto `yarn build:mobile` se para si no cuadran.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const leer = (archivo) => fs.readFileSync(path.join(raiz, archivo), 'utf8');

const paquete = JSON.parse(leer('package.json')).version;
const gradle = leer('android/app/build.gradle');
const xcode = leer('ios/App/App.xcodeproj/project.pbxproj');

const unico = (valores) => [...new Set(valores)];
const android = {
  version: (gradle.match(/versionName\s+"([^"]+)"/) || [])[1],
  build: (gradle.match(/versionCode\s+(\d+)/) || [])[1],
};
const ios = {
  version: unico([...xcode.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1])),
  build: unico([...xcode.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1])),
};

const fallos = [];
if (android.version !== paquete) {
  fallos.push(`Android versionName es ${android.version}, package.json dice ${paquete}`);
}
if (ios.version.length !== 1 || ios.version[0] !== paquete) {
  fallos.push(`iOS MARKETING_VERSION es ${ios.version.join(', ')}, package.json dice ${paquete}`);
}
if (ios.build.length !== 1 || ios.build[0] !== android.build) {
  fallos.push(`iOS CURRENT_PROJECT_VERSION es ${ios.build.join(', ')}, Android versionCode es ${android.build}`);
}

if (fallos.length) {
  console.error('\nLa version de la app no cuadra:\n  - ' + fallos.join('\n  - ') + '\n');
  process.exit(1);
}
console.log(`Version de la app: ${paquete} (build ${android.build})`);
