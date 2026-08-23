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
    var autoLapKm = false;
    // LAP apagado: para quien va totalmente automatico y no quiere marcar
    // por error con un roce del boton. Solo silencia el boton del corredor;
    // las vueltas automaticas siguen marcando igual.
    var lapApagado = false;

    // El orden de las pantallas de carrera de la app, como ids en el orden
    // en que se recorren (0 vuelta, 1 margen, 2 datos globales, 3 total,
    // 4 reloj, 5 datos de vuelta). Lo montan los ajustes pageLap..pageClock;
    // el campo de datos no lo usa. MainView tiene los mismos ids en su enum.
    // El id 5 va despues de 2 en el orden de fabrica: lo deciden las
    // posiciones por defecto de properties.xml, no este literal.
    var ordenPaginas = [0, 1, 2, 5, 3, 4];

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

    // Calibracion: lo que llevaba medido el reloj al MARCAR la ultima vuelta.
    // El GPS puede marcar 6.85 km en un circuito de 6.7, y sobre treinta
    // vueltas esa diferencia descuadra el margen. Se toma en la marca -el
    // corredor esta en la linea- y no de campana a campana: aquello sumaba lo
    // corrido o caminado despues de marcar, y una vuelta que ni se completo
    // tambien calibraba (visto en la calle el 22-08: 7.88 km de "circuito"
    // por seguir corriendo, y luego 6.16 por una vuelta incompleta).
    var kmMedidosUltimaVuelta = null;

    // Instantanea de la distancia de la actividad al empezar la vuelta actual.
    var _vueltaDeLaFoto = 0;
    var _metrosEnLaFoto = 0.0;

    // Los acumulados de la pantalla global de datos: solo lo corrido DENTRO
    // de las vueltas (de la campana a la marca), sin los descansos. Una
    // vuelta que no se marca cuenta entera, de campana a campana: no hay
    // forma de saber donde se detuvo. El pulso se muestrea una vez por
    // segundo mientras la vuelta esta en curso. Todo son escalares que se
    // sobreescriben: nada crece con las vueltas.
    var kmDeVueltas = 0.0;
    var segDeVueltas = 0;
    var sumaPulso = 0.0;
    var muestrasPulso = 0;

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
        autoLapKm = _ajuste("autoLapKm", false);
        lapApagado = _ajuste("lapOff", false);
        _leerOrdenPaginas();
    }

    // Cada pantalla tiene su ajuste de posicion: 1..5 la ordena, 0 la oculta.
    // Los empates y los huecos no importan -se ordena por posicion y, a
    // igualdad, por el orden de fabrica-, asi que cualquier cosa que escriba
    // el corredor en el telefono produce un orden valido. Si las oculta
    // todas, queda la de vuelta: la app no se queda sin pantalla.
    // El indice en esta lista es el id de pantalla; pageDataLap se agrego al
    // final (id 5) para no mover los ids que ya existian.
    static const AJUSTES_PAGINAS = ["pageLap", "pageMargin", "pageData",
                                    "pageTotal", "pageClock", "pageDataLap"];

    function _leerOrdenPaginas() {
        var posiciones = [];
        var ids = [];
        for (var i = 0; i < AJUSTES_PAGINAS.size(); i++) {
            var pos = _ajuste(AJUSTES_PAGINAS[i], i + 1);
            if (pos != null && pos.toNumber() > 0) {
                posiciones = posiciones.add(pos.toNumber());
                ids = ids.add(i);
            }
        }
        var ps = posiciones as Lang.Array<Lang.Number>;
        var vs = ids as Lang.Array<Lang.Number>;
        var n = ps.size();
        if (n == 0) {
            ordenPaginas = [0];
            return;
        }
        // Seleccion directa y estable: con cinco elementos no hace falta mas.
        var usado = new [n];
        var orden = [];
        for (var k = 0; k < n; k++) {
            var mejor = -1;
            for (var i = 0; i < n; i++) {
                if (usado[i] != true
                    && (mejor < 0 || ps[i] < ps[mejor])) {
                    mejor = i;
                }
            }
            usado[mejor] = true;
            orden = orden.add(vs[mejor]);
        }
        ordenPaginas = orden;
    }

    function _ajuste(clave, porDefecto) {
        try {
            var v = App.Properties.getValue(clave);
            return v == null ? porDefecto : v;
        } catch (e) {
            return porDefecto;
        }
    }

    // --- persistencia: sobrevivir a un cierre a mitad de carrera ---
    //
    // En una carrera de 80-120 horas la app puede cerrarse -bateria agotada y
    // recargada, un reinicio del reloj- y sin esto se perderia toda la cuenta.
    // Se guarda el minimo -el ancla del reloj de pared y lo que no se puede
    // recalcular- SOLO cuando cambia (salida, LAP, campana), nunca cada
    // segundo: son escrituras esporadicas, una por vuelta. Al reabrir, el
    // ancla basta para recalcular la vuelta exacta, porque manda la hora.
    static const K_CAMPANA = "carrera_campana0";
    static const K_MARCADA = "carrera_vueltaMarcada";
    static const K_KM_ULT = "carrera_kmUltima";
    static const K_LAT_S = "carrera_latSalida";
    static const K_LON_S = "carrera_lonSalida";
    static const K_KM_V = "carrera_kmVueltas";
    static const K_SEG_V = "carrera_segVueltas";
    static const K_PUL_S = "carrera_sumaPulso";
    static const K_PUL_N = "carrera_muestrasPulso";

    function guardar() {
        if (campana0 == null) { return; }
        try {
            App.Storage.setValue(K_CAMPANA, campana0);
            App.Storage.setValue(K_MARCADA, vueltaMarcada);
            App.Storage.setValue(K_KM_ULT, kmMedidosUltimaVuelta);
            App.Storage.setValue(K_LAT_S, _latSalida);
            App.Storage.setValue(K_LON_S, _lonSalida);
            App.Storage.setValue(K_KM_V, kmDeVueltas);
            App.Storage.setValue(K_SEG_V, segDeVueltas);
            App.Storage.setValue(K_PUL_S, sumaPulso);
            App.Storage.setValue(K_PUL_N, muestrasPulso);
        } catch (e) {
        }
    }

    // True si hay una carrera viva guardada de una sesion anterior.
    function hayGuardada() {
        try {
            return App.Storage.getValue(K_CAMPANA) != null;
        } catch (e) {
            return false;
        }
    }

    // Restaura el estado de la carrera guardada. Devuelve true si habia una.
    function recuperar() {
        try {
            var c = App.Storage.getValue(K_CAMPANA);
            if (c == null) { return false; }
            campana0 = c;
            var m = App.Storage.getValue(K_MARCADA);
            vueltaMarcada = m == null ? 0 : m;
            kmMedidosUltimaVuelta = App.Storage.getValue(K_KM_ULT);
            _latSalida = App.Storage.getValue(K_LAT_S);
            _lonSalida = App.Storage.getValue(K_LON_S);
            var kv = App.Storage.getValue(K_KM_V);
            kmDeVueltas = kv == null ? 0.0 : kv;
            var sv = App.Storage.getValue(K_SEG_V);
            segDeVueltas = sv == null ? 0 : sv;
            var ps = App.Storage.getValue(K_PUL_S);
            sumaPulso = ps == null ? 0.0 : ps;
            var pn = App.Storage.getValue(K_PUL_N);
            muestrasPulso = pn == null ? 0 : pn;
            return true;
        } catch (e) {
            return false;
        }
    }

    function limpiar() {
        try {
            App.Storage.deleteValue(K_CAMPANA);
            App.Storage.deleteValue(K_MARCADA);
            App.Storage.deleteValue(K_KM_ULT);
            App.Storage.deleteValue(K_LAT_S);
            App.Storage.deleteValue(K_LON_S);
            App.Storage.deleteValue(K_KM_V);
            App.Storage.deleteValue(K_SEG_V);
            App.Storage.deleteValue(K_PUL_S);
            App.Storage.deleteValue(K_PUL_N);
        } catch (e) {
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
        kmDeVueltas = 0.0;
        segDeVueltas = 0;
        sumaPulso = 0.0;
        muestrasPulso = 0;
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
        // La calibracion se toma aqui: al marcar, el corredor esta en la
        // linea, asi que lo que lleva medida la vuelta es el circuito como lo
        // mide este reloj. El filtro descarta marcas que no se parecen a una
        // vuelta. Cuando la marca la puso el disparador de distancia, el
        // valor es el propio objetivo y esto no cambia nada: la correccion
        // real la aportan el LAP del corredor y el punto de salida.
        var km = kmEnLaVuelta();
        if (km != null && km > kmPorVuelta * 0.8 && km < kmPorVuelta * 1.2) {
            kmMedidosUltimaVuelta = km;
        }
        // Los acumulados de vueltas cierran aqui: lo corrido y el tiempo
        // hasta la marca. Lo que venga despues es descanso y no cuenta.
        var t = segundosEnLaVuelta();
        if (km != null) { kmDeVueltas += km; }
        if (t != null) { segDeVueltas += t; }
        return true;
    }

    function marcada() {
        var v = vuelta();
        return v != null && v > 0 && v == vueltaMarcada;
    }

    // La vuelta automatica, si esta activa: la marca cae sola al llegar al
    // punto de salida o al completar la distancia de la vuelta. Pueden estar
    // las dos puestas y manda la que llegue primero; la misma vuelta no se
    // marca dos veces porque marcada() corta aqui y marcarVuelta() ignora
    // cualquier segunda marca de la misma vuelta.
    function tocaMarcarSola() {
        if (marcada()) { return false; }
        var km = kmEnLaVuelta();
        if (km == null) { return false; }

        // Por distancia: el reloj ya midio la vuelta entera. El objetivo es
        // el calibrado -lo que este reloj midio en la ultima vuelta-, el
        // mismo que usa el margen.
        if (autoLapKm && km >= kmObjetivo()) { return true; }

        // Por ubicacion: cerca del punto de salida y con la mayor parte de
        // la vuelta recorrida. El requisito de distancia evita marcarla al
        // salir, que tambien es "cerca de la salida".
        if (!autoLap || _latSalida == null || _lat == null) { return false; }
        if (km < kmObjetivo() * 0.5) { return false; }
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
    // distancia desde el que se mide la vuelta nueva. La calibracion ya no se
    // hace aqui: se hace al marcar, que es cuando el corredor esta en la
    // linea (ver marcarVuelta).
    function refrescarFoto() {
        var v = vuelta();
        if (v == null) { return; }
        var metros = _metrosActividad();
        if (metros == null) { return; }

        if (_vueltaDeLaFoto != v) {
            // Si la vuelta que termina no se marco, cuenta entera para los
            // acumulados: de campana a campana. Marcada, ya sumo en la marca.
            if (_vueltaDeLaFoto > 0 && vueltaMarcada < _vueltaDeLaFoto) {
                kmDeVueltas += (metros - _metrosEnLaFoto) / 1000.0;
                segDeVueltas += duracionVuelta;
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

    // --- los totales de la pantalla global (solo vueltas, sin descansos) ---

    // Una muestra de pulso por segundo, solo mientras la vuelta esta en
    // curso (de la campana a la marca). La llama el tic de la app.
    function muestrearPulso() {
        var v = vuelta();
        if (v == null || v < 1 || marcada()) { return; }
        var info = Activity.getActivityInfo();
        if (info == null || info.currentHeartRate == null) { return; }
        sumaPulso += info.currentHeartRate;
        muestrasPulso += 1;
    }

    // Los cerrados mas la vuelta en curso si todavia no se marco.
    function kmTotalesDeVueltas() {
        var km = kmDeVueltas;
        if (!marcada()) {
            var k = kmEnLaVuelta();
            if (k != null) { km += k; }
        }
        return km;
    }

    function segTotalesDeVueltas() {
        var s = segDeVueltas;
        if (!marcada()) {
            var t = segundosEnLaVuelta();
            if (t != null) { s += t; }
        }
        return s;
    }

    // El ritmo medio de todas las vueltas, con el mismo minimo que el margen
    // para no ensenar un promedio que da tumbos.
    function ritmoMedioVueltas() {
        var km = kmTotalesDeVueltas();
        var s = segTotalesDeVueltas();
        if (km < KM_MINIMOS_PARA_MARGEN || s <= 0) { return null; }
        return s.toFloat() / km;
    }

    function pulsoMedioVueltas() {
        if (muestrasPulso < 1) { return null; }
        return (sumaPulso / muestrasPulso).toNumber();
    }
}
