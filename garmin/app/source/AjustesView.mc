using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Application as App;
using Toybox.Lang as Lang;
using Toybox.System as Sys;

// Los ajustes de la vuelta, desde el reloj.
//
// Normalmente la duracion y la distancia de la vuelta se ponen una vez desde
// Garmin Connect, en el telefono. Pero en la linea de salida, con el boton de
// menu (UP largo), el corredor los puede fijar sin sacar el telefono: un menu
// con las dos cifras y, al tocarlas, una rueda para elegir el valor. Se guarda
// en las mismas propiedades que lee el telefono, asi que da igual por donde se
// cambie.
//
// Solo se abre antes de dar la salida: cambiar la duracion a mitad de carrera
// moveria las campanas, y la campana no se discute.

// El menu con las dos cifras. El rotulo va como id de recurso -cargarlo a mano
// dejaba el Menu2 en blanco en el fenix 8-; el valor actual va de sub-rotulo.
class AjustesMenuDelegate extends Ui.Menu2InputDelegate {

    // Arma y abre el menu completo. Lo usan la linea de salida (UP largo) y
    // el calentamiento, que es el otro momento en que aun se puede ajustar:
    // la campana de la vuelta 1 todavia no sono.
    static function abrir(estado) {
        var menu = new Ui.Menu2({ :title => Rez.Strings.settingsTitle });
        // La hora de salida va primero: es lo primero que se decide.
        menu.addItem(new Ui.MenuItem(Rez.Strings.settingStartTime,
            textoDeSalida(estado.horaSalida), :salida, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.settingLapMinutes,
            (estado.duracionVuelta / 60).format("%d") + " min", :duracion, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.settingLapDistance,
            estado.kmPorVuelta.format("%.1f") + " km", :distancia, null));
        // Las vueltas automaticas y el LAP apagado son interruptores; el
        // check muestra el estado.
        menu.addItem(new Ui.ToggleMenuItem(Rez.Strings.settingAutoLap, null,
            :autoLap, estado.autoLap, null));
        menu.addItem(new Ui.ToggleMenuItem(Rez.Strings.settingAutoLapKm, null,
            :autoLapKm, estado.autoLapKm, null));
        menu.addItem(new Ui.ToggleMenuItem(Rez.Strings.settingLapOff, null,
            :lapOff, estado.lapApagado, null));
        menu.addItem(new Ui.ToggleMenuItem(Rez.Strings.settingVibration, null,
            :vibracion, estado.vibracion, null));
        menu.addItem(new Ui.ToggleMenuItem(Rez.Strings.settingSound, null,
            :sonido, estado.sonido, null));
        // Las pantallas de carrera: cuales se ven. El orden se cambia desde
        // el telefono; aqui solo mostrar u ocultar.
        menu.addItem(new Ui.MenuItem(Rez.Strings.settingScreens, null,
            :pantallas, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.settingAbout, null,
            :acerca, null));
        Ui.pushView(menu, new AjustesMenuDelegate(estado), Ui.SLIDE_UP);
    }

    var _estado;

    function initialize(estado) {
        Menu2InputDelegate.initialize();
        _estado = estado;
    }

