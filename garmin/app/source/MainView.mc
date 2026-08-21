using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Lang as Lang;
using Toybox.System as Sys;
using Toybox.Activity as Activity;

// Las cinco pantallas de carrera.
//
// Una sola cifra grande en cada una -salvo la de datos, que es la cuadricula
// clasica de correr-. A las veinte horas, de noche y con la vista cansada,
// solo se lee lo que ocupa media esfera: todo lo demas es contexto que se
// mira cuando sobra tiempo, y en una backyard nunca sobra.
class MainView extends Ui.View {

    // Los ids de pantalla, en el orden de fabrica. El orden real -y cuales se
    // ven- lo deciden los ajustes: estado.ordenPaginas trae los ids visibles
    // ya ordenados, y _pagina es el indice DENTRO de esa lista, no un id.
    enum {
        PAGINA_VUELTA = 0,
        PAGINA_MARGEN = 1,
        PAGINA_DATOS  = 2,
        PAGINA_TUYO   = 3,
        PAGINA_RELOJ  = 4
    }

    var _estado;
    var _pagina = 0;
    // Escrito como diccionario para que el comprobador sepa que _s[:clave] es
    // un acceso legitimo y no avise en cada compilacion.
    var _s as Lang.Dictionary = {};

    function initialize(estado) {
        View.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        // Las cadenas se cargan una vez. La pantalla se repinta cada segundo
        // durante treinta horas: no es sitio para ir a buscar recursos.
        _s = {
            :lap => Ui.loadResource(Rez.Strings.lap),
            :nextStart => Ui.loadResource(Rez.Strings.nextStart),
            :warmup => Ui.loadResource(Rez.Strings.warmup),
            :toTheLine => Ui.loadResource(Rez.Strings.toTheLine),
            :rest => Ui.loadResource(Rez.Strings.rest),
            :running => Ui.loadResource(Rez.Strings.running),
            :margin => Ui.loadResource(Rez.Strings.margin),
            :toGo => Ui.loadResource(Rez.Strings.toGo),
            :distance => Ui.loadResource(Rez.Strings.distance),
            :pace => Ui.loadResource(Rez.Strings.pace),
            :heartRate => Ui.loadResource(Rez.Strings.heartRate),
            :remaining => Ui.loadResource(Rez.Strings.remaining),
            :total => Ui.loadResource(Rez.Strings.total),
            :lapsDone => Ui.loadResource(Rez.Strings.lapsDone),
            :laps => Ui.loadResource(Rez.Strings.laps),
            :clock => Ui.loadResource(Rez.Strings.clock),
            :battery => Ui.loadResource(Rez.Strings.battery),
            :noActivity => Ui.loadResource(Rez.Strings.noActivity)
        };
    }

