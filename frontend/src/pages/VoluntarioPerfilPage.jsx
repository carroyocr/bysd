import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, LogOut, Loader2, KeyRound, MailCheck, User, HeartPulse, CalendarClock,
  MapPin, IdCard, Edit2, UserPlus, ArrowLeft, Save, CheckCircle2, X, Plus, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { guardarSesion, haySesion, sesionFetch } from '../lib/sesion';
import { cerrarSesionCuenta, entrar, reenviarCodigo, verificar } from '../lib/cuentaApi';
import { COUNTRIES } from '../data/countries';

const API = process.env.REACT_APP_BACKEND_URL;
const MIN_PASSWORD = 8;
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TIPOS_DE_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];

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

const CAMPO_SELECT = 'w-full h-10 px-3 rounded-md border border-input bg-background text-sm';

function Campo({ id, etiqueta, children }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}

/** Cabecera de una tarjeta de datos: el título y, a la derecha, «Editar». */
function CabeceraTarjeta({ titulo, editando, onEditar, testId }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {!editando && (
        <Button variant="outline" size="sm" onClick={onEditar} data-testid={testId}>
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
      )}
    </div>
  );
}

function BotonesDeEdicion({ guardando, onCancelar }) {
  return (
    <div className="flex gap-2 pt-1">
      <Button type="submit" disabled={guardando}>
        {guardando
          ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          : <Save className="w-4 h-4 mr-2" />}
        Guardar
      </Button>
      <Button type="button" variant="outline" disabled={guardando} onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}

/** Manda a guardar solo los campos de una tarjeta y devuelve la ficha como queda. */
async function guardarMisDatos(cambios) {
  let r;
  try {
    r = await sesionFetch(`${API}/api/staff/mi-perfil/datos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
  } catch {
    throw new Error('No se pudo conectar. Inténtalo de nuevo.');
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Los errores de validación llegan como lista; el resto, como texto.
    throw new Error(typeof datos.detail === 'string' ? datos.detail : 'Revisa los datos e inténtalo de nuevo.');
  }
  return datos.perfil;
}

function TarjetaDatos({ p, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const editar = () => {
    setF({
      nombre: p.nombre || '',
      apellidos: p.apellidos || '',
      telefono: p.telefono || '',
      fecha_nacimiento: p.fecha_nacimiento || '',
      sexo: p.sexo || '',
      nacionalidad: p.nacionalidad || '',
      ciudad_residencia: p.ciudad_residencia || '',
      talla_camiseta: p.talla_camiseta || '',
    });
    setError('');
    setEditando(true);
  };

  const cambiar = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.apellidos.trim() || !f.telefono.trim()) {
      setError('El nombre, los apellidos y el teléfono no pueden quedar vacíos.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      onGuardado(await guardarMisDatos(f));
      setEditando(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Hay fichas con la nacionalidad escrita de otra forma (un código, otro
  // nombre): se conserva como opción para no borrarla al guardar.
  const nacionalidadFueraDeLista = f.nacionalidad
    && !COUNTRIES.some((c) => c.name === f.nacionalidad);

  return (
    <Card data-testid="voluntario-datos">
      <CardContent className="pt-6">
        <CabeceraTarjeta
          titulo="Mis datos"
          editando={editando}
          onEditar={editar}
          testId="voluntario-editar-datos"
        />

        {!editando ? (
          <>
            <Dato etiqueta="Nombre" valor={`${p.nombre || ''} ${p.apellidos || ''}`.trim()} />
            <Dato etiqueta="Correo" valor={p.email} />
            <Dato etiqueta="Teléfono" valor={p.telefono} />
            <Dato etiqueta="Fecha de nacimiento" valor={p.fecha_nacimiento} />
            <Dato etiqueta="Sexo" valor={p.sexo} />
            <Dato etiqueta="Nacionalidad" valor={p.nacionalidad} />
            <Dato etiqueta="Ciudad" valor={p.ciudad_residencia} />
            <Dato etiqueta="Talla de camiseta" valor={p.talla_camiseta} />
          </>
        ) : (
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="datos-nombre" etiqueta="Nombre *">
                <Input id="datos-nombre" value={f.nombre} onChange={cambiar('nombre')} maxLength={80} />
              </Campo>
              <Campo id="datos-apellidos" etiqueta="Apellidos *">
                <Input id="datos-apellidos" value={f.apellidos} onChange={cambiar('apellidos')} maxLength={80} />
              </Campo>
              <Campo id="datos-telefono" etiqueta="Teléfono *">
                <Input id="datos-telefono" value={f.telefono} onChange={cambiar('telefono')} placeholder="Ej: 809-555-1234" maxLength={40} />
              </Campo>
              <Campo id="datos-nacimiento" etiqueta="Fecha de nacimiento">
                <Input id="datos-nacimiento" type="date" value={f.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} />
              </Campo>
              <Campo id="datos-sexo" etiqueta="Sexo">
                <select id="datos-sexo" className={CAMPO_SELECT} value={f.sexo} onChange={cambiar('sexo')}>
                  <option value="">Seleccionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  {f.sexo === 'Otro' && <option value="Otro">Otro</option>}
                </select>
              </Campo>
              <Campo id="datos-nacionalidad" etiqueta="Nacionalidad">
                <select id="datos-nacionalidad" className={CAMPO_SELECT} value={f.nacionalidad} onChange={cambiar('nacionalidad')}>
                  <option value="">Seleccionar país</option>
                  {nacionalidadFueraDeLista && <option value={f.nacionalidad}>{f.nacionalidad}</option>}
                  {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </Campo>
              <Campo id="datos-ciudad" etiqueta="Ciudad">
                <Input id="datos-ciudad" value={f.ciudad_residencia} onChange={cambiar('ciudad_residencia')} maxLength={80} />
              </Campo>
              <Campo id="datos-talla" etiqueta="Talla de camiseta">
                <select id="datos-talla" className={CAMPO_SELECT} value={f.talla_camiseta} onChange={cambiar('talla_camiseta')}>
                  <option value="">Seleccionar</option>
                  {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
            </div>
            <p className="text-xs text-muted-foreground">
              El correo no se cambia desde aquí: es con el que entras.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <BotonesDeEdicion guardando={guardando} onCancelar={() => setEditando(false)} />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TarjetaSalud({ p, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const editar = () => {
    setF({
      tipo_sangre: p.tipo_sangre || '',
      condicion_medica: esSi(p.condicion_medica) ? 'Sí' : 'No',
      condicion_medica_detalle: p.condicion_medica_detalle || '',
      alergias: esSi(p.alergias) ? 'Sí' : 'No',
      alergias_detalle: p.alergias_detalle || '',
      contacto_emergencia_nombre: p.contacto_emergencia_nombre || '',
      contacto_emergencia_relacion: p.contacto_emergencia_relacion || '',
      contacto_emergencia_telefono: p.contacto_emergencia_telefono || '',
    });
    setError('');
    setEditando(true);
  };

  const cambiar = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.contacto_emergencia_nombre.trim() || !f.contacto_emergencia_telefono.trim()) {
      setError('El contacto de emergencia necesita nombre y teléfono.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      onGuardado(await guardarMisDatos(f));
      setEditando(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const sangreFueraDeLista = f.tipo_sangre && !TIPOS_DE_SANGRE.includes(f.tipo_sangre);

  return (
    <Card data-testid="voluntario-salud">
      <CardContent className="pt-6">
        <CabeceraTarjeta
          titulo="Salud y emergencia"
          editando={editando}
          onEditar={editar}
          testId="voluntario-editar-salud"
        />

        {!editando ? (
          <>
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
          </>
        ) : (
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="salud-sangre" etiqueta="Tipo de sangre">
                <select id="salud-sangre" className={CAMPO_SELECT} value={f.tipo_sangre} onChange={cambiar('tipo_sangre')}>
                  <option value="">Seleccionar</option>
                  {sangreFueraDeLista && <option value={f.tipo_sangre}>{f.tipo_sangre}</option>}
                  {TIPOS_DE_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
              <div className="hidden sm:block" />

              <Campo id="salud-condicion" etiqueta="¿Tienes alguna condición médica?">
                <select id="salud-condicion" className={CAMPO_SELECT} value={f.condicion_medica} onChange={cambiar('condicion_medica')}>
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </Campo>
              {f.condicion_medica === 'Sí' ? (
                <Campo id="salud-condicion-detalle" etiqueta="¿Cuál?">
                  <Input id="salud-condicion-detalle" value={f.condicion_medica_detalle} onChange={cambiar('condicion_medica_detalle')} maxLength={500} />
                </Campo>
              ) : <div className="hidden sm:block" />}

              <Campo id="salud-alergias" etiqueta="¿Tienes alergias?">
                <select id="salud-alergias" className={CAMPO_SELECT} value={f.alergias} onChange={cambiar('alergias')}>
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </Campo>
              {f.alergias === 'Sí' ? (
                <Campo id="salud-alergias-detalle" etiqueta="¿A qué?">
                  <Input id="salud-alergias-detalle" value={f.alergias_detalle} onChange={cambiar('alergias_detalle')} maxLength={500} />
                </Campo>
              ) : <div className="hidden sm:block" />}

              <Campo id="salud-contacto" etiqueta="Contacto de emergencia *">
                <Input id="salud-contacto" value={f.contacto_emergencia_nombre} onChange={cambiar('contacto_emergencia_nombre')} placeholder="Nombre completo" maxLength={120} />
              </Campo>
              <Campo id="salud-relacion" etiqueta="Relación">
                <Input id="salud-relacion" value={f.contacto_emergencia_relacion} onChange={cambiar('contacto_emergencia_relacion')} placeholder="Ej: Familiar, Amigo" maxLength={60} />
              </Campo>
              <Campo id="salud-telefono" etiqueta="Teléfono de emergencia *">
                <Input id="salud-telefono" value={f.contacto_emergencia_telefono} onChange={cambiar('contacto_emergencia_telefono')} placeholder="Ej: 809-555-1234" maxLength={40} />
              </Campo>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <BotonesDeEdicion guardando={guardando} onCancelar={() => setEditando(false)} />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Una fila de turno: día, horario y puesto a la izquierda; sus botones a la derecha. */
function FilaTurno({ turno, children }) {
  return (
    <div
      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      data-testid={`voluntario-turno-${turno.slot_id}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold capitalize">{diaDelTurno(turno.dia)}</p>
        <p className="text-sm text-muted-foreground">
          {soloHora(turno.hora_inicio)} – {soloHora(turno.hora_fin)}
          {turno.turno ? ` · Turno ${turno.turno}` : ''}
        </p>
        <p className="text-sm mt-1 flex items-start gap-1.5">
          <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>{turno.puesto}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

function BotonCancelar({ ocupado, girando, onClick, testId }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
      disabled={ocupado}
      onClick={onClick}
      data-testid={testId}
    >
      {girando
        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        : <X className="w-4 h-4 mr-2" />}
      Cancelar
    </Button>
  );
}

/** Los turnos disponibles, juntos por puesto y en el orden en que llegan. */
function agruparPorPuesto(turnos) {
  const grupos = new Map();
  turnos.forEach((t) => {
    if (!grupos.has(t.puesto)) grupos.set(t.puesto, { puesto: t.puesto, descripcion: t.descripcion, turnos: [] });
    grupos.get(t.puesto).turnos.push(t);
  });
  return [...grupos.values()].sort((a, b) => a.puesto.localeCompare(b.puesto, 'es'));
}

function SeccionTurnos({ titulo, nota, testId, children }) {
  return (
    <section className="pt-5 first:pt-0" data-testid={testId}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {nota && <p className="text-sm text-muted-foreground mt-1">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * La pestaña «Turnos»: se elige el evento y, dentro, hasta tres secciones.
 *
 * - **Solicitados**: los que pidió y la organización aún no le asignó. Se
 *   pueden cancelar.
 * - **Asignados**: los que ya son suyos. «Confirmar» es reconfirmar que va
 *   —entre que se asigna un turno y llega el evento pasan semanas, y así la
 *   organización sabe con quién sigue contando—; «Cancelar» lo deja libre.
 * - **Disponibles**: los que puede pedir.
 *
 * Cada sección sale solo si tiene algo dentro. Tras cada acción se vuelve a
 * pedir todo al servidor: pedir o soltar un turno cambia también lo que queda
 * disponible, y recalcularlo aquí sería adivinar.
 */
function TarjetaTurnos({ onAsignadosCambian }) {
  // undefined = cargando · [] = sin postulaciones
  const [eventos, setEventos] = useState(undefined);
  const [elegido, setElegido] = useState(null);
  // { id, accion } del turno sobre el que se está actuando
  const [enCurso, setEnCurso] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await sesionFetch(`${API}/api/staff/mi-perfil/turnos`);
      if (!r.ok) throw new Error();
      const lista = (await r.json()).eventos || [];
      setEventos(lista);
      setElegido((actual) => (lista.some((e) => e.evento === actual) ? actual : (lista[0]?.evento || null)));
      onAsignadosCambian(lista.flatMap((e) => e.asignados));
    } catch {
      setEventos((actual) => actual || []);
      setAviso({ tipo: 'error', texto: 'No se pudieron cargar los turnos. Inténtalo de nuevo.' });
    }
  }, [onAsignadosCambian]);

  useEffect(() => { cargar(); }, [cargar]);

  const ACCIONES = {
    confirmar: { metodo: 'POST', ruta: (id) => `/turnos/${id}/confirmar`, listo: 'Turno confirmado. Gracias: contamos contigo.' },
    cancelar: { metodo: 'DELETE', ruta: (id) => `/turnos/${id}`, listo: 'Turno cancelado. Quedó libre para otro voluntario.' },
    solicitar: { metodo: 'POST', ruta: (id) => `/turnos/${id}/solicitar`, listo: 'Turno solicitado. La organización confirmará la asignación.' },
    retirar: { metodo: 'DELETE', ruta: (id) => `/turnos/${id}/solicitud`, listo: 'Solicitud cancelada.' },
  };

  const actuar = async (turno, accion) => {
    const { metodo, ruta, listo } = ACCIONES[accion];
    setEnCurso({ id: turno.slot_id, accion });
    setAviso(null);
    let r;
    try {
      r = await sesionFetch(`${API}/api/staff/mi-perfil${ruta(turno.slot_id)}`, { method: metodo });
    } catch {
      setEnCurso(null);
      setAviso({ tipo: 'error', texto: 'No se pudo conectar. Inténtalo de nuevo.' });
      return;
    }
    const datos = await r.json().catch(() => ({}));
    await cargar();
    setEnCurso(null);
    setAviso(r.ok
      ? { tipo: 'ok', texto: listo }
      : { tipo: 'error', texto: typeof datos.detail === 'string' ? datos.detail : 'No se pudo completar. Inténtalo de nuevo.' });
  };

  const cancelarAsignado = (turno) => {
    if (!window.confirm(`¿Cancelar tu turno de ${turno.puesto}? Quedará libre para otro voluntario.`)) return;
    actuar(turno, 'cancelar');
  };

  const haciendo = (turno, accion) => enCurso?.id === turno.slot_id && enCurso.accion === accion;
  const evento = (eventos || []).find((e) => e.evento === elegido);

  return (
    <Card data-testid="voluntario-turnos">
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold mb-3">Turnos</h2>

        {eventos === undefined && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {eventos && eventos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Evento">
            {eventos.map((e) => (
              <Button
                key={e.evento}
                size="sm"
                variant={e.evento === elegido ? 'default' : 'outline'}
                onClick={() => { setElegido(e.evento); setAviso(null); }}
                title={e.nombre}
                data-testid={`voluntario-evento-${e.evento}`}
              >
                {e.etiqueta}
              </Button>
            ))}
          </div>
        )}

        {evento && (
          <div className="divide-y divide-border space-y-5">
            {evento.solicitados.length > 0 && (
              <SeccionTurnos
                titulo="Turnos solicitados"
                nota="Los pediste y están pendientes de que la organización los asigne."
                testId="voluntario-turnos-solicitados"
              >
                <div className="divide-y divide-border">
                  {evento.solicitados.map((t) => (
                    <FilaTurno key={t.slot_id} turno={t}>
                      <BotonCancelar
                        ocupado={!!enCurso}
                        girando={haciendo(t, 'retirar')}
                        onClick={() => actuar(t, 'retirar')}
                        testId={`voluntario-retirar-${t.slot_id}`}
                      />
                    </FilaTurno>
                  ))}
                </div>
              </SeccionTurnos>
            )}

            {evento.asignados.length > 0 && (
              <SeccionTurnos
                titulo="Turnos asignados"
                nota="Confirma cada uno para que sepamos que contamos contigo. Si no puedes cubrirlo, cancélalo."
                testId="voluntario-turnos-asignados"
              >
                <div className="divide-y divide-border">
                  {evento.asignados.map((t) => (
                    <FilaTurno key={t.slot_id} turno={t}>
                      {t.confirmado ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 px-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!!enCurso}
                          onClick={() => actuar(t, 'confirmar')}
                          data-testid={`voluntario-confirmar-${t.slot_id}`}
                        >
                          {haciendo(t, 'confirmar')
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Confirmar
                        </Button>
                      )}
                      <BotonCancelar
                        ocupado={!!enCurso}
                        girando={haciendo(t, 'cancelar')}
                        onClick={() => cancelarAsignado(t)}
                        testId={`voluntario-cancelar-${t.slot_id}`}
                      />
                    </FilaTurno>
                  ))}
                </div>
              </SeccionTurnos>
            )}

            {evento.disponibles.length > 0 && (
              <SeccionTurnos
                titulo="Turnos disponibles"
                nota="Pide los que puedas cubrir. Es una solicitud: la organización confirma después."
                testId="voluntario-turnos-disponibles"
              >
                {/* Por puesto y plegados: en un evento con todo por cubrir son
                    decenas de turnos, y sueltos tapaban lo demás. */}
                <div className="space-y-2">
                  {agruparPorPuesto(evento.disponibles).map((grupo) => (
                    <details
                      key={grupo.puesto}
                      className="rounded-lg border border-border px-3 group"
                      data-testid="voluntario-puesto-disponible"
                    >
                      <summary className="cursor-pointer list-none py-3 flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{grupo.puesto}</span>
                          <span className="block text-xs text-muted-foreground">
                            {grupo.turnos.length} turno{grupo.turnos.length === 1 ? '' : 's'} con plazas
                          </span>
                        </span>
                        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      {grupo.descripcion && (
                        <p className="text-sm text-muted-foreground pb-3">{grupo.descripcion}</p>
                      )}
                      <div className="divide-y divide-border border-t border-border pt-3 pb-3">
                        {grupo.turnos.map((t) => (
                          <FilaTurno key={t.slot_id} turno={t}>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!enCurso}
                              onClick={() => actuar(t, 'solicitar')}
                              data-testid={`voluntario-solicitar-${t.slot_id}`}
                            >
                              {haciendo(t, 'solicitar')
                                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                : <Plus className="w-4 h-4 mr-2" />}
                              Solicitar
                            </Button>
                          </FilaTurno>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </SeccionTurnos>
            )}

            {evento.solicitados.length + evento.asignados.length + evento.disponibles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay turnos para {evento.nombre} por ahora.
              </p>
            )}
          </div>
        )}

        {eventos && eventos.length === 0 && !aviso && (
          <p className="text-sm text-muted-foreground">No tienes postulaciones con turnos.</p>
        )}

        {aviso && (
          <p className={`text-sm mt-4 ${aviso.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
            {aviso.texto}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FichaVoluntario({ datos, onPerfil, onTurnos }) {
  const p = datos.perfil;
  const sinConfirmar = (datos.turnos || []).filter((t) => !t.confirmado).length;
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

  const pestana = 'flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm whitespace-normal '
    + 'data-[state=active]:bg-card data-[state=active]:text-foreground';

  return (
    <>
      {/* Tres pestañas en vez de tarjetas una debajo de otra: en el teléfono
          había que bajar tres pantallas para llegar a los turnos. */}
      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto bg-muted/50 p-1">
          <TabsTrigger value="datos" className={pestana} data-testid="voluntario-tab-datos">
            <User className="w-4 h-4 shrink-0" />
            Mis datos
          </TabsTrigger>
          <TabsTrigger value="salud" className={pestana} data-testid="voluntario-tab-salud">
            <HeartPulse className="w-4 h-4 shrink-0" />
            Salud y emergencia
          </TabsTrigger>
          <TabsTrigger value="turnos" className={pestana} data-testid="voluntario-tab-turnos">
            <CalendarClock className="w-4 h-4 shrink-0" />
            Turnos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <TarjetaDatos p={p} onGuardado={onPerfil} />
        </TabsContent>

        <TabsContent value="salud" className="mt-4">
          <TarjetaSalud p={p} onGuardado={onPerfil} />
        </TabsContent>

        <TabsContent value="turnos" className="mt-4">
          <TarjetaTurnos onAsignadosCambian={onTurnos} />
        </TabsContent>
      </Tabs>

      {sinConfirmar > 0 && (
        <p className="text-sm text-amber-700" data-testid="voluntario-turnos-por-confirmar">
          Tienes {sinConfirmar} turno{sinConfirmar === 1 ? '' : 's'} por confirmar en la
          pestaña «Turnos».
        </p>
      )}

      {/* Fuera de las pestañas: el carnet vale para las tres. */}
      <div className="space-y-3">
        <Button variant="outline" onClick={descargarCarnet} disabled={bajando}>
          {bajando
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <IdCard className="w-4 h-4 mr-2" />}
          Descargar mi carnet (PDF)
        </Button>
        {errorCarnet && <p className="text-sm text-red-600">{errorCarnet}</p>}
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
  }, []);

  // La pestaña de turnos avisa de cómo quedan los asignados tras cada acción,
  // para que el aviso de «por confirmar» no se quede atrás.
  const alCambiarAsignados = useCallback(
    (turnos) => setDatos((d) => (d ? { ...d, turnos } : d)),
    [],
  );

  useEffect(() => { cargar(); }, [cargar]);

  const salir = () => {
    cerrarSesionCuenta();
    setAviso('');
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

        {p && (
          <FichaVoluntario
            datos={datos}
            onPerfil={(perfil) => setDatos((d) => ({ ...d, perfil }))}
            onTurnos={alCambiarAsignados}
          />
        )}
      </div>
    </div>
  );
}
