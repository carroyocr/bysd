using Toybox.Time as Time;
using Toybox.Attention as Attention;

// El latido de la app: lo que hay que hacer una vez por segundo.
//
// Vive aparte porque los dos productos lo necesitan igual. La app de reloj lo
// llama desde su temporizador y el campo de datos desde compute(), que el
// sistema ya invoca cada segundo. Ninguno de los dos deberia repetir esta
// logica: el corral que vibra dos veces, o que no vibra, es el mismo fallo
// escrito en dos sitios.
class Latido {

    var estado;
    var api;

    var _ultimoRefresco = 0;
    var _vueltaVista = 0;

    // Indice del ultimo aviso de corral que ya sono, y en que vuelta sono.
    var _avisoDado = -1;
    var _vueltaDelAviso = 0;

    function initialize(unEstado, unApi) {
        estado = unEstado;
        api = unApi;
        refrescar();
    }

    function tic() {
        estado.refrescarFoto();
        _quizaRefrescar();
        _quizaAvisar();
    }

    function refrescar() {
        _ultimoRefresco = Time.now().value();
        api.refrescar();
    }

    function _quizaRefrescar() {
        var vuelta = estado.vuelta();

        // Al cerrarse una vuelta cambia todo lo que el reloj no puede saber:
        // quien se retiro y si la carrera termino. Merece una pregunta extra.
        if (vuelta != null && vuelta != _vueltaVista) {
            _vueltaVista = vuelta;
            refrescar();
            return;
        }

        if (Time.now().value() - _ultimoRefresco >= estado.segundosRefresco) {
            refrescar();
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
        // Si la app se abre a falta de un minuto, vibra una vez y no tres
        // seguidas.
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