    function avanzar(paso) {
        var n = (_estado.ordenPaginas as Lang.Array<Lang.Number>).size();
        _pagina = (_pagina + paso + n) % n;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var radio = (w < h ? w : h) / 2 - 6;

        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();

        // Sin actividad grabando no hay cronometro del que colgar la carrera, y
        // esta app no tiene otro. Se dice y ya: inventar una cuenta atras aqui
        // seria mentir con mucha seguridad aparente.
        //
        // La proyeccion se pide una sola vez y se reparte. Preguntarla en cada
        // pagina abriria un hueco entre la comprobacion y el dibujo: basta que
        // el corredor pare la actividad en ese instante para que lo que aqui
        // era un numero llegue como null a un toFloat().
        //
        // El cast no es adorno: _estado no lleva tipo, asi que lo que devuelve
        // proyeccion() llega aqui como Any y el comprobador no sabe que p[0]
        // es un acceso legitimo. Sin el, dos avisos en cada compilacion.
        var p = _estado.proyeccion();
        if (p == null) {
            _txt(dc, cx, cy, Gfx.FONT_MEDIUM, Gfx.COLOR_DK_GRAY, _s[:noActivity]);
            return;
        }
        var proy = p as Lang.Array<Lang.Number>;
        var vuelta = proy[0];
        var r = proy[1];

        // El corral no es una pagina: se impone. En los ultimos tres minutos
        // de cualquier cuenta atras -la de salida incluida- salta a pantalla
        // completa por encima de la pagina que se este mirando, porque ahi lo
        // urgente es llegar a la linea y no el ritmo. Se tine con el semaforo
        // (amarillo a 3, naranja a 2, rojo en el ultimo) y vuelve solo cuando
        // suena la campana. No rompe la regla de "navegacion siempre viva":
        // el candado que la rompia duraba hasta media hora; este, tres
        // minutos, y es lo que el corredor tiene que ver.
        var aviso = Fmt.colorCorral(r);
        if (aviso != null) {
            _corral(dc, cx, cy, h, radio, vuelta, r, aviso);
            return;
        }

        // Vuelta cerrada con LAP: el corredor llego a meta y descansa. La
        // pantalla se pone verde de esquina a esquina -llegaste, descansa- con
        // el tiempo que falta para la proxima campana y lo acumulado debajo.
        // Se impone igual que el corral, y le cede el sitio cuando faltan tres
        // minutos (el corral se comprueba antes, arriba).
        if (vuelta >= 1 && _estado.marcada()) {
            _descanso(dc, cx, cy, h, radio, vuelta, r);
            return;
        }

        // El enrutado va primero y no lo corta ningun estado: en la vuelta 0
        // (el corredor pulso START antes de la hora) la pagina de vuelta
        // muestra la cuenta atras a la campana y las demas se protegen solas.
        // La primera version cortaba aqui con un return, y con vueltas de una
        // hora eso bloqueaba el cambio de pantalla hasta media hora seguida.
        //
        // El indice se protege antes de indexar: si un cambio de ajustes desde
        // el telefono acorta la lista a mitad de carrera, se vuelve a la
        // primera pagina en vez de leer fuera.
        var orden = _estado.ordenPaginas as Lang.Array<Lang.Number>;
        if (_pagina >= orden.size()) { _pagina = 0; }
        var id = orden[_pagina];
        if (id == PAGINA_MARGEN) {
            _paginaMargen(dc, cx, cy, h, radio, vuelta, r);
        } else if (id == PAGINA_DATOS) {
            _paginaDatos(dc, cx, cy, h, vuelta, r);
        } else if (id == PAGINA_TUYO) {
            _paginaTuyo(dc, cx, cy, h, radio, vuelta);
        } else if (id == PAGINA_RELOJ) {
            _paginaReloj(dc, cx, cy, h, radio);
        } else if (vuelta == 0) {
            _antesDeLaSalida(dc, cx, cy, h, radio, r);
        } else {
            _paginaVuelta(dc, cx, cy, h, radio, vuelta, r);
        }

        _migas(dc, cx, h, orden.size());
    }

    // --- pantallas ---

