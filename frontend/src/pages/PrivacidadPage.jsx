import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// Política de privacidad del sitio y de la app BYSD Live.
//
// Google Play exige una URL pública con esta política y que lo que diga aquí
// cuadre con el formulario de "Seguridad de los datos" de la ficha. Por eso
// esta página describe lo que el sistema recoge de verdad (los campos de
// `RegistrationBase` y `AthleteRegisterRequest`, los tokens de
// `push_devices`, los archivos en GridFS): si mañana se agrega un dato nuevo
// al formulario de inscripción, hay que actualizar esta página y el
// formulario de Play.
const ACTUALIZADA = '15 de agosto de 2026';
const CORREO = 'backyardultrasantodomingo@gmail.com';

function Seccion({ titulo, children }) {
  return (
    <Card className="bg-card border-border shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="pt-16">
      <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h1 className="font-display text-4xl sm:text-5xl text-foreground">
                Política de Privacidad
              </h1>
              <p className="text-muted-foreground">
                Sitio web backyardultrasantodomingo.com y aplicación móvil BYSD Live
              </p>
              <p className="text-sm text-muted-foreground">Última actualización: {ACTUALIZADA}</p>
            </div>

            <Seccion titulo="Quién trata tus datos">
              <p>
                Backyard Ultra Santo Domingo, organizador del evento del mismo nombre en la
                República Dominicana, es el responsable de los datos que se recogen en este sitio
                y en la aplicación BYSD Live. Para cualquier asunto relacionado con tus datos
                escribe a <a href={`mailto:${CORREO}`} className="text-primary hover:underline">{CORREO}</a>.
              </p>
            </Seccion>

            <Seccion titulo="Qué datos recogemos y para qué">
              <p className="font-medium text-foreground">Cuenta de atleta</p>
              <p>
                Correo electrónico, contraseña, nombre y apellidos, teléfono, fecha de nacimiento,
                sexo, nacionalidad y ciudad de residencia. Sirven para identificarte, permitirte
                entrar a tu perfil y comunicarnos contigo. La contraseña se guarda cifrada: nadie
                de la organización puede leerla.
              </p>

              <p className="font-medium text-foreground pt-2">Inscripción a la carrera</p>
              <p>
                Años de experiencia, distancia máxima recorrida, motivación, talla de camiseta,
                personalización del dorsal, si llevas carpa, hospedaje, número de acompañantes y
                cómo te enteraste del evento. Se usan para organizar la carrera, producir camisetas
                y dorsales, y planificar la logística.
              </p>

              <p className="font-medium text-foreground pt-2">Datos de salud y emergencia</p>
              <p>
                Tipo de sangre, condición médica, alergias y los datos de tu contacto de
                emergencia (nombre, relación y teléfono). Son datos sensibles y se tratan como
                tales: existen únicamente para poder atenderte durante el evento y solo son
                visibles para el personal autorizado del equipo médico y de organización. No se
                publican, no se comparten con patrocinadores y no se usan para ninguna otra cosa.
                Si registras un contacto de emergencia, asegúrate de que esa persona sepa que
                diste su teléfono.
              </p>

              <p className="font-medium text-foreground pt-2">Fotos y comprobantes</p>
              <p>
                La foto de perfil o de participante que subas, y el comprobante de pago cuando
                notificas tu inscripción. El comprobante puede contener datos bancarios tuyos: se
                guarda con acceso restringido al personal de finanzas y solo para verificar el
                pago.
              </p>

              <p className="font-medium text-foreground pt-2">Durante la carrera</p>
              <p>
                Dorsal, vueltas completadas, kilómetros y hora de cada paso por el arco, que se
                registran al escanear tu código QR. Es el resultado deportivo del evento.
              </p>

              <p className="font-medium text-foreground pt-2">Mensajes y encuestas</p>
              <p>
                Los mensajes de ánimo que envías o recibes y las respuestas a las encuestas que
                decidas contestar.
              </p>

              <p className="font-medium text-foreground pt-2">Aplicación móvil BYSD Live</p>
              <p>
                Si permites las notificaciones, guardamos el identificador que Firebase asigna a
                esa instalación de la app, para poder enviarte los avisos de la carrera. No lleva
                tu nombre asociado más allá de las preferencias de a quién sigues. Puedes cortar
                el envío desactivando las notificaciones desde los ajustes del teléfono.
              </p>
              <p>
                La app pide permiso de <strong>cámara</strong> con un solo propósito: leer los
                códigos QR de los dorsales. Las imágenes se procesan en el momento dentro del
                teléfono, no se guardan ni se envían a ningún servidor.
              </p>
              <p>
                La app no recoge tu ubicación, no accede a tus contactos y no incluye publicidad
                ni herramientas de seguimiento o analítica de terceros.
              </p>
            </Seccion>

            <Seccion titulo="Qué se hace público">
              <p>
                Un evento deportivo es público por naturaleza. Al inscribirte, aparecen en el sitio
                y en la app tu nombre, tu dorsal, tu nacionalidad, tu foto de participante si la
                subiste y tus resultados (vueltas, kilómetros y posición). Esa misma información
                puede aparecer en las transmisiones, en las redes sociales del evento y en notas de
                prensa.
              </p>
              <p>
                Nunca se publican tu correo, tu teléfono, tu fecha de nacimiento, tus datos
                médicos, tu contacto de emergencia ni tus comprobantes de pago.
              </p>
            </Seccion>

            <Seccion titulo="Con quién se comparten">
              <p>
                No vendemos datos personales ni los cedemos con fines publicitarios. Los
                patrocinadores del evento no reciben datos de los atletas.
              </p>
              <p>
                Para que el sistema funcione nos apoyamos en proveedores que tratan datos por
                cuenta nuestra: <strong>Render</strong> (servidores del sitio),{' '}
                <strong>MongoDB Atlas</strong> (base de datos), <strong>Google Firebase</strong>{' '}
                (envío de notificaciones a la app) y <strong>Google Gmail</strong> (envío de los
                correos del evento). Cada uno trata la información únicamente para prestarnos ese
                servicio.
              </p>
              <p>
                También podemos entregar información cuando una autoridad competente la exija por
                ley, o cuando sea necesaria para atender una emergencia médica tuya durante el
                evento.
              </p>
            </Seccion>

            <Seccion titulo="Cuánto tiempo se conservan">
              <p>
                Los datos de tu cuenta se conservan mientras la mantengas abierta. Los resultados
                deportivos y el histórico de las ediciones se conservan de forma permanente, porque
                son el registro del evento: son los mismos que aparecen en las clasificaciones
                públicas.
              </p>
              <p>
                Los comprobantes de pago se conservan mientras duren las obligaciones contables de
                la organización.
              </p>
            </Seccion>

            <Seccion titulo="Tus derechos">
              <p>
                Puedes ver y corregir tus datos en cualquier momento desde{' '}
                <strong>Mi Perfil</strong>, tanto en el sitio como en la app.
              </p>
              <p>
                Puedes pedir que borremos tu cuenta y tus datos personales escribiendo a{' '}
                <a href={`mailto:${CORREO}`} className="text-primary hover:underline">{CORREO}</a>{' '}
                desde el correo con el que te registraste. Atendemos la solicitud en un plazo
                razonable. Ten en cuenta que los resultados de las carreras que ya corriste se
                mantienen como parte del registro histórico del evento.
              </p>
              <p>
                También puedes retirar tu consentimiento para las notificaciones (desactivándolas
                en el teléfono) o para los correos del evento (respondiendo al correo y
                pidiéndolo).
              </p>
            </Seccion>

            <Seccion titulo="Seguridad">
              <p>
                Las contraseñas se guardan cifradas, la comunicación con el sitio y la app viaja
                por conexión segura (HTTPS) y el panel de administración exige usuario, contraseña
                y permisos por área: quien atiende voluntarios no ve los datos médicos, y las
                fichas médicas solo las abre el personal autorizado durante el evento.
              </p>
              <p>
                Ningún sistema es infalible. Si detectáramos una brecha que afecte tus datos, te
                lo comunicaríamos por correo.
              </p>
            </Seccion>

            <Seccion titulo="Menores de edad">
              <p>
                El evento y estas plataformas están dirigidos a personas adultas. No recogemos
                datos de menores de 13 años a sabiendas. Si crees que un menor nos ha facilitado
                sus datos, escríbenos y los eliminaremos.
              </p>
            </Seccion>

            <Seccion titulo="Cambios en esta política">
              <p>
                Si cambiamos la forma en que tratamos los datos, actualizaremos esta página y la
                fecha del encabezado. Si el cambio es importante, lo avisaremos por correo a las
                personas inscritas.
              </p>
            </Seccion>

            <p className="text-sm text-muted-foreground text-center pt-2">
              ¿Dudas sobre tus datos? Escríbenos a{' '}
              <a href={`mailto:${CORREO}`} className="text-primary hover:underline">{CORREO}</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
