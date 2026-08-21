using Toybox.Application as App;
using Toybox.WatchUi as Ui;
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
    function terminar(guardar) {
        if (_session == null) { return; }
        _session.stop();
        if (guardar) {
            _session.save();
        } else {
            _session.discard();
        }
        _session = null;
        Sys.exit();
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
