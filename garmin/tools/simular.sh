#!/bin/bash
# Compila la app de reloj y la carga en el simulador de Connect IQ.
#
#   garmin/tools/simular.sh            # Forerunner 255
#   garmin/tools/simular.sh fenix847mm # otro reloj (id del manifest.xml)
#
# Abre el simulador si no esta abierto y lo reinicia con --reiniciar.
# Dentro del simulador: START da la salida; Simulation -> Activity Data
# pone distancia y ritmo simulados; UP/DOWN cambian de pagina.

set -e
RELOJ="${1:-fr255}"
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
SDK="$(ls -d "$HOME/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-"*/bin | tail -1)"
LLAVE="$HOME/Proyectos/bysd-secretos/garmin/developer_key.der"
SALIDA="$AQUI/build/sim-$RELOJ.prg"

if [ "$2" = "--reiniciar" ] || [ "$1" = "--reiniciar" ]; then
    [ "$1" = "--reiniciar" ] && RELOJ="fr255" && SALIDA="$AQUI/build/sim-$RELOJ.prg"
    pkill -x simulator 2>/dev/null || true
    sleep 2
fi

mkdir -p "$AQUI/build"
echo "Compilando para $RELOJ..."
(cd "$AQUI/app" && "$SDK/monkeyc" -f monkey.jungle -o "$SALIDA" -y "$LLAVE" -d "$RELOJ" -w)

if ! pgrep -x simulator >/dev/null; then
    echo "Abriendo el simulador..."
    "$SDK/connectiq"
    for i in $(seq 1 30); do
        lsof -nP -iTCP:1234 -sTCP:LISTEN >/dev/null 2>&1 && break
        sleep 1
    done
fi

echo "Cargando la app en el simulador ($RELOJ)..."
"$SDK/monkeydo" "$SALIDA" "$RELOJ"
