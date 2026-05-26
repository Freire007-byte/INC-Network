# INC Network Node — Windows PowerShell
# Requer: geth instalado (https://geth.ethereum.org/downloads)
#
# Uso:
#   .\incchain\start.ps1          — inicializa + sobe o nó
#   .\incchain\start.ps1 -reset   — apaga dados e reinicia do zero

param([switch]$reset)

$DATA   = "$PSScriptRoot\data"
$CHAIN  = "$PSScriptRoot\genesis.json"
$SIGNER = "0x391dd5b84ef7B5FCf845C3dD1D5d388945d5F679"

if ($reset -and (Test-Path $DATA)) {
    Write-Host "Apagando dados anteriores..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $DATA
}

if (-not (Test-Path "$DATA\geth")) {
    Write-Host "Inicializando genesis..." -ForegroundColor Cyan
    geth --datadir $DATA init $CHAIN
    Write-Host "Genesis inicializado." -ForegroundColor Green
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║       INC NETWORK — Chain ID 19191       ║" -ForegroundColor Magenta
Write-Host "║   RPC  : http://localhost:8545            ║" -ForegroundColor Magenta
Write-Host "║   WS   : ws://localhost:8546              ║" -ForegroundColor Magenta
Write-Host "║   Signer: $SIGNER  ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

geth `
  --datadir $DATA `
  --networkid 19191 `
  --http `
  --http.addr "0.0.0.0" `
  --http.port 8545 `
  --http.corsdomain "*" `
  --http.api "eth,net,web3,personal,miner,clique,txpool,debug" `
  --ws `
  --ws.addr "0.0.0.0" `
  --ws.port 8546 `
  --ws.origins "*" `
  --ws.api "eth,net,web3" `
  --mine `
  --miner.etherbase $SIGNER `
  --unlock $SIGNER `
  --password "$PSScriptRoot\password.txt" `
  --allow-insecure-unlock `
  --syncmode "full" `
  --gcmode "archive" `
  --nodiscover `
  --maxpeers 0 `
  2>&1 | Tee-Object -FilePath "$PSScriptRoot\node.log"