    // El sub-rotulo del ajuste de salida: la hora fija como la escribe el
    // reloj, o "Auto".
    static function textoDeSalida(horaSalida) {
        if (horaSalida < 0) {
            return Ui.loadResource(Rez.Strings.auto);
        }
        var h = horaSalida / 100;
        var m = horaSalida % 100;
        if (Sys.getDeviceSettings().is24Hour) {
            return h.format("%d") + ":" + m.format("%02d");
        }
        var marca = h < 12 ? "AM" : "PM";
        var h12 = h % 12;
        if (h12 == 0) { h12 = 12; }
        return h12.format("%d") + ":" + m.format("%02d") + " " + marca;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :salida) {
            _abrirSalida();
        } else if (id == :duracion) {
            _abrirRueda(:minutos);
        } else if (id == :distancia) {
            _abrirRueda(:km);
        } else if (id == :autoLap || id == :autoLapKm || id == :lapOff
                   || id == :vibracion || id == :sonido) {
            // El ToggleMenuItem ya cambio su check al tocarlo; se guarda en la
            // misma propiedad que lee el telefono. No cierra el menu: el
            // corredor ve el nuevo estado y sigue.
            var ti = item as Ui.ToggleMenuItem;
            var clave = id == :autoLap ? "autoLap"
                      : id == :autoLapKm ? "autoLapKm"
                      : id == :lapOff ? "lapOff"
                      : id == :vibracion ? "vibration" : "sound";
            App.Properties.setValue(clave, ti.isEnabled());
            _estado.leerAjustes();
        } else if (id == :pantallas) {
            var vista = new PantallasView(_estado);
            Ui.pushView(vista, new PantallasDelegate(vista), Ui.SLIDE_LEFT);
        } else if (id == :acerca) {
            Ui.pushView(new AcercaView(), new AcercaDelegate(), Ui.SLIDE_LEFT);
        }
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
    }

    // Abre la rueda de numeros del ajuste elegido, con el valor actual ya
    // marcado para que girar poco baste.
    function _abrirRueda(cual) {
        var factory;
        var titulo;
        var actual;
        if (cual == :minutos) {
            factory = new NumeroFactory(1, 120, 1, 0, "min");
            titulo = Ui.loadResource(Rez.Strings.settingLapMinutes);
            actual = _estado.duracionVuelta / 60;
        } else {
            factory = new NumeroFactory(1.0, 20.0, 0.1, 1, "km");
            titulo = Ui.loadResource(Rez.Strings.settingLapDistance);
            actual = _estado.kmPorVuelta;
        }
        var rueda = new RuedaView(titulo, [ factory ],
                                  [ factory.getIndex(actual) ], null);
        Ui.pushView(rueda,
                    new RuedaDelegate(rueda,
                                      new NumeroPickerDelegate(_estado, cual)),
                    Ui.SLIDE_LEFT);
    }

    // La hora de salida se decide en dos pasos: primero Auto u hora fija.
    // Con Auto no hay nada mas que preguntar: se guarda y se cierra. Solo
    // la hora fija abre la rueda de hora y minutos.
    function _abrirSalida() {
        var menu = new Ui.Menu2({ :title => Rez.Strings.settingStartTime });
        menu.addItem(new Ui.MenuItem(Rez.Strings.auto, null, :auto, null));
        menu.addItem(new Ui.MenuItem(Rez.Strings.fixedTime,
            _estado.horaSalida >= 0
                ? AjustesMenuDelegate.textoDeSalida(_estado.horaSalida) : null,
            :fija, null));
        Ui.pushView(menu, new SalidaMenuDelegate(_estado), Ui.SLIDE_LEFT);
    }
}

// El menu de Auto u hora fija. Auto guarda -1 y cierra todo; la hora fija
// abre la rueda.
class SalidaMenuDelegate extends Ui.Menu2InputDelegate {

    var _estado;

    function initialize(estado) {
        Menu2InputDelegate.initialize();
        _estado = estado;
    }

    function onSelect(item) {
        if (item.getId() == :auto) {
            App.Properties.setValue("startTime", -1);
            _estado.leerAjustes();
            SalidaPickerDelegate.resellar(_estado);
            // Cierra este menu y el de ajustes, de vuelta a donde se estaba.
            Ui.popView(Ui.SLIDE_DOWN);
            Ui.popView(Ui.SLIDE_DOWN);
            return;
        }
        var horas = new HoraSalidaFactory();
        var minutos = new MinutoSalidaFactory();
        var actual = _estado.horaSalida;
        var rueda = new RuedaView(Ui.loadResource(Rez.Strings.settingStartTime),
                                  [ horas, minutos ],
                                  [ horas.indiceDe(actual),
                                    minutos.indiceDe(actual) ], ":");
        Ui.pushView(rueda,
                    new RuedaDelegate(rueda,
                                      new SalidaPickerDelegate(_estado)),
                    Ui.SLIDE_LEFT);
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
    }
}

// La rueda de valores, dibujada por nosotros.
//
// No es un Ui.Picker, y no por gusto: el Picker pinta el fondo con el tema
// del reloj, y en la generacion fenix 5 ese tema es BLANCO. Las letras
// blancas de la app quedaban invisibles -se veia el hueco de las letras y
// nada mas-. No hay opcion para cambiar ese fondo: ni :backgroundColor ni
// nada parecido. Limpiar a negro en el onUpdate de un Picker propio tampoco
// vale (el Picker repinta despues), y hacerlo desde el titulo solo ennegrece
// su banda, porque el Picker recorta cada elemento a su zona.
//
// Dibujandola entera aqui, el fondo es negro y las letras blancas en los 46
// relojes, igual que el resto de la app. Y de paso la columna sin foco va en
// LT_GRAY y no en DK_GRAY, que en los MIP monocromos no se ve.
class RuedaView extends Ui.View {

