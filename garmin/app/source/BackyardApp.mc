using Toybox.Application as App;
using Toybox.WatchUi as Ui;
using Toybox.Graphics as Gfx;
using Toybox.Timer as Timer;
using Toybox.Attention as Attention;
using Toybox.ActivityRecording as Rec;
using Toybox.Activity as Activity;
using Toybox.Position as Position;
using Toybox.System as Sys;

// Backyard.
//
// La app no mira una actividad ajena: la graba ella. Pulsar START arranca la
// grabacion y ancla las campanas a la hora en punto; desde ahi las vueltas
// las abre el reloj de pared, LAP solo marca que la vuelta termino, y al
// final la actividad se guarda como cualquier carrera, con su subida a
// Garmin Connect. La app late una vez por segundo; dibujar es cosa de las
// vistas.
class BackyardApp extends App.AppBase {

    var estado;

    var _session = null;
    var _timer;

    // Si el cierre en curso es guardar o descartar, para el switch diferido a
    // la pantalla de cierre.
    var _guardado = false;

    // La ultima vuelta vista, para detectar la campana. Cero significa que la
    // carrera no ha empezado.
    var _vueltaVista = 0;

    // Indice del ultimo aviso de corral que ya sono, y en que vuelta sono.
    var _avisoDado = -1;
    var _vueltaDelAviso = 0;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        estado = new RaceState();
        // El GPS se enciende desde ya: lo que tarde en fijar que lo tarde en
        // la carpa, no en la linea de salida.
        Position.enableLocationEvents(Position.LOCATION_CONTINUOUS, method(:onPosition));
        _timer = new Timer.Timer();
        _timer.start(method(:tic), 1000, true);
    }

    function onStop(state) {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        Position.enableLocationEvents(Position.LOCATION_DISABLE, method(:onPosition));
    }

    // La sesion consume la posicion al grabar; aqui solo se le pasa al estado,
    // que la necesita para la vuelta automatica en el punto de salida.
    function onPosition(info as Position.Info) as Void {
        if (estado != null) {
            estado.verPosicion(info);
        }
    }

    // Cuando el corredor cambia la vuelta o el aviso desde el telefono.
    function onSettingsChanged() {
        estado.leerAjustes();
        Ui.requestUpdate();
    }

    function getInitialView() {
        return [ new SplashView(estado), new SplashDelegate(estado) ];
    }

    function grabando() {
        return _session != null;
    }

    // La salida: crea la sesion, arranca a grabar y ancla las campanas a la
    // marca de hora mas cercana. Si el corredor pulso antes de la hora, la
    // vuelta 0 es la cuenta atras y la campana de verdad sonara sola.
    function darLaSalida() {
        if (_session != null) { return; }
        _session = Rec.createSession({
            :name => "Backyard",
            :sport => Activity.SPORT_RUNNING
        });
        _session.start();
        estado.darLaSalida();
        var v = estado.vuelta();
        _vueltaVista = v == null ? 0 : v;
        _vibrar(1500);
    }

    // El LAP del corredor: la vuelta termino, empieza el descanso. Solo vale
    // el primero de cada vuelta; los demas se ignoran sin ruido. La vuelta
    // siguiente no la abre nadie con un boton: la abre la hora.
    function marcarVuelta() {
        if (_session == null) { return; }
        if (!estado.marcarVuelta()) { return; }
        _session.addLap();
        _vibrar(500);
    }

    // Fin de carrera. Guardar cierra el FIT y lo deja listo para subir;
    // descartar lo tira. En los dos casos la app se cierra: una backyard no
    // tiene segunda salida.
    //
    // Antes de salir se deja una pantalla negra. Sin ella, la animacion de
    // salida del reloj encoge el ultimo frame de la carrera sobre la lista de
    // actividades, y si ese frame era el corral se veia un cuadro rojo. El
    // latido se para primero (no mas dibujos de la carrera) y un respiro de
    // timer le da a la pantalla negra tiempo de pintarse antes del Sys.exit.
    function terminar(guardar) {
        if (_session == null) { return; }
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
        _session.stop();
        if (guardar) {
            _session.save();
        } else {
            _session.discard();
        }
        _session = null;
        // La pantalla de cierre se muestra con un pequeno retraso, no aqui
        // mismo. Descartar llega desde el dialogo de confirmacion, y el
        // sistema cierra ese dialogo -con su popView- JUSTO DESPUES de que
        // respondemos: si cambiaramos de vista ahora, ese popView se llevaria
        // por delante la pantalla de cierre y volveria al menu (el corredor
        // veia "Descartar" otra vez). El timer deja que el dialogo y el menu
        // se cierren primero, y entonces cambia a la pantalla de cierre.
        _guardado = guardar;
        var t = new Timer.Timer();
        t.start(method(:mostrarCierre), 100, false);
    }

    // 'as Void' por lo mismo que en tic(): Timer.start exige que el metodo no
    // devuelva nada.
    function mostrarCierre() as Void {
        Ui.switchToView(new SalidaView(_guardado), new Ui.BehaviorDelegate(),
                        Ui.SLIDE_IMMEDIATE);
    }

    // 'as Void' no es adorno: Timer.start exige un metodo que no devuelva
    // nada, y sin la anotacion el comprobador de tipos lo da por 'Any'.
    function tic() as Void {
        estado.refrescarFoto();
        _quizaCampana();
        // La vuelta automatica: llegar al punto de salida marca igual que LAP.
        if (estado.tocaMarcarSola()) {
            marcarVuelta();
        }
        _quizaAvisar();
        Ui.requestUpdate();
    }

    // La campana: suena siempre que el reloj de pared abre vuelta, incluida la
    // de salida si el corredor pulso START antes de la hora. En el FIT cierra
    // el tramo anterior y abre uno nuevo, sin excepciones. La primera campana
    // cierra el CALENTAMIENTO -lo que se corrio o se espero antes de la hora-,
    // que asi queda en su propio tramo y no se suma a la vuelta 1. Antes se
    // saltaba ese primer cierre y el calentamiento se pegaba a la vuelta.
    function _quizaCampana() {
        if (_session == null) { return; }
        var v = estado.vuelta();
        if (v == null || v <= _vueltaVista) { return; }
        _vueltaVista = v;
        _session.addLap();
        _vibrar(1500);
    }

    function _quizaAvisar() {
        if (!estado.avisoCorral || _session == null) { return; }

        var restante = estado.restante();
        var vuelta = estado.vuelta();
        if (restante == null || vuelta == null) { return; }

        // Cada vuelta trae sus tres avisos nuevos.
        if (vuelta != _vueltaDelAviso) {
            _vueltaDelAviso = vuelta;
            _avisoDado = -1;
        }

        // Se busca el aviso mas profundo ya cruzado y se dispara una sola vez.
        // Si el corredor mira el reloj a falta de un minuto, vibra una vez,
        // no tres seguidas.
        var objetivo = -1;
        for (var i = 0; i < RaceState.AVISOS_CORRAL.size(); i++) {
            if (restante <= RaceState.AVISOS_CORRAL[i]) {
                objetivo = i;
            }
        }
        if (objetivo > _avisoDado) {
            _avisoDado = objetivo;
            _vibrar(500);
        }
    }

    function _vibrar(milis) {
        if (Attention has :vibrate) {
            Attention.vibrate([ new Attention.VibeProfile(75, milis) ]);
        }
    }
}

