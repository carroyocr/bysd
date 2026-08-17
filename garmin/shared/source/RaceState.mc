using Toybox.Application as App;
using Toybox.Activity as Activity;
using Toybox.Lang as Lang;

// La carrera tal y como la ve el reloj.
//
// No hay servidor. Todo sale de dos sitios: los ajustes que el corredor puso
// una vez desde el telefono (cuanto dura la vuelta y cuanto mide) y el reloj de
// la propia actividad, que es el unico cronometro que hay.
//
// La campana de la vuelta 1 es el momento en que arranco la actividad. Se usa
// 'elapsedTime' y no 'timerTime' porque en una backyard el descanso entre
// vueltas cuenta: la campana suena cada hora exacta aunque el corredor haya
// pausado el reloj para sentarse. Si arranco la actividad antes de la campana,
// desde la app puede volver a sellar el cero y la diferencia se guarda aqui.
//
// Que todo sean diferencias de tiempo, nunca horas absolutas, tiene una
// consecuencia buena: da igual que el reloj del corredor este mal puesto.
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

    // Donde se guarda el cero de la carrera para que sobreviva a cerrar la app.
    static const CLAVE_DESFASE = "desfase";
    static const CLAVE_SELLO = "selloDesfase";

    // --- ajustes, del telefono ---
    var duracionVuelta = DURACION_VUELTA;
    var kmPorVuelta = KM_POR_VUELTA;
    var avisoCorral = true;

    // Segundos de actividad que no cuentan como carrera: lo que corrio el reloj
    // entre el play y la campana. Cero mientras el corredor no lo cambie.
    var desfase = 0;

    // Calibracion: lo que midio el reloj en la ultima vuelta cerrada. El GPS
    // puede marcar 6.85 km en un circuito de 6.7, y sobre treinta vueltas esa
    // diferencia descuadra el margen.
    var kmMedidosUltimaVuelta = null;

    // Instantanea de la distancia de la actividad al empezar la vuelta actual.
    var _vueltaDeLaFoto = 0;
    var _metrosEnLaFoto = 0.0;

    function initialize() {
        leerAjustes();
        _leerDesfase();
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
        // —10.8 km— para quien tuviera el reloj en imperial y no lo tocara.
        var vuelta = _ajuste("lapDistance", KM_POR_VUELTA);
        if (vuelta != null && vuelta > 0) {
            kmPorVuelta = vuelta.toFloat();
        }

        avisoCorral = _ajuste("corralAlert", true);
    }

    function _ajuste(clave, porDefecto) {
        try {
            var v = App.Properties.getValue(clave);
            return v == null ? porDefecto : v;
        } catch (e) {
            return porDefecto;
        }
    }

    // --- el cero de la carrera ---

    // Milisegundos desde que arranco la actividad, pausas incluidas. Es null
    // cuando no hay ninguna actividad grabando, y entonces no hay carrera que
    // contar: la app lo dice y no inventa nada.
    //
    // El cero cuenta como "todavia nada". Sin actividad, el simulador no
    // devuelve null sino 0, y sin esta linea la app dibujaba una vuelta 1
    // parada en 60:00 en vez de decir que no hay de donde contar. Lo unico que
    // se pierde es el primer segundo de la carrera, que no lo mira nadie.
    function _milisActividad() {
        var info = Activity.getActivityInfo();
        if (info == null || info.elapsedTime == null || info.elapsedTime <= 0) {
            return null;
        }
        return info.elapsedTime;
    }

    // Segundos de carrera. Cero justo en la campana de salida.
    function segundosDeCarrera() {
        var ms = _milisActividad();
        if (ms == null) { return null; }
        var s = (ms / 1000) - desfase;
        return s > 0 ? s : 0;
    }

    function empezada() {
        return _milisActividad() != null;
    }

    // Vuelve a poner el cero aqui: el corredor arranco la actividad antes de la
    // campana y ahora suena. Solo lo llama la app, que es la que tiene botones.
    function darLaSalida() {
        var ms = _milisActividad();
        if (ms == null) { return false; }
        desfase = ms / 1000;
        _vueltaDeLaFoto = 0;
        kmMedidosUltimaVuelta = null;
        _guardarDesfase(ms);
        return true;
    }

    // El desfase se guarda junto al 'elapsedTime' en que se sello. Si al abrir
    // la app la actividad lleva menos tiempo que ese sello, es otra actividad
    // distinta y el desfase viejo no vale para nada: se tira.
    function _leerDesfase() {
        try {
            var d = App.Storage.getValue(CLAVE_DESFASE);
            var sello = App.Storage.getValue(CLAVE_SELLO);
            if (d == null || sello == null) { return; }
            var ms = _milisActividad();
            if (ms == null || ms < sello) { return; }
            desfase = d;
        } catch (e) {
            desfase = 0;
        }
    }

    function _guardarDesfase(ms) {
        try {
            App.Storage.setValue(CLAVE_DESFASE, desfase);
            App.Storage.setValue(CLAVE_SELLO, ms);
        } catch (e) {
            // Sin Storage la app sigue funcionando: el cero solo dura lo que
            // dure la sesion. No es motivo para romper nada.
        }
    }

    // --- proyeccion ---

    // Devuelve [vuelta, segundosHastaLaProximaSalida], o null si todavia no
    // hay actividad de la que contar.
    //
    // El tipo de vuelta va escrito: sin el, el comprobador no puede saber que
    // lo que se indexa en vuelta() y restante() es un array, y avisa en cada
    // compilacion.
    function proyeccion() as Lang.Array<Lang.Number> or Null {
        var s = segundosDeCarrera();
        if (s == null || duracionVuelta <= 0) { return null; }

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
                // Solo vale si se parece a una vuelta. Si el corredor paro la
                // actividad, o la arranco a media vuelta, el numero es basura.
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
