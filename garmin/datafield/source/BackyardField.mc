using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;

// El margen, dentro de la actividad.
//
// La pantalla del margen de la app necesita que haya una actividad grabando,
// porque el ritmo sale de la distancia que lleva medida el reloj. Su sitio
// natural es este: un campo de datos que el corredor pone en su pantalla de
// carrera y ya no vuelve a tocar.
//
// El reloj de la carrera y los formatos son los mismos de la app, en
// ../shared/source. Lo que cambia es el dibujo, y cambia mucho: aqui la
// pantalla no es la esfera, es el trozo que el corredor le haya dejado, y puede
// ser una franja de cuarenta pixeles. Por eso el campo se dibuja en tres tallas
// y decide cual segun el sitio que tenga.
//
// Aqui no hay boton para volver a sellar el cero de la carrera: el campo de
// datos no recibe pulsaciones. El cero es siempre el arranque de la actividad,
// que en una backyard es justo lo que suena con la campana.
class BackyardField extends Ui.DataField {

    // Alturas por debajo de las cuales no cabe la talla siguiente. Son las de
    // una esfera de 240: por encima sobra sitio, y por debajo (relojes de 208)
    // el propio salto de talla se encarga.
    static const ALTO_MEDIANO = 55;
    static const ALTO_GRANDE = 110;

    var _estado;

    // Las cadenas se cargan una vez, y solo las tres que se dibujan. En un
    // campo de datos la memoria es mucho menor que en una app: cada recurso
    // que no se carga es memoria que le queda al resto de la actividad.
    var _rest;
    var _paceTooSlow;
    var _corral;

    function initialize(estado) {
        DataField.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        _rest = Ui.loadResource(Rez.Strings.rest);
        _paceTooSlow = Ui.loadResource(Rez.Strings.paceTooSlow);
        _corral = Ui.loadResource(Rez.Strings.corral);
    }

    // El reloj llama a esto una vez por segundo mientras la actividad corre.
    // Es el latido: aqui no hace falta el Timer que si necesita la app.
    function compute(info) {
        _estado.refrescarFoto();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();

        // El corredor puede tener el reloj en blanco sobre negro o al reves, y
        // un campo de datos que no lo respete se ve como un parche.
        var fondo = getBackgroundColor();
        var tinta = (fondo == Gfx.COLOR_BLACK) ? Gfx.COLOR_WHITE : Gfx.COLOR_BLACK;
        dc.setColor(fondo, fondo);
        dc.clear();

        var margen = _estado.margenSegundos();
        var aviso = Fmt.colorCorral(_estado.restante());
        var corral = aviso != null;
        var color = _color(margen, aviso, tinta);

        if (h >= ALTO_GRANDE && w >= ALTO_GRANDE) {
            _grande(dc, w, h, margen, color, corral, tinta);
        } else if (h >= ALTO_MEDIANO) {
            _mediano(dc, w, h, margen, color, corral, tinta);
        } else {
            _pequeno(dc, w, h, margen, color);
        }
    }

    // El margen manda el color: verde si sobra tiempo, rojo si a ese ritmo no
    // se llega. En el corral manda el semaforo de la campana (amarillo,
    // naranja, rojo) aunque el margen sea bueno, porque ahi lo urgente es la
    // campana y no el ritmo.
    function _color(margen, aviso, tinta) {
        if (aviso != null) { return aviso; }
        if (margen == null) { return Gfx.COLOR_DK_GRAY; }
        return margen >= 0 ? Gfx.COLOR_GREEN : Gfx.COLOR_RED;
    }

    // Una franja fina: solo la cifra, tan grande como quepa. Es el caso de
    // quien reparte la pantalla en tres campos.
    function _pequeno(dc, w, h, margen, color) {
        _txt(dc, w / 2, h / 2, Gfx.FONT_NUMBER_MILD, color, Fmt.margen(margen));
    }

    // Media pantalla: la cifra y, debajo, que significa.
    function _mediano(dc, w, h, margen, color, corral, tinta) {
        _txt(dc, w / 2, h / 2 - (h * 10 / 100), Gfx.FONT_NUMBER_MEDIUM, color,
             Fmt.margen(margen));
        _txt(dc, w / 2, h / 2 + (h * 30 / 100), Gfx.FONT_XTINY, tinta,
             _pie(margen, corral));
    }

    // Pantalla entera para un solo campo: cabe el aro de la vuelta, que es lo
    // que la app dibuja en su pagina de margen y lo que se lee sin leer.
    function _grande(dc, w, h, margen, color, corral, tinta) {
        var cx = w / 2;
        var cy = h / 2;
        var radio = (w < h ? w : h) / 2 - 4;
        var r = _estado.restante();

        if (r != null && _estado.duracionVuelta > 0) {
            _arco(dc, cx, cy, radio, r.toFloat() / _estado.duracionVuelta,
                  corral ? Gfx.COLOR_RED : Gfx.COLOR_ORANGE, 5);
        }

        _txt(dc, cx, cy - (h * 22 / 100), Gfx.FONT_XTINY, tinta, Fmt.reloj(r));
        _txt(dc, cx, cy, Gfx.FONT_NUMBER_MEDIUM, color, Fmt.margen(margen));
        _txt(dc, cx, cy + (h * 24 / 100), Gfx.FONT_XTINY, tinta,
             _pie(margen, corral));
    }

    // Hasta el primer kilometro el margen sale como guion, y entonces la
    // etiqueta de abajo mentiria: mejor no poner ninguna.
    function _pie(margen, corral) {
        if (corral) { return _corral; }
        if (margen == null) { return null; }
        return margen >= 0 ? _rest : _paceTooSlow;
    }

    function _txt(dc, x, y, fuente, color, texto) {
        if (texto == null) { return; }
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(x, y, fuente, texto,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    // Igual que en la app: Connect IQ pone el cero a las tres en punto y crece
    // en sentido antihorario; aqui siempre se dibuja desde las doce y hacia la
    // derecha, que es como se lee un reloj.
    function _arco(dc, cx, cy, radio, fraccion, color, grosor) {
        if (fraccion == null || fraccion <= 0) { return; }
        var grados = (360 * fraccion).toNumber();
        if (grados < 1) { grados = 1; }
        if (grados > 359) { grados = 359; }
        var fin = 90 - grados;
        while (fin < 0) { fin += 360; }
        dc.setPenWidth(grosor);
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawArc(cx, cy, radio, Gfx.ARC_CLOCKWISE, 90, fin);
    }
}
