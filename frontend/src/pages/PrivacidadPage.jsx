import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// Política de privacidad del sitio y de la app BYSD Live.
//
// Google Play exige una URL pública con esta política y que lo que diga aquí
// cuadre con el formulario de "Seguridad de los datos" de la ficha. Por eso
// esta página describe lo que el sistema recoge de verdad (los campos de
// `RegistrationBase`, `AthleteRegisterRequest` y la colección `accounts`, los
// tokens de `push_devices`, los archivos en GridFS): si mañana se agrega un
// dato nuevo al formulario de inscripción, hay que actualizar esta página y el
// formulario de Play.
const ACTUALIZADA = '16 de agosto de 2026';
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
              <p className="font-medium text-foreground">Ver la carrera no pide nada</p>
              <p>
                Seguir la carrera en vivo, mirar la lista de corredores, las vueltas, la
                clasificación, las fotos y los mensajes no requiere cuenta ni registro. Puedes
                usar el sitio y la app sin decirnos quién eres.
              </p>

              <p className="font-medium text-foreground pt-2">Cuenta de espectador</p>
              <p>
                Si quieres enviar un mensaje de ánimo, seguir a un corredor o recibir avisos
                cuando pase por meta, te pedimos <strong>correo, nombre y una contraseña</strong>.
                Nada más, y no hay ningún código que confirmar: la cuenta de espectador no da
                acceso a nada que no sea ya público, así que no te hacemos pasar por un trámite
                sin motivo. El nombre es el que firma tus mensajes; el correo sirve para
                identificarte, recuperar tu contraseña y, solo si lo aceptas, enviarte avisos de
                la carrera. La contraseña se guarda cifrada.
              </p>
              <p>
                Guardamos también <strong>a qué corredores sigues</strong>, para poder avisarte
                de sus vueltas, y la fecha de tu última entrada. Si quieres, puedes añadir tu
                país y de qué conoces la carrera: son opcionales, los rellenas después desde tu
                perfil y puedes dejarlos vacíos o borrarlos cuando quieras.
              </p>
              <p>
                La casilla para recibir avisos por correo va <strong>aparte del registro y sin
                marcar</strong>: tener cuenta no es haber aceptado que te escribamos. Esa casilla
                es lo único que decide si te escribimos, y puedes desmarcarla en cualquier
                momento desde tu perfil.
              </p>
              <p>
                Si en algún momento tu cuenta pasa a ser también de corredor o de personal del
                evento, entonces sí te pediremos confirmar el correo con un código: a partir de
                ahí hay inscripciones, pagos y datos médicos detrás, y necesitamos estar seguros
                de que la dirección es tuya.
              </p>

              <p className="font-medium text-foreground pt-2">Cuenta de atleta</p>
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
                Los mensajes de ánimo son públicos y van firmados con el nombre de quien los
                escribe: es un hilo abierto que leen los corredores y el resto del público. Del
                espectador no se publica nada más — ni el correo, ni a quién sigue, ni si tiene
                cuenta.
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
              <p>
                La cuenta de espectador se conserva mientras la mantengas abierta, y puedes
                borrarla tú desde tu perfil. Al borrarla desaparecen tu correo, tu nombre y la
                lista de a quién seguías. Los mensajes de ánimo que hubieras escrito se quedan
                en el hilo público con el nombre con el que los firmaste, porque forman parte de
                conversaciones de otras personas y borrarlos dejaría huecos; si quieres que
                retiremos alguno en concreto, escríbenos.
              </p>
            </Seccion>

            <Seccion titulo="Tus derechos">
              <p>
                Puedes ver y corregir tus datos en cualquier momento desde{' '}
                <strong>Mi Perfil</strong>, tanto en el sitio como en la app.
              </p>
              <p>
                Si tienes <strong>cuenta de espectador</strong>, puedes borrarla tú mismo desde
                tu perfil, sin pedírselo a nadie y sin esperar.
              </p>
              <p>
                Si tienes <strong>cuenta de atleta</strong>, pide que borremos tu cuenta y tus
                datos personales escribiendo a{' '}
                <a href={`mailto:${CORREO}`} className="text-primary hover:underline">{CORREO}</a>{' '}
                desde el correo con el que te registraste. No es un botón porque detrás hay
                inscripciones, pagos y resultados que no se pueden deshacer solos. Atendemos la
                solicitud en un plazo razonable. Ten en cuenta que los resultados de las carreras
                que ya corriste se mantienen como parte del registro histórico del evento.
              </p>
              <p>
                También puedes retirar tu consentimiento para las notificaciones (desactivándolas
                en el teléfono) o para los correos del evento: si tienes cuenta de espectador,
                desmarcando la casilla en tu perfil; en los demás casos, respondiendo al correo y
                pidiéndolo.
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
