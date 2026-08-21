using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Application as App;
using Toybox.Lang as Lang;

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

    var _estado;

    function initialize(estado) {
        Menu2InputDelegate.initialize();
        _estado = estado;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :duracion) {
            _abrirRueda(:minutos);
        } else if (id == :distancia) {
            _abrirRueda(:km);
        } else if (id == :autoLap) {
            // El ToggleMenuItem ya cambio su check al tocarlo; se guarda en la
            // misma propiedad que lee el telefono. No cierra el menu: el
            // corredor ve el nuevo estado y sigue.
            var ti = item as Ui.ToggleMenuItem;
            App.Properties.setValue("autoLap", ti.isEnabled());
            _estado.leerAjustes();
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
            factory = new NumeroFactory(1, 120, 1, 0, " min");
            titulo = Ui.loadResource(Rez.Strings.settingLapMinutes);
            actual = _estado.duracionVuelta / 60;
        } else {
            factory = new NumeroFactory(1.0, 20.0, 0.1, 1, " km");
            titulo = Ui.loadResource(Rez.Strings.settingLapDistance);
            actual = _estado.kmPorVuelta;
        }
        var picker = new Ui.Picker({
            :title => new Ui.Text({
                :text => titulo,
                :color => Gfx.COLOR_WHITE,
                :font => Gfx.FONT_XTINY,
                :locX => Ui.LAYOUT_HALIGN_CENTER,
                :locY => Ui.LAYOUT_VALIGN_BOTTOM
            }),
            :pattern => [ factory ],
            :defaults => [ factory.getIndex(actual) ]
        });
        Ui.pushView(picker, new NumeroPickerDelegate(_estado, cual),
                    Ui.SLIDE_LEFT);
    }
}

// Genera los valores de la rueda: del minimo al maximo en pasos, con sus
// decimales y su sufijo. Es la misma para minutos y para kilometros; solo
// cambian los numeros.
class NumeroFactory extends Ui.PickerFactory {

    // En Float siempre -aunque los minutos sean enteros- para que el
    // comprobador sepa que se puede dividir y formatear. Sin los tipos avisa
    // en cada compilacion.
    var _min as Lang.Float;
    var _paso as Lang.Float;
    var _decimales as Lang.Number;
    var _sufijo as Lang.String;
    var _n as Lang.Number;

    function initialize(minimo, maximo, paso, decimales, sufijo) {
        PickerFactory.initialize();
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

    function getDrawable(index, selected) {
        var v = _min + index * _paso;
        var texto = _decimales > 0
                  ? v.format("%.1f")
                  : v.toNumber().format("%d");
        return new Ui.Text({
            :text => texto + _sufijo,
            :color => Gfx.COLOR_WHITE,
            :font => Gfx.FONT_NUMBER_MEDIUM,
            :locX => Ui.LAYOUT_HALIGN_CENTER,
            :locY => Ui.LAYOUT_VALIGN_CENTER
        });
    }
}

// Al aceptar la rueda, guarda el valor en la propiedad que lee todo el mundo
// -la app y el telefono- y vuelve a la linea de salida, que ya muestra la
// cifra nueva. Cancelar deja el ajuste como estaba.
class NumeroPickerDelegate extends Ui.PickerDelegate {

    var _estado;
    var _cual;

    function initialize(estado, cual) {
        PickerDelegate.initialize();
        _estado = estado;
        _cual = cual;
    }

    function onCancel() {
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }

    function onAccept(valores) {
        var v = valores[0] as Lang.Float;
        if (_cual == :minutos) {
            App.Properties.setValue("lapMinutes", v.toNumber());
        } else {
            App.Properties.setValue("lapDistance", v.toFloat());
        }
        _estado.leerAjustes();
        // Cierra la rueda y el menu, de vuelta a la linea de salida.
        Ui.popView(Ui.SLIDE_DOWN);
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }
}