    // Con tipos: sin ellos el comprobador avisa en cada acceso a los arrays.
    var _titulo as Lang.String;
    var _columnas as Lang.Array;                 // una o dos columnas
    var _indices as Lang.Array<Lang.Number>;     // donde esta cada una
    var _separador;                              // ":" entre hora y minuto
    var _foco as Lang.Number;                    // la que mueven UP y DOWN

    function initialize(titulo, columnas, indices, separador) {
        View.initialize();
        _titulo = titulo;
        _columnas = columnas;
        _indices = indices;
        _separador = separador;
        _foco = 0;
    }

    // UP y DOWN mueven la columna con foco, dando la vuelta por los extremos.
    function mover(paso) {
        var n = _columnas[_foco].getSize();
        _indices[_foco] = ((_indices[_foco] + paso) + n) % n;
    }

    // START pasa a la columna siguiente; si ya era la ultima, devuelve false
    // y el que manda acepta.
    function avanzarFoco() {
        if (_foco + 1 >= _columnas.size()) { return false; }
        _foco++;
        return true;
    }

    function valores() as Lang.Array {
        var v = new [_columnas.size()] as Lang.Array;
        for (var i = 0; i < _columnas.size(); i++) {
            v[i] = _columnas[i].getValue(_indices[i]);
        }
        return v;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_BLACK);
        dc.clear();

        dc.setColor(Gfx.COLOR_LT_GRAY, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, (h * 0.20).toNumber(), Gfx.FONT_XTINY, _titulo,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);

        var n = _columnas.size();
        var medio = (h * 0.52).toNumber();
        // Con dos columnas cada una tiene su tercio; el hueco del medio es
        // del separador.
        var centros = n == 1
                    ? [ w / 2 ]
                    : [ (w * 0.33).toNumber(), (w * 0.67).toNumber() ];
        var hueco = n == 1 ? (w * 0.80).toNumber() : (w * 0.40).toNumber();

        // Si alguna columna lleva marca -AM/PM, min, km-, TODAS las cifras
        // suben lo mismo: si sube solo la que la lleva, la hora queda mas
        // alta que los minutos y se nota.
        var altoMarca = dc.getFontHeight(Gfx.FONT_XTINY);
        var hayMarca = false;
        for (var i = 0; i < n; i++) {
            if (_columnas[i].marcaDe(_indices[i]) != null) { hayMarca = true; }
        }
        var yCifra = hayMarca ? medio - (altoMarca / 2) : medio;

