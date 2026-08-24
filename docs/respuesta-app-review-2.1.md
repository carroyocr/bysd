# Respuesta al rechazo 2.1 (Information Needed) — BYSD Live 1.3

Apple no rechazó por un fallo: pide información. Hay que responder en App Store Connect
(Resolution Center) con los 7 puntos, adjuntar un video grabado en un iPhone físico, y
pegar los puntos 2–7 también en **App Review Information → Notes** para futuros envíos.

---

## Texto para responder en App Store Connect (en inglés)

> Copiar desde aquí. Rellenar los `[..]` antes de enviar.

---

Thank you for reviewing BYSD Live. Please find the requested information below. A screen
recording captured on a physical iPhone is attached to this reply.

**1. Screen recording**

Attached. It was recorded on an [iPhone XX] running iOS [XX], starting from app launch and
showing the typical user flow: choosing a race, live leaderboard and lap tracking, an
athlete's public profile, posting a cheer message, the push-notification permission prompt,
account registration and login, uploading a profile photo (camera/photo library prompts),
and account deletion.

**2. Devices and operating systems tested**

- [iPhone XX], iOS [XX] (physical device)
- [iPad XX], iPadOS [XX] (physical device or Simulator — indicar)
- iOS Simulator: iPhone 16 Pro, iPhone SE (3rd gen), iPad (10th gen) on iOS [XX]

**3. Purpose and target audience**

BYSD Live is the official companion app for the Backyard Ultra Santo Domingo, an
ultramarathon race held in Santo Domingo, Dominican Republic (a "backyard ultra" is a
last-runner-standing format where athletes run a 6.7 km loop every hour until one remains).
The app solves a real problem for this event: spectators, family members and athletes had
no way to follow the race in real time. It provides live lap-by-lap results, the current
leaderboard, public athlete profiles, race information (rules, logistics, FAQ), event
photos, cheer messages for the runners, and optional push notifications when a followed
athlete completes a lap. The target audience is race participants, their families and
friends, race staff/volunteers, and trail-running fans. The app is free, with no ads sold
in-app and no purchases.

**4. Setup and access instructions**

No account is required for the core experience: launch the app, pick the race, and browse
live results, athlete profiles, photos and race info. An account (email + password) is only
needed to post cheer messages, follow athletes with push notifications, or manage an
athlete registration.

Demo accounts (also provided in App Review Information):
- Spectator account: carroyo.cr+demo.espectador@gmail.com / Demo-Fan-2026
- Athlete account: carroyo.cr+demo.atleta@gmail.com / Demo-Atleta-2026
- Staff/volunteer account: carroyo.cr+demo.staff@gmail.com / Demo-Staff-2026 — staff
  features (QR lap scanning, medical info) require organizer-granted permissions and are
  only active during race days, so the demo staff account shows the staff profile and
  volunteer shift screens with empty states outside of a live event.

Note: the next race is on [fecha]; between events the app shows the results of the most
recent race, so all screens shown in the recording are reachable at any time.

**5. External services, tools and platforms**

- Our own backend API (FastAPI) hosted on Render (bysd-backend.onrender.com)
- MongoDB Atlas — database and file storage (profile photos)
- Firebase Cloud Messaging — push notifications (via APNs on iOS)
- Open-Meteo — weather at the race venue (no account/API key, public API)
- Google Photos — the event's public shared album is displayed in the Photos screen
- X (Twitter) — cheer messages posted by users are also published to the event's official
  X account
- Gmail SMTP — transactional email (account verification codes, password recovery)

No payment processors (there are no purchases in the app; race registration is paid by bank
transfer outside the app), no analytics or tracking SDKs, no advertising SDKs, and no AI
services.

**6. Regional differences**

None. The app functions identically in all regions. It is available in Spanish only, as the
event takes place in the Dominican Republic and its audience is Spanish-speaking.

**7. Regulated industry / protected material**

Not applicable. The app is a sports-event companion app; it does not operate in a regulated
industry. All content (race data, photos, branding) is owned by the event organizer, who is
the developer of this app.

---

## Guion del video (grabar en tu iPhone con iOS al día)

Grabar con la grabación de pantalla de iOS (Centro de Control), en una sola toma, sin
cortes. Antes de grabar: borra la app e instálala de nuevo (TestFlight), para que salgan
los permisos desde cero. Orden:

1. Toca el icono de la app → splash → selector de carrera.
2. Elige la carrera → Home → Seguimiento (tabla en vivo) → Tablero.
3. Abre la ficha de un atleta (perfil público, experiencia, ánimo).
4. Escribe un mensaje de ánimo (contenido generado por usuario — Apple lo pide).
5. Activa notificaciones en Config → **debe verse el diálogo de permiso de push**.
6. Ve a login → **regístrate** con una cuenta nueva de espectador (verás el flujo completo).
7. Cierra sesión y **entra** con la cuenta demo.
8. En el perfil, cambia la foto → **debe verse el diálogo de cámara/fotos**.
9. En un mensaje de ánimo, toca los tres puntos → **Reportar mensaje** (y muestra
   también "Ocultar mensajes de…"): es la moderación de contenido de usuarios que
   Apple busca.
10. En Configuración, **Eliminar cuenta** → confirma (hazlo con una cuenta de
    espectador de usar y tirar, no con la demo que le des a Apple).
11. Pantalla Acerca de (con el enlace a la política de privacidad) y cierre.

---

## Estado (rama `cumplimiento-app-review`, build 1.3.1)

Resuelto en el build 1.3.1 — grabar el video sobre este build:
- Eliminación de cuenta dentro de la app (Configuración), para todos los roles.
  El corredor inscrito en una carrera sin terminar y la cuenta admin del panel
  siguen necesitando a la organización (409 con mensaje claro).
- Reportar mensaje (lo oculta al momento) y ocultar autor en los ánimos.
  La organización revisa con `GET /api/race/cheers/reported` y restaura con
  `POST /api/race/cheers/{id}/restore` (pendiente pantalla en el panel).
- Enlace a la política de privacidad en Acerca de.
- `CFBundleDevelopmentRegion` = `es`; versión 1.3.1 (build 5) en iOS y Android.

Hecho el 19 ago 2026:
- Cuentas demo creadas y probadas en producción (ver punto 4). Ponerlas también en
  App Review Information → Sign-In Information / Notes.
- Merge a `main` desplegado y 1.3.1 (build 5) subido a App Store Connect.

Pendiente:
1. Grabar el video en el iPhone con el 1.3.1 de TestFlight instalado (para el paso de
   eliminar cuenta del video, crear en el momento una cuenta de espectador desechable;
   no borrar las cuentas demo de Apple).
2. Responder en el Resolution Center con el texto de arriba y el video adjunto, y
   seleccionar el build 5 en la versión 1.3.1.
