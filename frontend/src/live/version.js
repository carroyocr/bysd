// Versión y revisión de la app.
//
// Los tres valores los inyecta webpack al compilar (ver craco.config.js): la
// versión sale de package.json y la revisión del commit, así que no hay que
// acordarse de tocar nada a mano. Si el entorno de compilación no tiene git,
// la revisión llega vacía y la pantalla lo dice en vez de mentir.
export const VERSION = process.env.REACT_APP_VERSION || '—';
export const REVISION = process.env.REACT_APP_REVISION || '';
export const FECHA_BUILD = process.env.REACT_APP_BUILD_DATE || '';

/** Una línea para el pie del menú: "v1.0.0 · a1b2c3d" */
export const VERSION_CORTA = REVISION ? `v${VERSION} · ${REVISION}` : `v${VERSION}`;
