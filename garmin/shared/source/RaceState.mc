using Toybox.Application as App;
using Toybox.Activity as Activity;
using Toybox.Lang as Lang;
using Toybox.Time as Time;
using Toybox.System as Sys;
using Toybox.Math as Math;

// La carrera, contada por el reloj de pared.
//
// Las campanas de una backyard suenan a la hora en punto, no cuando el
// corredor pulso START. Por eso al dar la salida el cero se ancla a la marca
// de hora mas cercana: quien arranca a las 8:03 -o a las 7:58- corre igual su
// vuelta 1 de 8:00 a 9:00, y cualquier retraso en la salida queda corregido
// de raiz. A partir de ese ancla todo son diferencias en tiempo epoch, asi
// que un cambio de hora a mitad de carrera no mueve ninguna campana.
//
// El LAP del corredor no abre vueltas: las abre la hora. LAP marca que la
// vuelta TERMINO -llego a meta, empieza su descanso- y solo vale el primero
// de cada hora; los demas se ignoran.
//
// En el campo de datos no hay START que ancle: alli el cero sigue siendo el
// arranque de la actividad nativa, y esta misma clase sirve para los dos
// porque el ancla es opcional.
class RaceState {

    // El estandar de una backyard: una vuelta cada hora. La distancia es la del
    // formato clasico, 6.7 km, y como todo lo demas se puede cambiar desde el
    // telefono, porque cada carrera tiene su circuito.
    static const DURACION_VUELTA = 3600;
    static const KM_POR_VUELTA = 6.7;

    // Por debajo de este kilometraje el ritmo medio da tumbos y el margen
    // saltaria minutos enteros de una zancada a otra. Mejor un guion.
    static const KM_MINIMOS_PARA_MARGEN = 1.0;

    // Los tres avisos del corral, en segundos antes de la campana.
    static const AVISOS_CORRAL = [180, 120, 60];

    // Radio del punto de salida para la vuelta automatica, en metros. Mas
    // ancho que un arco de meta, mas estrecho que la zona de carpas.
    static const RADIO_SALIDA_M = 30.0;

    // --- ajustes, del telefono ---
    var duracionVuelta = DURACION_VUELTA;
    var kmPorVuelta = KM_POR_VUELTA;
    var avisoCorral = true;
    var autoLap = false;

    // El ancla: epoch de la campana de la vuelta 1. Solo la app lo pone, al
    // dar la salida; en el campo de datos se queda en null y manda la
    // actividad nativa.
    var campana0 = null;

    // La ultima vuelta cuyo termino ya se marco con LAP. Solo vale un LAP por
    // vuelta: el primero.
    var vueltaMarcada = 0;

    // Posiciones, en radianes: la ultima conocida y la de la salida.
    var _lat = null;
    var _lon = null;
    var _latSalida = null;
    var _lonSalida = null;

    // Calibracion: lo que midio el reloj en la ultima vuelta cerrada. El GPS
    // puede marcar 6.85 km en un circuito de 6.7, y sobre treinta vueltas esa
    // diferencia descuadra el margen.
    var kmMedidosUltimaVuelta = null;

    // Instantanea de la distancia de la actividad al empezar la vuelta actual.
    var _vueltaDeLaFoto = 0;
    var _metrosEnLaFoto = 0.0;

    function initialize() {
        leerAjustes();
    }

    function leerAjustes() {
        var minutos = _ajuste("lapMinutes", 60);
        if (minutos != null && minutos > 0) {
            duracionVuelta = minutos.toNumber() * 60;
        }

        // La distancia se escribe siempre en kilometros, y por eso la etiqueta
        // del ajuste lo dice. Es la unica asimetria con Fmt, que dibuja en la
        // unidad del reloj, y es deliberada: un ajuste que cambia de unidad
        // segun el reloj no tiene un valor por defecto correcto. Leyendolo en
        // la unidad del reloj, el 6.7 de fabrica se convertia en 6.7 millas
        // -10.8 km- para quien tuviera el reloj en imperial y no lo tocara.
        var vuelta = _ajuste("lapDistance", KM_POR_VUELTA);
        if (vuelta != null && vuelta > 0) {
            kmPorVuelta = vuelta.toFloat();
        }

        avisoCorral = _ajuste("corralAlert", true);
        autoLap = _ajuste("autoLap", false);
    }

