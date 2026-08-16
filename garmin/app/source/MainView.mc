using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Lang as Lang;

// Las cuatro pantallas de carrera.
//
// Una sola cifra grande en cada una. A las veinte horas, de noche y con la
// vista cansada, solo se lee lo que ocupa media esfera: todo lo demas es
// contexto que se mira cuando sobra tiempo, y en una backyard nunca sobra.
class MainView extends Ui.View {

    enum {
        PAGINA_VUELTA = 0,
        PAGINA_MARGEN = 1,
        PAGINA_TUYO   = 2,
        PAGINA_EN_PIE = 3
    }
    static const PAGINAS = 4;

    // Ventana del aro antes de la salida: en los ultimos diez minutos el aro
    // se vacia, y antes de eso se queda lleno porque no dice nada util.
    static const VENTANA_PREVIA = 600;

    var _estado;
    var _pagina = PAGINA_VUELTA;
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
            :beforeStart => Ui.loadResource(Rez.Strings.beforeStart),
            :corral => Ui.loadResource(Rez.Strings.corral),
            :toTheLine => Ui.loadResource(Rez.Strings.toTheLine),
            :rest => Ui.loadResource(Rez.Strings.rest),
            :paceTooSlow => Ui.loadResource(Rez.Strings.paceTooSlow),
            :laps => Ui.loadResource(Rez.Strings.laps),
            :stillIn => Ui.loadResource(Rez.Strings.stillIn),
            :of => Ui.loadResource(Rez.Strings.of),
            :notStarted => Ui.loadResource(Rez.Strings.notStarted),
            :raceClosed => Ui.loadResource(Rez.Strings.raceClosed),
            :syncing => Ui.loadResource(Rez.Strings.syncing),
            :noBib => Ui.loadResource(Rez.Strings.noBib)
        };
    }

    function avanzar(paso) {
        _pagina = (_pagina + paso + PAGINAS) % PAGINAS;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var radio = (w < h ? w : h) / 2 - 6;

        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();

        if (!_estado.sincronizado) {
            _txt(dc, cx, cy, Gfx.FONT_MEDIUM, Gfx.COLOR_DK_GRAY, _s[:syncing]);
            return;
        }
        if (_estado.terminada) {
            _txt(dc, cx, cy, Gfx.FONT_MEDIUM, Gfx.COLOR_DK_GRAY, _s[:raceClosed]);
            _punto(dc, cx, h);
            return;
        }
        if (!_estado.empezada) {
            _antesDeLaSalida(dc, cx, cy, h, radio);
            _punto(dc, cx, h);
            return;
        }

        if (_pagina == PAGINA_MARGEN) {
            _paginaMargen(dc, cx, cy, h, radio);
        } else if (_pagina == PAGINA_TUYO) {
            _paginaTuyo(dc, cx, cy, h, radio);
        } else if (_pagina == PAGINA_EN_PIE) {
            _paginaEnPie(dc, cx, cy, h, radio);
        } else {
            _paginaVuelta(dc, cx, cy, h, radio);
        }

        _punto(dc, cx, h);
        _migas(dc, cx, h);
    }

    // --- pantallas ---

    function _antesDeLaSalida(dc, cx, cy, h, radio) {
        var r = _estado.restante();
        // A mas de un dia de la salida no hay cuenta atras que dar: el numero
        // no cabria y, sobre todo, no diria nada que el corredor no sepa.
        if (r == null || r <= 0 || Fmt.esperaLarga(r)) {
            _txt(dc, cx, cy, Gfx.FONT_MEDIUM, Gfx.COLOR_DK_GRAY, _s[:notStarted]);
            return;
        }
        var fraccion = r >= VENTANA_PREVIA ? 1.0 : r.toFloat() / VENTANA_PREVIA;
        _arco(dc, cx, cy, radio, fraccion, Gfx.COLOR_ORANGE, 7);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE, Fmt.espera(r));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE, _s[:beforeStart]);
    }

    function _paginaVuelta(dc, cx, cy, h, radio) {
        var vuelta = _estado.vuelta();
        var r = _estado.restante();
        var corral = _estado.enCorral();

        // El aro se vacia con la hora: lo que queda de aro es lo que queda de
        // vuelta. Es la misma cifra del centro, legible sin leer.
        _arco(dc, cx, cy, radio, r.toFloat() / _estado.duracionVuelta,
              corral ? Gfx.COLOR_RED : Gfx.COLOR_ORANGE, 7);

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY,
             corral ? Gfx.COLOR_RED : Gfx.COLOR_LT_GRAY,
             corral ? _s[:corral] : _s[:lap] + " " + vuelta.format("%d"));
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM,
             corral ? Gfx.COLOR_RED : Gfx.COLOR_WHITE, Fmt.reloj(r));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE,
             corral ? _s[:toTheLine] : _s[:nextStart]);
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             Fmt.distancia(_estado.kmAcumulados()) + " " + Fmt.unidad());
    }

    function _paginaMargen(dc, cx, cy, h, radio) {
        var r = _estado.restante();
        var km = _estado.kmEnLaVuelta();
        var objetivo = _estado.kmObjetivo();
        var margen = _estado.margenSegundos();
        var vaSobrado = (margen != null && margen >= 0);

        // Dos aros. Fuera, gris, el tiempo consumido. Dentro, en color, la
        // distancia recorrida. Si el de dentro adelanta al de fuera se llega
        // antes de la campana, y eso se ve sin leer un solo digito.
        _arco(dc, cx, cy, radio, 1.0 - (r.toFloat() / _estado.duracionVuelta),
              Gfx.COLOR_LT_GRAY, 7);
        if (km != null && objetivo > 0) {
            _arco(dc, cx, cy, radio - 11, km / objetivo,
                  vaSobrado ? Gfx.COLOR_GREEN : Gfx.COLOR_RED, 5);
        }

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             _s[:lap] + " " + _estado.vuelta().format("%d"));

        if (margen == null) {
            // El primer kilometro miente: con trescientos metros hechos el
            // ritmo medio da tumbos y el margen saltaria minutos enteros de
            // una zancada a otra. Hasta entonces, un guion.
            _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_DK_GRAY, "--:--");
        } else {
            _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM,
                 vaSobrado ? Gfx.COLOR_GREEN : Gfx.COLOR_RED, Fmt.margen(margen));
            _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE,
                 vaSobrado ? _s[:rest] : _s[:paceTooSlow]);
        }

        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             Fmt.distancia(km) + " / " + Fmt.distancia(objetivo) + " " + Fmt.unidad());
        _txt(dc, cx, _yPie2(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             Fmt.ritmo(_estado.ritmoSegPorKm()) + " /" + Fmt.unidad());
    }

    function _paginaTuyo(dc, cx, cy, h, radio) {
        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY,
             _estado.dorsal != null ? "#" + _estado.dorsal : _s[:noBib]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE,
             _estado.vueltasCompletadas().format("%d"));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE, _s[:laps]);
        _txt(dc, cx, _yPie(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
             Fmt.distancia(_estado.kmAcumulados()) + " " + Fmt.unidad());
    }

    function _paginaEnPie(dc, cx, cy, h, radio) {
        var fraccion = _estado.inscritos > 0
            ? _estado.enCarrera.toFloat() / _estado.inscritos
            : 0.0;
        _arco(dc, cx, cy, radio, fraccion, Gfx.COLOR_GREEN, 7);

        _txt(dc, cx, _yArriba(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_LT_GRAY, _s[:stillIn]);
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, Gfx.COLOR_WHITE,
             _estado.enCarrera.format("%d"));
        _txt(dc, cx, _ySub(cy, h), Gfx.FONT_XTINY, Gfx.COLOR_WHITE,
             _s[:of] + " " + _estado.inscritos.format("%d"));
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

    // El punto de sincronia. Verde: los datos son de hace poco. Gris: el
    // telefono no esta cerca, pero la cuenta atras del centro sigue siendo
    // buena, porque la lleva el reloj y no la red.
    function _punto(dc, cx, h) {
        var edad = _estado.edadDatos();
        var fresco = (edad != null && edad < _estado.segundosRefresco * 3);
        dc.setColor(fresco ? Gfx.COLOR_GREEN : Gfx.COLOR_DK_GRAY, Gfx.COLOR_TRANSPARENT);
        dc.fillCircle(cx, h * 13 / 100, 3);
        if (!fresco && edad != null) {
            _txt(dc, cx, h * 20 / 100, Gfx.FONT_XTINY, Gfx.COLOR_DK_GRAY,
                 (edad / 60).format("%d") + " min");
        }
    }

    function _migas(dc, cx, h) {
        var y = h - (h * 7 / 100);
        var paso = 9;
        var x0 = cx - (paso * (PAGINAS - 1) / 2);
        for (var i = 0; i < PAGINAS; i++) {
            dc.setColor(i == _pagina ? Gfx.COLOR_WHITE : Gfx.COLOR_DK_GRAY,
                        Gfx.COLOR_TRANSPARENT);
            dc.fillCircle(x0 + (i * paso), y, 2);
        }
    }
}