        for (var i = 0; i < n; i++) {
            var texto = _columnas[i].textoDe(_indices[i]);
            var marca = _columnas[i].marcaDe(_indices[i]);
            var fuente = _fuenteQueQuepa(dc, texto, hueco);
            dc.setColor(i == _foco ? Gfx.COLOR_WHITE : Gfx.COLOR_LT_GRAY,
                        Gfx.COLOR_TRANSPARENT);
            dc.drawText(centros[i], yCifra, fuente, texto,
                        Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
            if (marca != null) {
                // La marca va debajo, y el centro de una y otra se separan
                // media cifra MAS media marca: contar solo la cifra dejaba el
                // AM montado encima del numero.
                dc.drawText(centros[i],
                            yCifra + (dc.getFontHeight(fuente) / 2)
                                   + (altoMarca / 2),
                            Gfx.FONT_XTINY, marca,
                            Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
            }
        }

        if (_separador != null && n == 2) {
            dc.setColor(Gfx.COLOR_LT_GRAY, Gfx.COLOR_TRANSPARENT);
            dc.drawText(w / 2, yCifra, Gfx.FONT_MEDIUM, _separador,
                        Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
        }

        // Las flechas dicen que esa columna es la que se mueve. Sin palabras:
        // asi no hay que traducir nada.
        var salto = (h * 0.19).toNumber();
        _flecha(dc, centros[_foco], medio - salto, true);
        _flecha(dc, centros[_foco], medio + salto, false);
    }

    // La fuente mas grande en la que el valor todavia cabe. Medido, no
    // supuesto: "12 PM" en la rueda de horas no ocupa lo que "6".
    function _fuenteQueQuepa(dc, texto, ancho) {
        var fuentes = [ Gfx.FONT_NUMBER_MEDIUM, Gfx.FONT_NUMBER_MILD,
                        Gfx.FONT_LARGE, Gfx.FONT_MEDIUM, Gfx.FONT_SMALL ];
        for (var i = 0; i < fuentes.size(); i++) {
            if (dc.getTextWidthInPixels(texto, fuentes[i]) <= ancho) {
                return fuentes[i];
            }
        }
        return Gfx.FONT_XTINY;
    }

    function _flecha(dc, cx, cy, haciaArriba) {
        var b = (dc.getWidth() * 0.035).toNumber();
        var a = (dc.getWidth() * 0.032).toNumber();
        dc.setColor(Gfx.COLOR_LT_GRAY, Gfx.COLOR_TRANSPARENT);
        if (haciaArriba) {
            dc.fillPolygon([ [cx - b, cy + a], [cx + b, cy + a], [cx, cy] ]);
        } else {
            dc.fillPolygon([ [cx - b, cy - a], [cx + b, cy - a], [cx, cy] ]);
        }
    }
}

// El manejo de la rueda: UP y DOWN cambian el valor, START pasa de columna y
// al final acepta, BACK cancela. Quien decide que hacer con el valor es el
// delegado de destino, el mismo de antes.
class RuedaDelegate extends Ui.BehaviorDelegate {

    var _vista;
    var _destino;

    function initialize(vista, destino) {
        BehaviorDelegate.initialize();
        _vista = vista;
        _destino = destino;
    }

    function onNextPage() {
        _vista.mover(1);
        Ui.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        _vista.mover(-1);
        Ui.requestUpdate();
        return true;
    }

    function onSelect() {
        if (_vista.avanzarFoco()) {
            Ui.requestUpdate();
            return true;
        }
        _destino.onAccept(_vista.valores());
        return true;
    }

    function onBack() {
        _destino.onCancel();
        return true;
    }
}

// La columna de horas de la rueda de salida: las 24 horas del dia,
// escritas como las escribe el reloj (12 o 24 horas).
class HoraSalidaFactory {

    function initialize() {
    }

    function getSize() {
        return 24;
    }

    function getValue(index) {
        return index;
    }

    // Sin hora fijada, la rueda arranca en las 7:00: la salida clasica.
    function indiceDe(horaSalida) {
        if (horaSalida < 0) { return 7; }
        return horaSalida / 100;
    }

    function textoDe(index) {
        if (Sys.getDeviceSettings().is24Hour) {
            return index.format("%d");
        }
        var h12 = index % 12;
        if (h12 == 0) { h12 = 12; }
        return h12.format("%d");
    }

    // AM o PM va aparte: la fuente de cifras no tiene letras, y pegado al
    // numero salen dos cajas vacias.
    function marcaDe(index) {
        if (Sys.getDeviceSettings().is24Hour) { return null; }
        return index < 12 ? "AM" : "PM";
    }
}

// La columna de minutos: 00 a 55 en pasos de cinco.
class MinutoSalidaFactory {

    function initialize() {
    }

    function getSize() {
        return 12;
    }

    function getValue(index) {
        return index * 5;
    }

    function indiceDe(horaSalida) {
        if (horaSalida < 0) { return 0; }
        var i = ((horaSalida % 100) + 2) / 5;
        return i < 12 ? i : 11;
    }

    function textoDe(index) {
        return (index * 5).format("%02d");
    }

    function marcaDe(index) {
        return null;
    }
}

// Al aceptar la rueda de salida se guarda el HHMM elegido. Si el cambio
// ocurre durante el calentamiento, el ancla se vuelve a sellar, igual que
// al cambiar la duracion: la campana 1 aun no sono.
class SalidaPickerDelegate {

    // Re-sella el ancla si hay carrera abierta y la campana 1 no ha sonado.
    // Compartido con el camino de Auto del menu.
    static function resellar(estado) {
        if (estado.campana0 == null) { return; }
        var vuelta = estado.vuelta();
        if (vuelta != null && vuelta == 0) {
            estado.darLaSalida();
            estado.guardar();
        }
    }

    var _estado;

    function initialize(estado) {
        _estado = estado;
    }

    function onCancel() {
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }

    function onAccept(valores as Lang.Array) {
        var hora = valores[0] as Lang.Number;
        var minuto = valores[1] as Lang.Number;
        App.Properties.setValue("startTime", (hora * 100) + minuto);
        _estado.leerAjustes();
        SalidaPickerDelegate.resellar(_estado);
        // Cierra la rueda, el menu de Auto/fija y el de ajustes.
        Ui.popView(Ui.SLIDE_DOWN);
        Ui.popView(Ui.SLIDE_DOWN);
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }
}

// Genera los valores de la rueda: del minimo al maximo en pasos, con sus
// decimales y su sufijo. Es la misma para minutos y para kilometros; solo
// cambian los numeros.
class NumeroFactory {

    // En Float siempre -aunque los minutos sean enteros- para que el
    // comprobador sepa que se puede dividir y formatear. Sin los tipos avisa
    // en cada compilacion.
    var _min as Lang.Float;
    var _paso as Lang.Float;
    var _decimales as Lang.Number;
    var _sufijo as Lang.String;
    var _n as Lang.Number;

    function initialize(minimo, maximo, paso, decimales, sufijo) {
        _min = minimo.toFloat();
        _paso = paso.toFloat();
        _decimales = decimales;
        _sufijo = sufijo;
        _n = (((maximo.toFloat() - _min) / _paso) + 0.5).toNumber() + 1;
    }

    function getSize() {
        return _n;
    }

    function getValue(index) {
        return _min + index * _paso;
    }

    // El indice mas cercano a un valor, para arrancar la rueda donde esta el
    // ajuste actual.
    function getIndex(valor) {
        var i = (((valor.toFloat() - _min) / _paso) + 0.5).toNumber();
        if (i < 0) { i = 0; }
        if (i >= _n) { i = _n - 1; }
        return i;
    }

    function textoDe(index) {
        var v = _min + index * _paso;
        return _decimales > 0
             ? v.format("%.1f")
             : v.toNumber().format("%d");
    }

    // "min" o "km" debajo de la cifra, por lo mismo que el AM/PM: en la
    // fuente de cifras las letras no existen.
    function marcaDe(index) {
        return _sufijo;
    }
}

// Al aceptar la rueda, guarda el valor en la propiedad que lee todo el mundo
// -la app y el telefono- y vuelve a la linea de salida, que ya muestra la
// cifra nueva. Cancelar deja el ajuste como estaba.
class NumeroPickerDelegate {

    var _estado;
    var _cual;

    function initialize(estado, cual) {
        _estado = estado;
        _cual = cual;
    }

    function onCancel() {
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }

    function onAccept(valores as Lang.Array) {
        var v = valores[0] as Lang.Float;
        if (_cual == :minutos) {
            App.Properties.setValue("lapMinutes", v.toNumber());
        } else {
            App.Properties.setValue("lapDistance", v.toFloat());
        }
        _estado.leerAjustes();
        // Si la duracion cambia durante el calentamiento, el ancla se sella
        // de nuevo con la duracion nueva: la campana de la vuelta 1 todavia
        // no sono, asi que mover el cero es legitimo. En carrera este menu
        // no se abre, y ahi el ancla no se toca jamas.
        if (_cual == :minutos && _estado.campana0 != null) {
            var vuelta = _estado.vuelta();
            if (vuelta != null && vuelta == 0) {
                _estado.darLaSalida();
                _estado.guardar();
            }
        }
        // Cierra la rueda y el menu, de vuelta a donde se estaba.
        Ui.popView(Ui.SLIDE_DOWN);
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }
}

// El catalogo de pantallas: cada una se dibuja ENTERA, con datos de
// muestra, y el corredor decide viendola -no adivinando por el nombre-.
// UP/DOWN recorre las seis en el orden de fabrica; START o un toque la
// muestra u oculta; BACK vuelve al menu de ajustes.
//
// Escribe en las mismas propiedades pageLap..pageClock que el telefono:
// ocultar pone 0 y mostrar devuelve la posicion de fabrica, asi que un
// orden personalizado desde el telefono se rehace ahi. El orden -que
// pantalla va primera- se cambia solo desde el telefono: una esfera no es
// sitio para arrastrar listas. Si el corredor las oculta todas, RaceState
// deja la de yard: la app no se queda sin pantalla.
class PantallasView extends Ui.View {

    // Ids de pantalla en el orden de fabrica, con su propiedad y su
    // posicion (los mismos de RaceState.AJUSTES_PAGINAS y properties.xml).
    static const IDS = [5, 2, 1, 0, 3, 4];
    static const CLAVES = ["pageDataLap", "pageData", "pageMargin",
                           "pageLap", "pageTotal", "pageClock"];
    static const POSICIONES = [1, 2, 3, 4, 5, 6];

    var _estado;
    // Un MainView propio, solo como lienzo: dibuja las paginas de verdad,
    // con los mismos metodos que las dibujan en carrera.
    var _lienzo;
    var _i = 0;
    var _nombres as Lang.Array<Lang.String> = [];
    var _visible;
    var _oculta;

    function initialize(estado) {
        View.initialize();
        _estado = estado;
        _lienzo = new MainView(estado);
    }

    function onLayout(dc) {
        _lienzo.onLayout(dc);
        _nombres = [
            Ui.loadResource(Rez.Strings.screenDataLap),
            Ui.loadResource(Rez.Strings.screenData),
            Ui.loadResource(Rez.Strings.margin),
            Ui.loadResource(Rez.Strings.lap),
            Ui.loadResource(Rez.Strings.total),
            Ui.loadResource(Rez.Strings.clock)
        ] as Lang.Array<Lang.String>;
        _visible = Ui.loadResource(Rez.Strings.screenShown);
        _oculta = Ui.loadResource(Rez.Strings.screenHidden);
    }

    function avanzar(paso) {
        var n = (IDS as Lang.Array<Lang.Number>).size();
        _i = (_i + paso + n) % n;
    }

    function alternar() {
        var clave = (CLAVES as Lang.Array<Lang.String>)[_i];
        var pos = (POSICIONES as Lang.Array<Lang.Number>)[_i];
        try {
            App.Properties.setValue(clave, _estaVisible() ? 0 : pos);
        } catch (e) {
        }
        _estado.leerAjustes();
    }

    function _estaVisible() {
        try {
            var v = App.Properties.getValue(
                (CLAVES as Lang.Array<Lang.String>)[_i]);
            var pos = v == null
                ? (POSICIONES as Lang.Array<Lang.Number>)[_i] : v.toNumber();
            return pos > 0;
        } catch (e) {
            return true;
        }
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();

        _lienzo.dibujarPagina(dc, (IDS as Lang.Array<Lang.Number>)[_i]);

        // La franja del catalogo, abajo: el nombre con su lugar en la lista
        // y el estado en color -verde visible, gris oculta-. Tapa la zona
        // de las migas, que en el catalogo no significan nada.
        var alto = h * 22 / 100;
        var visible = _estaVisible();
        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_TRANSPARENT);
        dc.fillRectangle(0, h - alto, w, alto);
        dc.setPenWidth(1);
        dc.setColor(Gfx.COLOR_DK_GRAY, Gfx.COLOR_TRANSPARENT);
        dc.drawLine(w * 25 / 100, h - alto, w * 75 / 100, h - alto);

        var n = (IDS as Lang.Array<Lang.Number>).size();
        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h - (alto * 70 / 100), Gfx.FONT_XTINY,
                    _nombres[_i] + " · " + (_i + 1).format("%d") + "/"
                    + n.format("%d"),
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
        dc.setColor(visible ? Gfx.COLOR_GREEN : Gfx.COLOR_LT_GRAY,
                    Gfx.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h - (alto * 30 / 100), Gfx.FONT_XTINY,
                    visible ? _visible : _oculta,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }
}

class PantallasDelegate extends Ui.BehaviorDelegate {

    var _vista;

    function initialize(vista) {
        BehaviorDelegate.initialize();
        _vista = vista;
    }

    function onNextPage() {
        _vista.avanzar(1);
        Ui.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        _vista.avanzar(-1);
        Ui.requestUpdate();
        return true;
    }

    // START muestra u oculta la pantalla que se esta viendo. En los
    // tactiles, el toque hace lo mismo.
    function onSelect() {
        _vista.alternar();
        Ui.requestUpdate();
        return true;
    }

    function onTap(evento) {
        return onSelect();
    }

    function onSwipe(evento) {
        var direccion = evento.getDirection();
        if (direccion == Ui.SWIPE_UP) {
            return onNextPage();
        }
        if (direccion == Ui.SWIPE_DOWN) {
            return onPreviousPage();
        }
        return false;
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }
}