    // El corral, la pantalla que se impone en los ultimos tres minutos. A tres
    // y dos minutos -amarillo y naranja- es un aro ancho del color sobre fondo
    // negro: se ve el color de un vistazo con casi toda la pantalla apagada,
    // que en AMOLED es la esquina de la que sale la bateria. Solo el ultimo
    // minuto se llena de rojo de esquina a esquina: es el aviso mas urgente y
    // el mas breve, y ahi el gasto se justifica.
    //
    // La cuenta grande es el tiempo a la campana, en la fuente mas gruesa;
    // arriba, "A la linea"; abajo, la vuelta que esa campana abre.
    function _corral(dc, cx, cy, h, radio, vuelta, r, aviso) {
        var etiqueta = _s[:lap] + " " + (vuelta + 1).format("%d");
        if (aviso == Gfx.COLOR_RED) {
            dc.setColor(aviso, aviso);
            dc.clear();
            _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE, _s[:toTheLine]);
            _txt(dc, cx, cy, Gfx.FONT_NUMBER_HOT, Gfx.COLOR_WHITE, Fmt.reloj(r));
            _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE, etiqueta);
            return;
        }
        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();
        _aroAncho(dc, cx, cy, radio, aviso);
        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, aviso, _s[:toTheLine]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_HOT, aviso, Fmt.reloj(r));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY, etiqueta);
    }

    // El descanso, la contraparte del corral: la vuelta esta hecha. Un aro
    // ancho verde sobre fondo negro -misma economia de bateria que el corral
    // de tres y dos minutos-, con el tiempo a la proxima campana en grueso y,
    // debajo, lo acumulado: vueltas cerradas y kilometros.
    function _descanso(dc, cx, cy, h, radio, vuelta, r) {
        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();
        _aroAncho(dc, cx, cy, radio, Gfx.COLOR_GREEN);
        var completadas = _completadas(vuelta);
        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_GREEN, _s[:rest]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_HOT, Gfx.COLOR_GREEN, Fmt.reloj(r));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             completadas.format("%d") + " " + _s[:laps]);
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             Fmt.distancia(completadas * _estado.kmPorVuelta) + " " + Fmt.unidad());
    }

    // El aro ancho compartido por el descanso y el corral de tres y dos
    // minutos: un anillo grueso del color pegado al borde, con el centro
    // negro. Se dibuja algo mas adentro que los aros finos para que el grosor
    // no se salga de la esfera. (Empezo en 14, subio a 21 y en el reloj real
    // se veia demasiado: quedo un cuarto mas fino, en 16.)
    function _aroAncho(dc, cx, cy, radio, color) {
        _arco(dc, cx, cy, radio - 6, 1.0, color, 16);
    }

    // El calentamiento: el tramo previo a la primera campana, cuando el
    // corredor pulso START antes de la hora. No es la vuelta 1 -en el FIT queda
    // en su propio tramo- y por eso la esfera lo dice. Fondo negro, un aro
    // tenue y la cuenta a la salida en grueso.
    function _antesDeLaSalida(dc, cx, cy, h, radio, r) {
        _arco(dc, cx, cy, radio, 1.0, Gfx.COLOR_DK_GRAY, 6);
        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY, _s[:warmup]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_HOT, Gfx.COLOR_WHITE, Fmt.reloj(r));
    }

    // El rotulo de arriba presenta la cifra ("Proxima salida") y debajo va que
    // se esta haciendo ("Vuelta 7 · corriendo" o "· De descanso"). El corral
    // ya no llega aqui: se intercepta en onUpdate y se impone a pantalla
    // completa antes de dibujar ninguna pagina.
    function _paginaVuelta(dc, cx, cy, h, radio, vuelta, r) {
        var descansando = _estado.marcada();

        // El aro se vacia con la hora: lo que queda de aro es lo que queda de
        // vuelta. Es la misma cifra del centro, legible sin leer.
        _arco(dc, cx, cy, radio, r.toFloat() / _estado.duracionVuelta,
              Gfx.COLOR_ORANGE, 7);

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             _s[:nextStart]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE, Fmt.reloj(r));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE,
             _s[:lap] + " " + vuelta.format("%d") + " · "
             + (descansando ? _s[:rest] : _s[:running]));
    }

    function _paginaMargen(dc, cx, cy, h, radio, vuelta, r) {
        var km = _estado.kmEnLaVuelta();
        var objetivo = _estado.kmObjetivo();
        var margen = _estado.margenSegundos();
        var vaSobrado = (margen != null && margen >= 0);

        // Dos aros. Fuera, gris, el tiempo consumido. Dentro, en color, la
        // distancia recorrida. Si el de dentro adelanta al de fuera se llega
        // antes de la campana, y eso se ve sin leer un solo digito. En la
        // vuelta 0 no hay tiempo consumido ni distancia: ningun aro.
        if (vuelta >= 1) {
            _arco(dc, cx, cy, radio, 1.0 - (r.toFloat() / _estado.duracionVuelta),
                  Gfx.COLOR_LT_GRAY, 7);
            if (km != null && objetivo > 0) {
                _arco(dc, cx, cy, radio - 11, km / objetivo,
                      vaSobrado ? Gfx.COLOR_GREEN : Gfx.COLOR_RED, 5);
            }
        }

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             vuelta < 1 ? _s[:warmup] : _s[:margin]);

        if (margen == null) {
            // El primer kilometro miente: con trescientos metros hechos el
            // ritmo medio da tumbos y el margen saltaria minutos enteros de
            // una zancada a otra. Hasta entonces, un guion.
            _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_DK_GRAY, "--:--");
        } else {
            _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM,
                 vaSobrado ? Gfx.COLOR_GREEN : Gfx.COLOR_RED, Fmt.margen(margen));
        }

        // Las dos lineas de contexto del boceto: lo hecho contra el objetivo
        // con el ritmo, y lo que falta con el tiempo que costara al ritmo que
        // se lleva. El "≈" solo aparece cuando hay ritmo del que fiarse.
        var ritmo = _estado.ritmoSegPorKm();
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             Fmt.distancia(km) + " / " + Fmt.distancia(objetivo) + " "
             + Fmt.unidad() + " · " + Fmt.ritmo(ritmo) + " /" + Fmt.unidad());
        var faltan = null;
        if (km != null && objetivo > 0) {
            faltan = objetivo - km;
            if (faltan < 0) { faltan = 0.0; }
        }
        var linea = _s[:toGo] + " " + Fmt.distancia(faltan) + " " + Fmt.unidad();
        if (faltan != null && ritmo != null) {
            linea = linea + " ≈ " + Fmt.reloj((faltan * ritmo).toNumber());
        }
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY, linea);
    }

    // La pagina de datos: cuatro cifras de un vistazo, en el reparto clasico
    // de Garmin para cuatro campos en esfera redonda: uno arriba a lo ancho,
    // dos en el centro -que es donde la esfera es mas ancha y caben lado a
    // lado sin pisarse-, y uno abajo a lo ancho. La primera version era una
    // cuadricula 2x2 y los numeros montaban sobre las lineas.
    //
    // Arriba la distancia de toda la carrera -la que mide el reloj, con la
    // vuelta en curso incluida-; en el centro el ritmo de la vuelta y el
    // pulso; abajo el tiempo a la campana. Es la excepcion a la regla de una
    // cifra por pantalla: quien la mira quiere el estado completo, y ya tiene
    // las otras cuatro pantallas para leer grande.
    function _paginaDatos(dc, cx, cy, h, vuelta, r) {
        var w = dc.getWidth();
        var yArriba = cy - (h * 15 / 100);
        var yAbajo = cy + (h * 15 / 100);

        // Las lineas del marco, tenues: son mueble, no dato.
        dc.setPenWidth(1);
        dc.setColor(Gfx.COLOR_DK_GRAY, Gfx.COLOR_TRANSPARENT);
        dc.drawLine(cx - (w * 42 / 100), yArriba, cx + (w * 42 / 100), yArriba);
        dc.drawLine(cx - (w * 42 / 100), yAbajo, cx + (w * 42 / 100), yAbajo);
        dc.drawLine(cx, yArriba, cx, yAbajo);

        var info = Activity.getActivityInfo();
        var metros = info == null ? null : info.elapsedDistance;
        var pulso = info == null ? null : info.currentHeartRate;

        // En la vuelta 0 (calentamiento) todavia no hay vuelta que medir: el
        // ritmo va con guion. La distancia y el pulso si son de verdad, y el
        // restante es la cuenta atras a la salida.
        var ritmo = vuelta >= 1 ? _estado.ritmoSegPorKm() : null;

        _campo(dc, cx, cy - (h * 33 / 100), h, _s[:distance],
               Fmt.distancia(metros == null ? null : metros / 1000.0));
        _campo(dc, cx - (w * 22 / 100), cy - (h * 9 / 100), h,
               _s[:pace], Fmt.ritmo(ritmo));
        _campo(dc, cx + (w * 22 / 100), cy - (h * 9 / 100), h,
               _s[:heartRate], pulso == null ? "--" : pulso.format("%d"));
        _campo(dc, cx, cy + (h * 20 / 100), h, _s[:remaining], Fmt.reloj(r));
    }

    // Un campo de la pagina de datos: el rotulo pequeno y la cifra debajo.
    function _campo(dc, x, yRotulo, h, rotulo, valor) {
        _txt(dc, x, yRotulo, Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY, rotulo);
        _txt(dc, x, yRotulo + (h * 11 / 100), Gfx.FONT_NUMBER_MILD,
             Gfx.COLOR_WHITE, valor);
    }

    // Lo acumulado. Arriba, sin etiqueta, el tiempo que se lleva en carrera:
    // en una backyard esa cifra es la que se cuenta luego, y no cabe confundirla
    // con nada mas.
    // Con la vuelta en curso ya marcada, cuenta como completada: el corredor
    // cruzo la meta aunque la hora no haya cerrado. En la vuelta 0 no hay
    // nada completado; sin el tope, la cuenta daba -1.
    function _completadas(vuelta) {
        if (vuelta < 1) { return 0; }
        return (vuelta - 1) + (_estado.marcada() ? 1 : 0);
    }

    function _paginaTuyo(dc, cx, cy, h, radio, vuelta) {
        var completadas = _completadas(vuelta);
        // Antes de la campana de salida el tiempo de carrera es negativo; en
        // esta pagina eso se escribe como cero, no como una cuenta atras.
        var s = _estado.segundosDeCarrera();
        if (s != null && s < 0) { s = 0; }
        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             _s[:total]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE,
             completadas.format("%d"));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE,
             _s[:lapsDone]);
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             Fmt.espera(s) + " · "
             + Fmt.distancia(completadas * _estado.kmPorVuelta) + " "
             + Fmt.unidad());
    }

    // La hora del dia y la bateria. En una carrera de treinta horas, saber si
    // la bateria aguanta la noche es informacion de carrera, no un lujo. La
    // hora obedece al formato del reloj; el am/pm va abajo, pequeno, porque
    // las fuentes numericas grandes no tienen letras.
    function _paginaReloj(dc, cx, cy, h, radio) {
        var reloj = Sys.getClockTime();
        var hora = reloj.hour;
        var marca = null;
        if (!Sys.getDeviceSettings().is24Hour) {
            marca = hora < 12 ? "AM" : "PM";
            hora = hora % 12;
            if (hora == 0) { hora = 12; }
        }

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             _s[:clock]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE,
             hora.format("%d") + ":" + reloj.min.format("%02d"));

        // La bateria en rojo por debajo del 20 %: a esa altura ya es un dato
        // que decide si se cambia el modo de energia o se busca el cargador.
        var bateria = Sys.getSystemStats().battery;
        var poca = bateria != null && bateria <= 20;
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY,
             poca ? Gfx.COLOR_RED : Gfx.COLOR_WHITE,
             bateria == null ? _s[:battery]
                             : _s[:battery] + " " + bateria.format("%d") + "%");
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY, marca);
    }

    // --- piezas de dibujo ---

    function _yArriba(cy, h) { return cy - (h * 22 / 100); }
    function _ySub(cy, h)    { return cy + (h * 16 / 100); }
    function _yPie(cy, h)    { return cy + (h * 27 / 100); }
    function _yPie2(cy, h)   { return cy + (h * 35 / 100); }

    function _txt(dc, x, y, fuente, color, texto) {
        if (texto == null) { return; }
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(x, y, fuente, texto,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    // Connect IQ mide los angulos con el cero a las tres en punto y creciendo
    // en sentido antihorario. Aqui siempre se dibuja desde las doce y hacia la
    // derecha, que es como se lee un reloj.
    function _arco(dc, cx, cy, radio, fraccion, color, grosor) {
        if (fraccion == null || fraccion <= 0) { return; }

        // El barrido se redondea a grados enteros aqui, y no al final, porque
        // drawArc solo entiende grados enteros. Haciendolo al final, un aro
        // casi lleno acababa en el mismo grado en que empieza y desaparecia
        // justo despues de la campana, que es cuando mas lleno deberia verse.
        var grados = (360 * fraccion).toNumber();
        if (grados < 1) { grados = 1; }
        if (grados > 359) { grados = 359; }

        // El angulo final se normaliza a 0-360: sin esto un aro de mas de un
        // cuarto de vuelta acaba en grados negativos.
        var fin = 90 - grados;
        while (fin < 0) { fin += 360; }
        dc.setPenWidth(grosor);
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawArc(cx, cy, radio, Gfx.ARC_CLOCKWISE, 90, fin);
    }

    // Con una sola pagina visible no hay nada que navegar y las migas sobran.
    function _migas(dc, cx, h, n) {
        if (n < 2) { return; }
        var y = h - (h * 7 / 100);
        var paso = 9;
        var x0 = cx - (paso * (n - 1) / 2);
        for (var i = 0; i < n; i++) {
            dc.setColor(i == _pagina ? Gfx.COLOR_WHITE : Gfx.COLOR_DK_GRAY,
                        Gfx.COLOR_TRANSPARENT);
            dc.fillCircle(x0 + (i * paso), y, 2);
        }
    }
}
