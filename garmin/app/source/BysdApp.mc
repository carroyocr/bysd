using Toybox.Application as App;
using Toybox.WatchUi as Ui;
using Toybox.Timer as Timer;
using Toybox.Time as Time;
using Toybox.Attention as Attention;

// BYSD Live.
//
// La app late una vez por segundo. En cada latido hace tres cosas pequenas:
// mira si la vuelta cambio, decide si toca preguntarle al servidor y comprueba
// si hay que avisar del corral. Dibujar es cosa de las vistas.
class BysdApp extends App.AppBase {

    var estado;
    var api;

    var _timer;
    var _ultimoRefresco = 0;
    var _vueltaVista = 0;

    // Indice del ultimo aviso de corral que ya sono, y en que vuelta sono.
    var _avisoDado = -1;
    var _vueltaDelAviso = 0;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        estado = new RaceState();
        api = new ApiClient(estado);
        _refrescar();
        _timer = new Timer.Timer();
        _timer.start(method(:tic), 1000, true);
    }

    function onStop(state) {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    // Cuando el corredor cambia el dorsal o la carrera desde el telefono.
    function onSettingsChanged() {
        estado.leerAjustes();
        _refrescar();
    }

    function getInitialView() {
        return [ new SplashView(estado), new SplashDelegate(estado) ];
    }

    // 'as Void' no es adorno: Timer.start exige un metodo que no devuelva
    // nada, y sin la anotacion el comprobador de tipos lo da por 'Any'.
    function tic() as Void {
        estado.refrescarFoto();
        _quizaRefrescar();
        _quizaAvisar();
        Ui.requestUpdate();
    }

    function _refrescar() {
        _ultimoRefresco = Time.now().value();
        api.refrescar();
    }

    function _quizaRefrescar() {
        var vuelta = estado.vuelta();

        // Al cerrarse una vuelta cambia todo lo que no puede saber el reloj:
        // quien se retiro y si la carrera termino. Merece una pregunta extra.
        if (vuelta != null && vuelta != _vueltaVista) {
            _vueltaVista = vuelta;
            _refrescar();
            return;
        }

        if (Time.now().value() - _ultimoRefresco >= estado.segundosRefresco) {
            _refrescar();
        }
    }

    function _quizaAvisar() {
        if (!estado.avisoCorral) { return; }

        var restante = estado.restante();
        var vuelta = estado.vuelta();
        if (restante == null || vuelta == null || !estado.empezada || estado.terminada) {
            return;
        }

        // Cada vuelta trae sus tres avisos nuevos.
        if (vuelta != _vueltaDelAviso) {
            _vueltaDelAviso = vuelta;
            _avisoDado = -1;
        }

        // Se busca el aviso mas profundo ya cruzado y se dispara una sola vez.
        // Si la app estaba cerrada y se abre a falta de un minuto, vibra una
        // vez, no tres seguidas.
        var objetivo = -1;
        for (var i = 0; i < RaceState.AVISOS_CORRAL.size(); i++) {
            if (restante <= RaceState.AVISOS_CORRAL[i]) {
                objetivo = i;
            }
        }
        if (objetivo > _avisoDado) {
            _avisoDado = objetivo;
            _vibrar();
        }
    }

    function _vibrar() {
        if (Attention has :vibrate) {
            Attention.vibrate([ new Attention.VibeProfile(75, 500) ]);
        }
    }
}
