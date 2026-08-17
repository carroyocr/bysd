using Toybox.Application as App;
using Toybox.WatchUi as Ui;
using Toybox.Timer as Timer;
using Toybox.Attention as Attention;

// Backyard.
//
// La app late una vez por segundo. En cada latido hace dos cosas pequenas: mira
// si la vuelta cambio y comprueba si hay que avisar del corral. Dibujar es cosa
// de las vistas, y hablar con nadie no hace falta: todo sale del reloj de la
// actividad y de los ajustes.
class BackyardApp extends App.AppBase {

    var estado;

    var _timer;

    // Indice del ultimo aviso de corral que ya sono, y en que vuelta sono.
    var _avisoDado = -1;
    var _vueltaDelAviso = 0;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        estado = new RaceState();
        _timer = new Timer.Timer();
        _timer.start(method(:tic), 1000, true);
    }

    function onStop(state) {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
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

    // 'as Void' no es adorno: Timer.start exige un metodo que no devuelva
    // nada, y sin la anotacion el comprobador de tipos lo da por 'Any'.
    function tic() as Void {
        estado.refrescarFoto();
        _quizaAvisar();
        Ui.requestUpdate();
    }

    function _quizaAvisar() {
        if (!estado.avisoCorral) { return; }

        var restante = estado.restante();
        var vuelta = estado.vuelta();
        if (restante == null || vuelta == null) { return; }

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
