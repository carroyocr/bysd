/**
 * Rol elegido al entrar a la app nativa (espectador, atleta o staff).
 * Se guarda en localStorage, que en la app queda espejado a Preferences
 * (ver nativeStorage.js), así que sobrevive reinicios y purgas de iOS.
 */
const APP_ROLE_KEY = 'bysd_app_role';

export const APP_ROLES = {
  ESPECTADOR: 'espectador',
  ATLETA: 'atleta',
  STAFF: 'staff',
};

export function getAppRole() {
  return localStorage.getItem(APP_ROLE_KEY);
}

export function setAppRole(role) {
  localStorage.setItem(APP_ROLE_KEY, role);
}

export function clearAppRole() {
  localStorage.removeItem(APP_ROLE_KEY);
}

/** Ruta de inicio que corresponde a cada rol. */
export function roleHome(role) {
  switch (role) {
    case APP_ROLES.ESPECTADOR:
      return '/live';
    case APP_ROLES.ATLETA:
      return '/mi-perfil';
    case APP_ROLES.STAFF:
      return '/staff';
    default:
      return '/app';
  }
}
