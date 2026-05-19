// scripts/airdrop.js — Distribui $INC para múltiplas carteiras
// Uso: node scripts/airdrop.js --network arbitrum --amount 100 --file airdrop-list.txt
// Formato airdrop-list.txt: um endereço por linha
const { ethers } = require("ethers");
const fs   = require("fs");
const path = require("path");
require("dotenv").config();

const NETWORKS = {
  arbitrum: {
    rpc:   "https://arb1.arbitrum.io/rpc",
    token: "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7",
    name:  "Arbitrum",
  },
  polygon: {
    rpc:   process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
    token: "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7",
    name:  "Polygon",
  },
  avalanche: {
    rpc:   "https://api.avax.network/ext/bc/C/rpc",
    token: "0x9A48dCDF8FC1e9047F1834D70e328C30B1B1863B",
    name:  "Avalanche",
  },
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };
  return {
    network: get("--network") || "arbitrum",
    amount:  get("--amount")  || "100",
    file:    get("--file")    || "airdrop-list.txt",
  };
}

async function main() {
  const { network, amount, file } = parseArgs();
  const cfg = NETWORKS[network];
  if (!cfg) throw new Error(`Rede inválida: ${network}. Use: ${Object.keys(NETWORKS).join(", ")}`);

  const listPath = path.resolve(file);
  if (!fs.existsSync(listPath)) throw new Error(`Arquivo não encontrado: ${listPath}`);

  const rawAddresses = fs.readFileSync(listPath, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  if (rawAddresses.length === 0) throw new Error("Nenhum endereço na lista.");

  // Normaliza checksums
  const addresses = rawAddresses.map((a, i) => {
    try { return ethers.getAddress(a.toLowerCase()); }
    catch { throw new Error(`Linha ${i+1}: endereço inválido — "${a}"`); }
  });

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const token    = new ethers.Contract(cfg.token, ERC20_ABI, wallet);

  const [symbol, decimals, balance] = await Promise.all([
    token.symbol(), token.decimals(), token.balanceOf(wallet.address),
  ]);

  const amountEach = ethers.parseUnits(amount, decimals);
  const total      = amountEach * BigInt(addresses.length);

  console.log("═".repeat(56));
  console.log(`  INC Airdrop — ${cfg.name}`);
  console.log("═".repeat(56));
  console.log(`  Token     : ${cfg.token} (${symbol})`);
  console.log(`  Remetente : ${wallet.address}`);
  console.log(`  Saldo     : ${ethers.formatUnits(balance, decimals)} ${symbol}`);
  console.log(`  Por wallet: ${amount} ${symbol}`);
  console.log(`  Wallets   : ${addresses.length}`);
  console.log(`  Total     : ${ethers.formatUnits(total, decimals)} ${symbol}`);
  console.log("═".repeat(56));

  if (balance < total) throw new Error(`Saldo insuficiente. Precisa ${ethers.formatUnits(total, decimals)}, tem ${ethers.formatUnits(balance, decimals)}`);

  let ok = 0, fail = 0;

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    process.stdout.write(`  [${i+1}/${addresses.length}] ${addr} ... `);
    try {
      const tx      = await token.transfer(addr, amountEach);
      const receipt = await tx.wait();
      console.log(`✔ TX: ${receipt.hash.slice(0,12)}…`);
      ok++;
    } catch (e) {
      console.log(`✗ ERRO: ${e.message.slice(0,60)}`);
      fail++;
    }
  }

  console.log("═".repeat(56));
  console.log(`  ✔ Sucesso: ${ok}   ✗ Falhas: ${fail}`);
  console.log(`  Total enviado: ${ethers.formatUnits(amountEach * BigInt(ok), decimals)} ${symbol}`);
  console.log("═".repeat(56));
}

main().catch(e => { console.error(e.message); process.exit(1); });