    function _ajuste(clave, porDefecto) {
        try {
            var v = App.Properties.getValue(clave);
            return v == null ? porDefecto : v;
        } catch (e) {
            return porDefecto;
        }
    }

    // --- la salida y el ancla ---

    // Ancla el cero a la marca de duracionVuelta mas cercana del reloj de
    // pared. A las 8:03 el ancla es 8:00 (la vuelta ya corre); a las 7:58, ...
    // tambien 8:00 (faltan dos minutos). El ancla se guarda en epoch: los
    // cambios de hora de despues no la mueven.
    function darLaSalida() {
        var ahora = Time.now().value();
        var reloj = Sys.getClockTime();
        var desdeMedianoche = (reloj.hour * 3600) + (reloj.min * 60) + reloj.sec;
        var resto = desdeMedianoche % duracionVuelta;
        if (resto < duracionVuelta / 2) {
            campana0 = ahora - resto;
        } else {
            campana0 = ahora + (duracionVuelta - resto);
        }
        vueltaMarcada = 0;
        _latSalida = _lat;
        _lonSalida = _lon;
    }

    // La ultima posicion conocida, del GPS de la app. La guarda quien recibe
    // los eventos de posicion. El cast del array es por lo mismo que en
    // proyeccion(): sin el, el comprobador avisa en cada compilacion.
    function verPosicion(info) {
        if (info == null || info.position == null) { return; }
        var rad = info.position.toRadians() as Lang.Array<Lang.Double>;
        _lat = rad[0];
        _lon = rad[1];
    }

    // Marca el termino de la vuelta en curso. Devuelve true solo si la marca
    // vale: la primera de cada vuelta, con la carrera andando. Las demas se
    // ignoran sin ruido.
    function marcarVuelta() {
        var v = vuelta();
        if (v == null || v < 1 || v == vueltaMarcada) { return false; }
        vueltaMarcada = v;
        return true;
    }

    function marcada() {
        var v = vuelta();
        return v != null && v > 0 && v == vueltaMarcada;
    }

    // Si la vuelta automatica esta activa: cerca del punto de salida y con la
    // mayor parte de la vuelta recorrida, la marca cae sola. El requisito de
    // distancia evita marcarla al salir, que tambien es "cerca de la salida".
    function tocaMarcarSola() {
        if (!autoLap || marcada() || _latSalida == null || _lat == null) {
            return false;
        }
        var km = kmEnLaVuelta();
        if (km == null || km < kmObjetivo() * 0.5) { return false; }
        return _metrosASalida() < RADIO_SALIDA_M;
    }

    // Haversine. Para treinta metros contra un punto fijo sobra precision.
    function _metrosASalida() {
        var dLat = _lat - _latSalida;
        var dLon = _lon - _lonSalida;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
              + Math.cos(_latSalida) * Math.cos(_lat)
              * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371000.0 * 2.0 * Math.asin(Math.sqrt(a));
    }

    // --- el cero de la carrera ---

    // Milisegundos desde que arranco la actividad. En la app es la sesion que
    // ella misma graba, asi que el cero es la campana de salida por
    // construccion; en el campo de datos es la actividad nativa del reloj.
    //
    // El cero cuenta como "todavia nada". Sin actividad, el simulador no
    // devuelve null sino 0, y sin esta linea se dibujaba una vuelta 1 parada
    // en 60:00 en vez de decir que no hay de donde contar. Lo unico que se
    // pierde es el primer segundo de la carrera, que no lo mira nadie.
    function _milisActividad() {
        var info = Activity.getActivityInfo();
        if (info == null || info.elapsedTime == null || info.elapsedTime <= 0) {
            return null;
        }
        return info.elapsedTime;
    }

    // Segundos de carrera. Cero justo en la campana de la vuelta 1; negativo
    // si la campana todavia no sono. Con ancla manda el reloj de pared; sin
    // ella (el campo de datos), la actividad nativa.
    function segundosDeCarrera() {
        if (campana0 != null) {
            return Time.now().value() - campana0;
        }
        var ms = _milisActividad();
        if (ms == null) { return null; }
        return ms / 1000;
    }

