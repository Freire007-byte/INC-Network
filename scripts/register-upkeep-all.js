// scripts/register-upkeep-all.js
// Registra Chainlink Automation em Polygon, Arbitrum e Avalanche
// Requer: 5 LINK por rede na carteira owner
// Uso: node scripts/register-upkeep-all.js

const { ethers } = require("ethers");
require("dotenv").config();

const LINK_AMOUNT = ethers.parseEther("5");

const NETWORKS = [
  {
    name:      "Polygon",
    rpc:       "https://polygon-bor-rpc.publicnode.com",
    linkToken: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
    registrar: "0x9a811502d843E5a03913d5A2cfb646c11463467A",
    contract:  process.env.INC_CONTRACT_POLYGON  || "0xf49841DF7726691D04D311BC4A0821C0AB9211f5",
    dashboard: "https://automation.chain.link/polygon",
    howToGetLink: "Uniswap Polygon → trocar MATIC por LINK",
  },
  {
    name:      "Arbitrum",
    rpc:       "https://arb1.arbitrum.io/rpc",
    linkToken: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    registrar: "0x37D9dC70bfcd8BC77Ec2858836B923c560E891D1",
    contract:  process.env.INC_CONTRACT_ARBITRUM || "0x1de206f37320BB1C56DfdfC7cAbF72a24fa0e745",
    dashboard: "https://automation.chain.link/arbitrum",
    howToGetLink: "Uniswap Arbitrum → trocar ETH por LINK",
  },
  {
    name:      "Avalanche",
    rpc:       "https://api.avax.network/ext/bc/C/rpc",
    linkToken: "0x5947BB275c521040051D82396192181b413227A3",
    registrar: "0x9778f3ea234B2D3B1E5F66beB99B4AaDE00D3d48",
    contract:  process.env.INC_CONTRACT_AVALANCHE || "0x55413bF29C5b2c7EE54333fD09382f13Ca081593",
    dashboard: "https://automation.chain.link/avalanche",
    howToGetLink: "Trader Joe → trocar AVAX por LINK",
  },
];

const LINK_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const REGISTRAR_ABI = [{
  name: "registerUpkeep", type: "function",
  inputs: [{ name: "requestParams", type: "tuple", components: [
    { name: "name",           type: "string"  },
    { name: "encryptedEmail", type: "bytes"   },
    { name: "upkeepContract", type: "address" },
    { name: "gasLimit",       type: "uint32"  },
    { name: "adminAddress",   type: "address" },
    { name: "triggerType",    type: "uint8"   },
    { name: "checkData",      type: "bytes"   },
    { name: "triggerConfig",  type: "bytes"   },
    { name: "offchainConfig", type: "bytes"   },
    { name: "amount",         type: "uint96"  },
  ]}],
  outputs: [{ name: "id", type: "uint256" }],
}];

async function registerNet(net, wallet) {
  console.log(`\n━━━ ${net.name} ━━━`);
  const prov = new ethers.JsonRpcProvider(net.rpc);
  const signer = wallet.connect(prov);

  const link = new ethers.Contract(net.linkToken, LINK_ABI, signer);
  const bal  = await link.balanceOf(signer.address);
  console.log(`  LINK disponível: ${ethers.formatEther(bal)}`);

  if (bal < LINK_AMOUNT) {
    console.log(`  ⚠ LINK insuficiente (precisa 5). Como obter: ${net.howToGetLink}`);
    console.log(`  Pule para: ${net.dashboard}`);
    return null;
  }

  console.log(`  1. Aprovando LINK...`);
  const appTx = await link.approve(net.registrar, LINK_AMOUNT);
  await appTx.wait();
  console.log(`  ✔ Aprovado`);

  const registrar = new ethers.Contract(net.registrar, REGISTRAR_ABI, signer);
  const checkData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"], [0, 20]);

  console.log(`  2. Registrando Upkeep...`);
  const tx = await registrar.registerUpkeep({
    name:           "INC Network",
    encryptedEmail: "0x",
    upkeepContract: net.contract,
    gasLimit:       500000,
    adminAddress:   signer.address,
    triggerType:    0,
    checkData,
    triggerConfig:  "0x",
    offchainConfig: "0x",
    amount:         LINK_AMOUNT,
  });
  const receipt = await tx.wait();
  console.log(`  ✔ Tx: ${receipt.hash}`);

  const iface = new ethers.Interface([
    "event RegistrationApproved(bytes32 indexed hash, string displayName, uint256 indexed upkeepId)",
  ]);
  let upkeepId = null;
  for (const log of receipt.logs) {
    try { const p = iface.parseLog(log); if (p?.name === "RegistrationApproved") upkeepId = p.args.upkeepId.toString(); } catch {}
  }

  console.log(`  ✅ Upkeep ID: ${upkeepId || "(aprovar manualmente em " + net.dashboard + ")"}`);
  console.log(`  Dashboard: ${net.dashboard}`);
  return upkeepId;
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY não definida no .env");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log("Owner:", wallet.address);

  for (const net of NETWORKS) {
    try { await registerNet(net, wallet); }
    catch(e) { console.log(`  ❌ ERRO em ${net.name}: ${e.shortMessage || e.message}`); }
  }
  console.log("\n✔ Concluído.");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
