using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.System as Sys;
using Toybox.Math as Math;

// Acerca de: el nombre, la version y un QR que lleva al manual del corredor
// en el sitio del evento (/garmin). Hasta la 1.8.0 llevaba a la raiz del
// sitio; quien escanea desde el reloj busca ayuda de la app. Aqui no hay
// enlace de donacion a proposito: la tienda de Garmin obliga a marcar como
// «de pago» cualquier app que pida propinas, aunque sea gratis (7-oct-2026);
// la invitacion al cafe vive en el manual, fuera de Garmin.
//
// La version se escribe aqui y se actualiza con cada envio a la tienda:
// Connect IQ no deja leerla del manifiesto en tiempo de ejecucion. El QR va
// como bitmap en los recursos (lo genera segno, con su zona quieta blanca)
// porque dibujar un QR modulo a modulo en la esfera seria memoria y codigo
// para algo que no cambia nunca. Hay uno por familia de pantalla, ya a la
// medida de su esfera (monkey.jungle): con uno solo de 222 px el Forerunner
// 255 lo cortaba por abajo, porque el escalado en el reloj no actuo.
class AcercaView extends Ui.View {

    static const VERSION = "1.10.0";
    // La URL va debajo del QR, en la fuente mas chica: entera si cabe en
    // la cuerda de la esfera a esa altura, en dos lineas si no, y nada si
    // tampoco. El QR es el que resuelve; esto es la referencia legible.
    static const WEB1 = "backyardultra";
    static const WEB2 = "santodomingo.com/garmin";

    var _qr;
    var _manual;

    function initialize() {
        View.initialize();
    }

    function onLayout(dc) {
        _qr = Ui.loadResource(Rez.Drawables.QrWeb);
        _manual = Ui.loadResource(Rez.Strings.aboutManual);
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

        // El nombre y la version en una linea, para que la segunda diga que
        // es el QR: el manual de usuario. En XTINY, que en SMALL no cabia en
        // la esfera de 218 px.
        _txt(dc, cx, h * 10 / 100, Gfx.FONT_XTINY, Tema.tenue(),
             "Backyard v" + VERSION);
        _txt(dc, cx, h * 19 / 100, Gfx.FONT_XTINY, Tema.tinta(), _manual);

        // El QR centrado, al tamano que trae su recurso, que ya es el de
        // esta familia de pantalla. El tope es una red por si un reloj nuevo
        // cae en una familia que le queda grande.
        var y = h * 25 / 100;
        if (_qr != null) {
            var lado = _qr.getWidth();
            var maximo = (w < h ? w : h) * 60 / 100;
            if (lado > maximo && (dc has :drawScaledBitmap)) {
                dc.drawScaledBitmap(cx - (maximo / 2), y, maximo, maximo, _qr);
                lado = maximo;
            } else {
                dc.drawBitmap(cx - (lado / 2), y, _qr);
            }
            y += lado;
        }

        // La fuente de glances es la mas chica del reloj; donde no exista,
        // la minima estandar.
        var fuente = (Gfx has :FONT_GLANCE) ? Gfx.FONT_GLANCE : Gfx.FONT_XTINY;
        var alto = dc.getFontHeight(fuente);
        var y1 = y + (alto * 70 / 100);
        if (dc.getTextWidthInPixels(WEB1 + WEB2, fuente) <= _cuerda(dc, y1, fuente)) {
            _txt(dc, cx, y1, fuente, Tema.tenue(), WEB1 + WEB2);
        } else {
            var y2 = y1 + alto;
            if (dc.getTextWidthInPixels(WEB1, fuente) <= _cuerda(dc, y1, fuente)
                && dc.getTextWidthInPixels(WEB2, fuente) <= _cuerda(dc, y2, fuente)) {
                _txt(dc, cx, y1, fuente, Tema.tenue(), WEB1);
                _txt(dc, cx, y2, fuente, Tema.tenue(), WEB2);
            }
        }
    }

    // El ancho util de una linea centrada en y: la cuerda de la esfera en el
    // borde del texto mas alejado del centro, con algo de aire. En pantallas
    // no redondas, el ancho entero. (Igual que en MainView.)
    function _cuerda(dc, y, fuente) {
        var w = dc.getWidth();
        if (Sys.getDeviceSettings().screenShape != Sys.SCREEN_SHAPE_ROUND) {
            return w;
        }
        var r = w / 2;
        var dy = (y - (dc.getHeight() / 2)).abs() + (dc.getFontHeight(fuente) / 2);
        if (dy >= r) { return 0; }
        return (2 * Math.sqrt((r * r) - (dy * dy))).toNumber() - (w * 6 / 100);
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