    function empezada() {
        return segundosDeCarrera() != null;
    }

    // --- proyeccion ---

    // Devuelve [vuelta, segundosHastaLaProximaSalida], o null si todavia no
    // hay actividad de la que contar.
    //
    // El tipo va escrito: sin el, el comprobador no puede saber que lo que se
    // indexa en vuelta() y restante() es un array, y avisa en cada compilacion.
    // La vuelta 0 es "antes de la salida": el ancla existe pero la campana no
    // ha sonado, y el restante es la cuenta atras hasta ella.
    function proyeccion() as Lang.Array<Lang.Number> or Null {
        var s = segundosDeCarrera();
        if (s == null || duracionVuelta <= 0) { return null; }
        if (s < 0) { return [0, -s]; }

        var vuelta = (s / duracionVuelta) + 1;
        var restante = duracionVuelta - (s % duracionVuelta);
        return [vuelta, restante];
    }

    function vuelta() {
        var p = proyeccion();
        return p == null ? null : p[0];
    }

    function restante() {
        var p = proyeccion();
        return p == null ? null : p[1];
    }

    // Las vueltas ya cerradas son vuelta() - 1, y quien dibuja las cuenta a
    // partir de la proyeccion que ya tiene en la mano: en una backyard el que
    // sigue dentro las ha hecho todas, esa es justamente la regla.

    // --- distancia y ritmo de la vuelta en curso ---

    function _metrosActividad() {
        var info = Activity.getActivityInfo();
        if (info == null || info.elapsedDistance == null) { return null; }
        return info.elapsedDistance;
    }

    // Se llama en cada tic. Cuando cambia la vuelta, guarda el corte de
    // distancia y aprovecha para calibrar con lo que acaba de medir el reloj.
    function refrescarFoto() {
        var v = vuelta();
        if (v == null) { return; }
        var metros = _metrosActividad();
        if (metros == null) { return; }

        if (_vueltaDeLaFoto != v) {
            if (_vueltaDeLaFoto > 0) {
                var medidos = (metros - _metrosEnLaFoto) / 1000.0;
                // Solo vale si se parece a una vuelta. Si el GPS se fue media
                // hora, o la vuelta corto en otro sitio, el numero es basura.
                if (medidos > kmPorVuelta * 0.8 && medidos < kmPorVuelta * 1.2) {
                    kmMedidosUltimaVuelta = medidos;
                }
            }
            _vueltaDeLaFoto = v;
            _metrosEnLaFoto = metros;
        }
    }

    // Lo que hay que recorrer para cerrar la vuelta, medido como lo mide este
    // reloj y no como lo midio la cinta metrica.
    function kmObjetivo() {
        return kmMedidosUltimaVuelta != null ? kmMedidosUltimaVuelta : kmPorVuelta;
    }

    function kmEnLaVuelta() {
        if (_vueltaDeLaFoto == 0) { return null; }
        var metros = _metrosActividad();
        if (metros == null) { return null; }
        var km = (metros - _metrosEnLaFoto) / 1000.0;
        return km < 0 ? null : km;
    }

    function segundosEnLaVuelta() {
        var r = restante();
        if (r == null) { return null; }
        var t = duracionVuelta - r;
        return t > 0 ? t : null;
    }

    function ritmoSegPorKm() {
        var km = kmEnLaVuelta();
        var t = segundosEnLaVuelta();
        if (km == null || t == null || km < KM_MINIMOS_PARA_MARGEN) { return null; }
        return t.toFloat() / km;
    }

    // El margen: segundos que sobran (o faltan) para cerrar la vuelta antes de
    // la campana, al ritmo que se lleva. Positivo es descanso.
    function margenSegundos() {
        var r = restante();
        var km = kmEnLaVuelta();
        var ritmo = ritmoSegPorKm();
        if (r == null || km == null || ritmo == null) { return null; }

        var faltan = kmObjetivo() - km;
        if (faltan < 0) { faltan = 0.0; }
        return r - (faltan * ritmo);
    }

    function enCorral() {
        var r = restante();
        return r != null && r <= AVISOS_CORRAL[0];
    }
}
