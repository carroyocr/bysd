import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, LogOut, Loader2, KeyRound, MailCheck, User, HeartPulse, CalendarClock,
  MapPin, IdCard, Edit2, UserPlus, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { guardarSesion, haySesion, sesionFetch } from '../lib/sesion';
import { cerrarSesionCuenta, entrar, reenviarCodigo, verificar } from '../lib/cuentaApi';

const API = process.env.REACT_APP_BACKEND_URL;
const MIN_PASSWORD = 8;

async function pedir(metodo, ruta, cuerpo) {
  try {
    const r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { detail: 'No se pudo conectar. Inténtalo de nuevo.' } };
  }
}

/** "2026-10-17" + "06:00:00" -> "sáb, 17 oct" y "06:00 – 10:00". */
function diaDelTurno(dia) {
  if (!dia) return '';
  const d = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
}

const soloHora = (hora) => (hora || '').slice(0, 5);
const esSi = (valor) => /^s[ií]$/i.test(valor || '');

/**
 * Acceso del voluntario: correo y contraseña.
 *
 * Antes este botón de la sección de Voluntarios mandaba un enlace al correo
 * para editar la postulación, y para ver los turnos asignados no había nada en
 * la web. Ahora se entra con la cuenta, la misma de la app.
 *
 * Quien todavía no tiene contraseña —se postuló y nunca se la puso— no se
 * queda en un "credenciales incorrectas": se le manda un código al correo y
 * con él elige la contraseña, que de paso deja el correo confirmado. Es el
 * mismo camino para quien la olvidó.
 */
