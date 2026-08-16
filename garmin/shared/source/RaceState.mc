using Toybox.Application as App;
using Toybox.Activity as Activity;
using Toybox.Time as Time;

// La carrera tal y como la ve el reloj.
//
// El servidor solo hace falta de vez en cuando. De su respuesta se guarda una
// sola cosa: "en la vuelta N le quedaban R segundos, y eso lo supe en el
// instante M". A partir de ahi cuenta el cronometro del propio Garmin.
//
// Que solo se usen diferencias de tiempo, nunca horas absolutas, tiene dos
// consecuencias buenas: da igual que el reloj del corredor este mal puesto, y
// da igual que el telefono se quede sin cobertura treinta horas. La cuenta
// atras no se detiene ni miente; como mucho envejece.
class RaceState {

    // Valores de la Backyard Ultra Santo Domingo. Son solo el punto de
    // partida: si el backend los manda en lap-status, mandan los suyos.
    static const DURACION_VUELTA = 3600;
    static const KM_POR_VUELTA = 6.7;

    // Por debajo de este kilometraje el ritmo medio da tumbos y el margen
    // saltaria minutos enteros de una zancada a otra. Mejor un guion.
    static const KM_MINIMOS_PARA_MARGEN = 1.0;

    // Los tres avisos del corral, en segundos antes de la campana.
    static const AVISOS_CORRAL = [180, 120, 60];

    // --- ajustes, del telefono ---
    var dorsal = null;
    var raceCode = null;
    var avisoCorral = true;
    var segundosRefresco = 60;

    // --- lo que dijo el servidor la ultima vez ---
    var sincronizado = false;
    var empezada = false;
    var terminada = false;
    var vueltaSemilla = 0;
    var restanteSemilla = 0;
    var momentoSemilla = 0;
    var enCarrera = 0;
    var inscritos = 0;
    var duracionVuelta = DURACION_VUELTA;
    var kmPorVuelta = KM_POR_VUELTA;

    // Calibracion: lo que midio el reloj en la ultima vuelta cerrada. El GPS
    // puede marcar 6.85 km en un circuito de 6.7, y sobre treinta vueltas esa
    // diferencia descuadra el margen.
    var kmMedidosUltimaVuelta = null;

    // Instantanea de la distancia de la actividad al empezar la vuelta actual.
    var _vueltaDeLaFoto = 0;
    var _metrosEnLaFoto = 0.0;

    // Un campo de datos recibe la actividad ya servida en compute(); pedirla
    // otra vez seria trabajo de mas. La app, que no la recibe, la deja en null
    // y entonces se pregunta al sistema.
    var infoActividad = null;

    function initialize() {
        leerAjustes();
    }

    function leerAjustes() {
        dorsal = _ajuste("bib", null);
        raceCode = _ajuste("raceCode", null);
        avisoCorral = _ajuste("corralAlert", true);
        segundosRefresco = _ajuste("refreshSeconds", 60);
        if (segundosRefresco == null || segundosRefresco < 30) {
            segundosRefresco = 30;
        }
        if (dorsal != null && dorsal.length() == 0) { dorsal = null; }
        if (raceCode != null && raceCode.length() == 0) { raceCode = null; }
    }

    function _ajuste(clave, porDefecto) {
        try {
            var v = App.Properties.getValue(clave);
            return v == null ? porDefecto : v;
        } catch (e) {
            return porDefecto;
        }
    }

    // --- sincronizacion ---

    function sembrar(vuelta, restante, haEmpezado, haTerminado) {
        vueltaSemilla = vuelta;
        restanteSemilla = restante;
        momentoSemilla = Time.now().value();
        empezada = haEmpezado;
        terminada = haTerminado;
        sincronizado = true;
    }

    // Segundos desde la ultima respuesta del servidor. Es lo que decide si el
    // punto de sincronia se enciende o se apaga.
    function edadDatos() {
        if (!sincronizado) { return null; }
        return Time.now().value() - momentoSemilla;
    }

    // --- proyeccion ---

    // Devuelve [vuelta, segundosHastaLaProximaSalida], o null si todavia no
    // hay nada que proyectar.
    function proyeccion() {
        if (!sincronizado || terminada || duracionVuelta <= 0) { return null; }

        var transcurrido = Time.now().value() - momentoSemilla;
        var restante = restanteSemilla - transcurrido;

        // Antes de la salida no hay vueltas que contar: es una cuenta atras
        // que se acaba, y cuando se acaba toca volver a preguntar.
        if (!empezada) {
            return [0, restante > 0 ? restante : 0];
        }

        var vuelta = vueltaSemilla;
        if (restante <= 0) {
            // Sin dividir, un reloj que lleve horas sin sincronizar daria mil
            // vueltas al bucle. Con division es una cuenta y ya.
            var saltos = (-restante / duracionVuelta) + 1;
            restante += saltos * duracionVuelta;
            vuelta += saltos;
        }
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

    // Vueltas ya cerradas por quien sigue en carrera. En una backyard el que
    // sigue dentro las ha hecho todas: esa es justamente la regla.
    function vueltasCompletadas() {
        var v = vuelta();
        if (v == null || !empezada) { return 0; }
        return v - 1;
    }

    function kmAcumulados() {
        return vueltasCompletadas() * kmPorVuelta;
    }

    // --- distancia y ritmo de la vuelta en curso ---

    function _metrosActividad() {
        var info = infoActividad != null ? infoActividad : Activity.getActivityInfo();
        if (info == null || info.elapsedDistance == null) { return null; }
        return info.elapsedDistance;
    }

    // Se llama en cada tic. Cuando cambia la vuelta, guarda el corte de
    // distancia y aprovecha para calibrar con lo que acaba de medir el reloj.
    function refrescarFoto() {
        var v = vuelta();
        if (v == null || !empezada) { return; }
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
        if (r == null || !empezada) { return null; }
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
        if (r == null || km == null || ritmo == null || !empezada) { return null; }

        var faltan = kmObjetivo() - km;
        if (faltan < 0) { faltan = 0.0; }
        return r - (faltan * ritmo);
    }

    function enCorral() {
        var r = restante();
        return empezada && !terminada && r != null && r <= AVISOS_CORRAL[0];
    }
}
