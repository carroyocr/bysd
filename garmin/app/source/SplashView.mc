using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Timer as Timer;

// El emblema, a pantalla completa, poco mas de un segundo.
//
// El logo ya es un circulo sobre fondo negro, asi que entra en la esfera sin
// recortar nada. De aqui se pasa directo a la vuelta: no hay pantalla
// intermedia ni nombre de carrera. En la vuelta uno el emblema emociona; en la
// vuelta veinte estorba, y por eso cualquier boton lo salta.
class SplashView extends Ui.View {

    static const MILISEGUNDOS = 1200;

    var _estado;
    var _timer;
    var _emblema;
    var _yaSalio = false;

    function initialize(estado) {
        View.initialize();
        _estado = estado;
    }

    function onLayout(dc) {
        _emblema = Ui.loadResource(Rez.Drawables.Emblema);
    }

    function onShow() {
        _timer = new Timer.Timer();
        _timer.start(method(:salir), MILISEGUNDOS, false);
    }

    function onHide() {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        // Son unos 20 KB de mapa de bits. En un reloj eso es dinero, y a
        // partir de aqui no se vuelve a dibujar.
        _emblema = null;
    }

    function onUpdate(dc) {
        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();
        if (_emblema == null) { return; }

        var w = dc.getWidth();
        var h = dc.getHeight();
        var ancho = _emblema.getWidth();
        var alto = _emblema.getHeight();

        // El monkey.jungle reparte un emblema por tamano de pantalla, pero esa
        // cuenta se puede quedar corta con un reloj que todavia no existe. Si
        // el emblema no cabe se encoge, porque recortarlo no se ve como un
        // fallo: se ve como un logo mal hecho, y nadie lo reporta.
        if ((ancho > w || alto > h) && (dc has :drawScaledBitmap)) {
            var lado = (w < h ? w : h);
            dc.drawScaledBitmap((w - lado) / 2, (h - lado) / 2, lado, lado, _emblema);
            return;
        }

        dc.drawBitmap((w - ancho) / 2, (h - alto) / 2, _emblema);
    }

    // 'as Void' por lo mismo que en BysdApp: lo pide Timer.start.
    function salir() as Void {
        if (_yaSalio) { return; }
        _yaSalio = true;
        SplashView.irALaVuelta(_estado);
    }

    // Compartido con el delegado: los dos caminos, el del reloj y el del
    // boton, tienen que acabar en la misma vista.
    static function irALaVuelta(estado) {
        var vista = new MainView(estado);
        Ui.switchToView(vista, new MainDelegate(vista, estado), Ui.SLIDE_IMMEDIATE);
    }
}

class SplashDelegate extends Ui.BehaviorDelegate {

    var _estado;

    function initialize(estado) {
        BehaviorDelegate.initialize();
        _estado = estado;
    }

    function onSelect() {
        SplashView.irALaVuelta(_estado);
        return true;
    }

    function onNextPage() {
        SplashView.irALaVuelta(_estado);
        return true;
    }

    // onBack se deja sin tocar a proposito: si alguien quiere salir de la app
    // durante el segundo del emblema, que pueda salir.
}
