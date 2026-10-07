using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;

// Acerca de: el nombre con la version, una invitacion a un cafe y el QR de
// Buy Me a Coffee. La app es gratis y lo seguira siendo; el QR es para
// quien quiera agradecerla (lo sugirio un usuario de la tienda, 7-oct-2026).
// Hasta la 1.8.0 el QR llevaba al sitio del evento.
//
// La version se escribe aqui y se actualiza con cada envio a la tienda:
// Connect IQ no deja leerla del manifiesto en tiempo de ejecucion. El QR va
// como bitmap en los recursos (lo genera segno, con su zona quieta blanca)
// porque dibujar un QR modulo a modulo en la esfera seria memoria y codigo
// para algo que no cambia nunca.
class AcercaView extends Ui.View {

    static const VERSION = "1.9.0";
    // La URL va partida en dos lineas: entera no cabe en la parte baja de
    // la esfera redonda (probado en el fenix 8 con la del sitio, que se
    // cortaba por los lados; esta es mas larga aun).
    static const WEB1 = "buymeacoffee.com";
    static const WEB2 = "/carroyo";

    var _qr;
    var _cafe;

    function initialize() {
        View.initialize();
    }

    function onLayout(dc) {
        _qr = Ui.loadResource(Rez.Drawables.QrWeb);
        _cafe = Ui.loadResource(Rez.Strings.aboutCoffee);
    }

    function onHide() {
        // Unos 6 KB de mapa de bits que no hace falta retener.
        _qr = null;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Tema.fondo(), Tema.fondo());
        dc.clear();

        // El nombre y la version en una linea, para dejarle la segunda a la
        // invitacion. En XTINY: en SMALL no cabia en la esfera de 218 px.
        _txt(dc, cx, h * 12 / 100, Gfx.FONT_XTINY, Tema.tinta(),
             "Backyard v" + VERSION);
        _txt(dc, cx, h * 21 / 100, Gfx.FONT_XTINY, Tema.tenue(), _cafe);

        // El QR centrado, a su tamano si cabe; en relojes chicos se encoge
        // a poco mas de media esfera, que un telefono lee igual.
        var y = h * 28 / 100;
        if (_qr != null) {
            var lado = _qr.getWidth();
            var maximo = (w < h ? w : h) * 55 / 100;
            if (lado > maximo && (dc has :drawScaledBitmap)) {
                dc.drawScaledBitmap(cx - (maximo / 2), y, maximo, maximo, _qr);
                y += maximo;
            } else {
                dc.drawBitmap(cx - (lado / 2), y, _qr);
                y += lado;
            }
        }
        // La fuente de glances es la mas chica del reloj; donde no exista,
        // la minima estandar. El QR es el que resuelve: esto es apenas la
        // referencia legible.
        var fuente = (Gfx has :FONT_GLANCE) ? Gfx.FONT_GLANCE : Gfx.FONT_XTINY;
        _txt(dc, cx, y + (h * 4 / 100), fuente, Tema.tenue(), WEB1);
        _txt(dc, cx, y + (h * 10 / 100), fuente, Tema.tenue(), WEB2);
    }

    function _txt(dc, x, y, fuente, color, texto) {
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(x, y, fuente, texto,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }
}

class AcercaDelegate extends Ui.BehaviorDelegate {

    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onBack() {
        Ui.popView(Ui.SLIDE_DOWN);
        return true;
    }
}