// La pantalla de cierre, calcada de la actividad nativa de Garmin. Dos fases:
// mientras procesa, un aro se llena -rojo si se descarta, verde si se guarda-
// con la palabra en el centro ("Descartando"/"Guardando"); al llenarse, el
// aro queda verde entero y el centro dice "Actividad descartada/guardada" un
// momento antes de cerrar la app ella misma. Asi la salida se ve como la del
// reloj y no como el cuadro rojo que encogia la animacion de salida.
class SalidaView extends Ui.View {

    // Milisegundos por tic y cuanto sube el aro en cada uno: se llena en algo
    // menos de un segundo. Luego el mensaje de "hecho" se queda unos tics.
    static const TIC_MS = 40;
    static const PASO = 0.06;
    static const TICS_HECHO = 28;

    var _guardar;
    var _txtProc;
    var _txtHecho;
    var _fase = 0;      // 0 = procesando, 1 = hecho
    var _prog = 0.0;
    var _tics = 0;
    var _timer;

    function initialize(guardar) {
        View.initialize();
        _guardar = guardar;
    }

    function onLayout(dc) {
        _txtProc = Ui.loadResource(
            _guardar ? Rez.Strings.saving : Rez.Strings.discarding);
        _txtHecho = Ui.loadResource(
            _guardar ? Rez.Strings.saved : Rez.Strings.discarded);
    }

    function onShow() {
        _timer = new Timer.Timer();
        _timer.start(method(:tic), TIC_MS, true);
    }

    function onHide() {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    function tic() as Void {
        if (_fase == 0) {
            _prog += PASO;
            if (_prog >= 1.0) {
                _prog = 1.0;
                _fase = 1;
                _tics = 0;
            }
        } else {
            _tics++;
            if (_tics >= TICS_HECHO) {
                if (_timer != null) { _timer.stop(); _timer = null; }
                Sys.exit();
            }
        }
        Ui.requestUpdate();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var radio = ((w < h ? w : h) / 2) - 10;

        dc.setColor(Gfx.COLOR_BLACK, Gfx.COLOR_BLACK);
        dc.clear();
        dc.setPenWidth(14);

        if (_fase == 0) {
            // El aro se llena desde las doce y hacia la derecha, como se lee un
            // reloj. Rojo al descartar, verde al guardar.
            var color = _guardar ? Gfx.COLOR_GREEN : Gfx.COLOR_RED;
            var grados = (360 * _prog).toNumber();
            if (grados > 0) {
                if (grados > 359) { grados = 359; }
                var fin = 90 - grados;
                while (fin < 0) { fin += 360; }
                dc.setColor(color, Gfx.COLOR_TRANSPARENT);
                dc.drawArc(cx, cy, radio, Gfx.ARC_CLOCKWISE, 90, fin);
            }
            _texto(dc, cx, cy, h, _txtProc);
        } else {
            dc.setColor(Gfx.COLOR_GREEN, Gfx.COLOR_TRANSPARENT);
            dc.drawCircle(cx, cy, radio);
            _texto(dc, cx, cy, h, _txtHecho);
        }
    }

    // Una palabra va en el centro; dos palabras se parten en dos lineas, como
    // "Actividad / descartada" en la pantalla nativa.
    function _texto(dc, cx, cy, h, texto) {
        dc.setColor(Gfx.COLOR_WHITE, Gfx.COLOR_TRANSPARENT);
        var i = texto.find(" ");
        if (i != null) {
            var l1 = texto.substring(0, i);
            var l2 = texto.substring(i + 1, texto.length());
            dc.drawText(cx, cy - (h * 9 / 100), Gfx.FONT_SMALL, l1,
                        Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
            dc.drawText(cx, cy + (h * 9 / 100), Gfx.FONT_SMALL, l2,
                        Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
        } else {
            dc.drawText(cx, cy, Gfx.FONT_MEDIUM, texto,
                        Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
        }
    }
}
