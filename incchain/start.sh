#!/bin/bash
# INC Network Node — Linux/Mac
# Requer: geth instalado (https://geth.ethereum.org/downloads)

DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/data"
CHAIN="$DIR/genesis.json"
SIGNER="0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"

if [[ "$1" == "--reset" && -d "$DATA" ]]; then
  echo "Apagando dados anteriores..."
  rm -rf "$DATA"
fi

if [ ! -d "$DATA/geth" ]; then
  echo "Inicializando genesis..."
  geth --datadir "$DATA" init "$CHAIN"
  echo "Genesis inicializado."
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       INC NETWORK — Chain ID 19191       ║"
echo "║   RPC  : http://localhost:8545            ║"
echo "║   WS   : ws://localhost:8546              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

geth \
  --datadir "$DATA" \
  --networkid 19191 \
  --http \
  --http.addr "0.0.0.0" \
  --http.port 8545 \
  --http.corsdomain "*" \
  --http.api "eth,net,web3,personal,miner,clique,txpool,debug" \
  --ws \
  --ws.addr "0.0.0.0" \
  --ws.port 8546 \
  --ws.origins "*" \
  --ws.api "eth,net,web3" \
  --mine \
  --miner.etherbase "$SIGNER" \
  --unlock "$SIGNER" \
  --password "$DIR/password.txt" \
  --allow-insecure-unlock \
  --syncmode "full" \
  --gcmode "archive" \
  --nodiscover \
  --maxpeers 0 \
  2>&1 | tee "$DIR/node.log"