function AccesoVoluntario({ aviso, onListo }) {
  // entrar | crear
  const [paso, setPaso] = useState('entrar');
  const [olvido, setOlvido] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [sinRegistro, setSinRegistro] = useState(false);

  const correo = email.trim().toLowerCase();

  const mandarCodigo = async () => {
    const { ok, data } = await pedir('POST', '/api/staff/password/request-code', { email: correo });
    if (!ok) { setError(data.detail || 'No se pudo enviar el código'); return false; }
    return true;
  };

  const irACrear = async (porOlvido) => {
    setOcupado(true);
    setError('');
    setNota('');
    const enviado = await mandarCodigo();
    setOcupado(false);
    if (!enviado) return;
    setOlvido(porOlvido);
    setCodigo('');
    // La que ya escribió vale como propuesta si da la talla; si no, que elija.
    if (porOlvido || password.length < MIN_PASSWORD) setPassword('');
    setPassword2('');
    setPaso('crear');
  };

  const ingresar = async (e) => {
    e.preventDefault();
    setError('');
    setNota('');
    setSinRegistro(false);
    if (!correo || !password) { setError('Escribe tu correo y tu contraseña.'); return; }

    setOcupado(true);
    // Antes de probar la contraseña: quien nunca se puso una no tiene nada
    // que acertar, y decirle "incorrecta" lo dejaría dando vueltas.
    const { ok, data: estado } = await pedir(
      'GET', `/api/staff/account-status?email=${encodeURIComponent(correo)}`,
    );
    if (ok && !estado.es_voluntario && !estado.tiene_cuenta) {
      setOcupado(false);
      setSinRegistro(true);
      return;
    }
    if (ok && !estado.tiene_password) {
      setOcupado(false);
      await irACrear(false);
      return;
    }

    try {
      await entrar({ email: correo, password });
      onListo();
    } catch (err) {
      setError(err.message === 'Credenciales incorrectas'
        ? 'La contraseña no es correcta.'
        : err.message);
    } finally {
      setOcupado(false);
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    setNota('');
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== password2) { setError('Las dos contraseñas no coinciden.'); return; }

    setOcupado(true);
    const { ok, data } = await pedir('POST', '/api/staff/password/set', {
      email: correo, code: codigo.trim(), password,
    });
    setOcupado(false);
    if (!ok) { setError(data.detail || 'No se pudo guardar la contraseña'); return; }
    guardarSesion(data);
    onListo();
  };

  const otroCodigo = async () => {
    setOcupado(true);
    setError('');
    const enviado = await mandarCodigo();
    setOcupado(false);
    if (enviado) setNota(`Te enviamos otro código a ${correo}.`);
  };

  if (paso === 'crear') {
    return (
      <form onSubmit={crear} className="space-y-4" data-testid="voluntario-crear-clave">
        <p className="text-sm text-muted-foreground">
          {olvido
            ? `Te enviamos un código a ${correo}. Escríbelo y elige tu contraseña nueva.`
            : `Tu correo todavía no tiene contraseña. Te enviamos un código a ${correo}: `
              + 'escríbelo para confirmar que es tuyo y elige la contraseña con la que vas a entrar.'}
        </p>
        <div>
          <label className="text-sm font-medium" htmlFor="voluntario-codigo">Código</label>
          <Input
            id="voluntario-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="voluntario-clave-nueva">Contraseña</label>
          <Input
            id="voluntario-clave-nueva"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Al menos ${MIN_PASSWORD} caracteres`}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="voluntario-clave-repetida">Repite la contraseña</label>
          <Input
            id="voluntario-clave-repetida"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {nota && <p className="text-sm text-green-700">{nota}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={ocupado || codigo.trim().length < 6} className="w-full">
          {ocupado
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
            : <><KeyRound className="w-4 h-4 mr-2" />Guardar contraseña e ingresar</>}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={otroCodigo}>
            Enviarme otro código
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setPaso('entrar'); setError(''); setNota(''); setPassword(''); }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={ingresar} className="space-y-4" data-testid="voluntario-ingresar">
      <p className="text-sm text-muted-foreground">
        Entra con el correo con el que te postulaste para ver tus datos y los
        turnos que te asignaron.
      </p>
      {aviso && <p className="text-sm text-amber-700">{aviso}</p>}

      <div>
        <label className="text-sm font-medium" htmlFor="voluntario-email">Correo</label>
        <Input
          id="voluntario-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSinRegistro(false); }}
          placeholder="tu@correo.com"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="voluntario-password">Contraseña</label>
        <Input
          id="voluntario-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Si todavía no tienes contraseña, escribe la que quieras usar: te
          pediremos confirmar tu correo con un código.
        </p>
      </div>

      {sinRegistro && (
        <div className="text-sm text-red-600 space-y-2">
          <p>Ese correo no está registrado como voluntario.</p>
          <Link to="/voluntarios/registro" className="inline-flex items-center text-primary underline">
            <UserPlus className="w-4 h-4 mr-1" />
            Postular como voluntario
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={ocupado} className="w-full">
        {ocupado
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Un momento…</>
          : <><LogIn className="w-4 h-4 mr-2" />Ingresar</>}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={ocupado}
        onClick={() => {
          if (!correo) { setError('Escribe primero tu correo.'); return; }
          irACrear(true);
        }}
      >
        Olvidé mi contraseña
      </Button>
    </form>
  );
}

/**
 * La cuenta tiene contraseña pero el correo está sin confirmar: es la de quien
 * se dio de alta como staff en la app. Ya entró, así que basta el código.
 */
function ConfirmarCorreo({ email, onListo }) {
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');

  const confirmar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setError('');
    setNota('');
    try {
      await verificar({ email, code: codigo.trim() });
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const otroCodigo = async () => {
    setError('');
    try {
      await reenviarCodigo(email);
      setNota(`Te enviamos otro código a ${email}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="border-amber-300" data-testid="voluntario-confirmar-correo">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MailCheck className="w-5 h-5 text-amber-600" />
          Confirma tu correo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Te enviamos un código de seis dígitos a {email}. Escríbelo para ver tu
          ficha de voluntario y tus turnos.
        </p>
        <form onSubmit={confirmar} className="flex gap-2">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button type="submit" disabled={ocupado || codigo.trim().length < 6}>
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </Button>
        </form>
        <Button variant="ghost" size="sm" onClick={otroCodigo}>Enviarme otro código</Button>
        {nota && <p className="text-sm text-green-700">{nota}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Dato({ etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-b-0 border-border">
      <span className="text-sm text-muted-foreground shrink-0">{etiqueta}</span>
      <span className="text-sm font-medium text-right">{valor}</span>
    </div>
  );
}

function FichaVoluntario({ datos, postulaciones }) {
  const p = datos.perfil;
  const turnos = datos.turnos || [];
  const [bajando, setBajando] = useState(false);
  const [errorCarnet, setErrorCarnet] = useState('');

  const descargarCarnet = async () => {
    setBajando(true);
    setErrorCarnet('');
    try {
      const r = await sesionFetch(`${API}/api/staff/mi-perfil/carnet`);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'carnet-staff.pdf';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorCarnet('No se pudo descargar el carnet. Inténtalo de nuevo.');
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      {/* Tres pestañas en vez de tarjetas una debajo de otra: en el teléfono
          había que bajar tres pantallas para llegar a los turnos. */}
      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto bg-muted/50 p-1">
          <TabsTrigger
            value="datos"
            className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-card data-[state=active]:text-foreground"
            data-testid="voluntario-tab-datos"
          >
            <User className="w-4 h-4 shrink-0" />
            Mis datos
          </TabsTrigger>
          <TabsTrigger
            value="salud"
            className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-card data-[state=active]:text-foreground"
            data-testid="voluntario-tab-salud"
          >
            <HeartPulse className="w-4 h-4 shrink-0" />
            Salud y emergencia
          </TabsTrigger>
          <TabsTrigger
            value="turnos"
            className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-card data-[state=active]:text-foreground"
            data-testid="voluntario-tab-turnos"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>
              Turnos asignados
              {turnos.length > 0 && <span className="opacity-60 font-normal"> · {turnos.length}</span>}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <Card data-testid="voluntario-datos">
            <CardContent className="pt-6">
              <Dato etiqueta="Nombre" valor={`${p.nombre || ''} ${p.apellidos || ''}`.trim()} />
              <Dato etiqueta="Correo" valor={p.email} />
              <Dato etiqueta="Teléfono" valor={p.telefono} />
              <Dato etiqueta="Fecha de nacimiento" valor={p.fecha_nacimiento} />
              <Dato etiqueta="Sexo" valor={p.sexo} />
              <Dato etiqueta="Nacionalidad" valor={p.nacionalidad} />
              <Dato etiqueta="Ciudad" valor={p.ciudad_residencia} />
              <Dato etiqueta="Talla de camiseta" valor={p.talla_camiseta} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salud" className="mt-4">
          <Card data-testid="voluntario-salud">
            <CardContent className="pt-6">
              <Dato etiqueta="Tipo de sangre" valor={p.tipo_sangre} />
              <Dato
                etiqueta="Condición médica"
                valor={esSi(p.condicion_medica) ? (p.condicion_medica_detalle || 'Sí') : 'No'}
              />
              <Dato
                etiqueta="Alergias"
                valor={esSi(p.alergias) ? (p.alergias_detalle || 'Sí') : 'No'}
              />
              <Dato
                etiqueta="Contacto de emergencia"
                valor={[p.contacto_emergencia_nombre, p.contacto_emergencia_relacion].filter(Boolean).join(' · ')}
              />
              <Dato etiqueta="Teléfono de emergencia" valor={p.contacto_emergencia_telefono} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turnos" className="mt-4">
          <Card data-testid="voluntario-turnos">
            <CardContent className="pt-6">
              {turnos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no tienes turnos asignados. La organización te avisará por
                  correo cuando los confirme.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {turnos.map((t) => (
                    <div key={t.slot_id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-semibold capitalize">{diaDelTurno(t.dia)}</p>
                      <p className="text-sm text-muted-foreground">
                        {soloHora(t.hora_inicio)} – {soloHora(t.hora_fin)}
                        {t.turno ? ` · Turno ${t.turno}` : ''}
                      </p>
                      <p className="text-sm mt-1 flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{t.puesto}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fuera de las pestañas: el carnet y la edición valen para las tres. */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={descargarCarnet} disabled={bajando}>
            {bajando
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <IdCard className="w-4 h-4 mr-2" />}
            Descargar mi carnet (PDF)
          </Button>
          {postulaciones.map((post) => (
            <Link key={post.evento} to={`/voluntarios/registro?token=${post.edit_token}`}>
              <Button variant="outline" data-testid={`voluntario-editar-${post.evento}`}>
                <Edit2 className="w-4 h-4 mr-2" />
                {postulaciones.length > 1
                  ? `Editar mi postulación de ${post.evento_nombre}`
                  : 'Editar mi postulación'}
              </Button>
            </Link>
          ))}
        </div>
        {errorCarnet && <p className="text-sm text-red-600">{errorCarnet}</p>}
        <p className="text-xs text-muted-foreground">
          Desde «Editar mi postulación» puedes corregir tus datos y cambiar los
          turnos que pediste.
        </p>
      </div>
    </>
  );
}

/**
 * A donde lleva «Ingresar» en la sección de Voluntarios: el acceso y, ya
 * dentro, los datos del voluntario y sus turnos asignados.
 */
export default function VoluntarioPerfilPage() {
  // undefined = cargando · null = sin sesión que valga aquí · objeto = perfil
  const [datos, setDatos] = useState(undefined);
  const [postulaciones, setPostulaciones] = useState([]);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    if (!haySesion()) { setDatos(null); return; }
    setDatos(undefined);

    let r;
    try {
      r = await sesionFetch(`${API}/api/staff/mi-perfil`);
    } catch {
      setAviso('No se pudo conectar. Inténtalo de nuevo.');
      setDatos(null);
      return;
    }

    if (r.status === 401) {
      // Sesión caducada: se limpia para que el acceso empiece de cero.
      cerrarSesionCuenta();
      setDatos(null);
      return;
    }
    if (r.status === 403) {
      // Hay sesión, pero de una cuenta que no es del equipo (o que lo es desde
      // hace poco y entró antes). No se le cierra: puede ser la del corredor.
      setAviso('La sesión que tienes abierta no es de voluntario. Entra con el correo con el que te postulaste.');
      setDatos(null);
      return;
    }
    if (!r.ok) {
      setAviso('No se pudo cargar tu perfil. Inténtalo de nuevo.');
      setDatos(null);
      return;
    }

    const perfil = await r.json();
    if (perfil.sesion_caducada) {
      cerrarSesionCuenta();
      setAviso('Tu contraseña cambió después de abrir esta sesión. Entra otra vez.');
      setDatos(null);
      return;
    }

    setAviso('');
    setDatos(perfil);

    if (perfil.perfil) {
      try {
        const rp = await sesionFetch(`${API}/api/staff/mi-perfil/postulaciones`);
        setPostulaciones(rp.ok ? ((await rp.json()).postulaciones || []) : []);
      } catch {
        setPostulaciones([]);
      }
    } else {
      setPostulaciones([]);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const salir = () => {
    cerrarSesionCuenta();
    setAviso('');
    setPostulaciones([]);
    setDatos(null);
  };

  if (datos === undefined) {
    return (
      <div className="pt-24 pb-16 flex justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-primary" />
                Ingresar como voluntario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AccesoVoluntario aviso={aviso} onListo={cargar} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const p = datos.perfil;

  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : 'Mi perfil de voluntario'}
            </h1>
            <p className="text-sm text-muted-foreground">{datos.username}</p>
          </div>
          <Button variant="outline" size="sm" onClick={salir} data-testid="voluntario-salir">
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>

        {datos.verificacion_pendiente && (
          <ConfirmarCorreo email={datos.username} onListo={cargar} />
        )}

        {!p && !datos.verificacion_pendiente && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-semibold">Sin postulación de voluntario</p>
              <p className="text-sm text-muted-foreground">
                Esta cuenta no tiene una postulación de voluntario asociada, así
                que no hay datos ni turnos que mostrar.
              </p>
              <Link to="/voluntarios/registro">
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Postular como voluntario
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {p && <FichaVoluntario datos={datos} postulaciones={postulaciones} />}
      </div>
    </div>
  );
}
