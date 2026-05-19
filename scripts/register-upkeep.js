// scripts/register-upkeep.js
const { ethers, network } = require("hardhat");

const NETWORK_CONFIG = {
  sepolia: {
    linkToken:   "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    registrar:   "0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976",
    dashboard:   "https://automation.chain.link/sepolia",
    incContract: "0x3aF7127ca9Fa313D4AB7FAcdf7062F0FA5574993",
  },
  ethereum: {
    linkToken:   "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    registrar:   "0x6B0B234fB2f380309D47A7E9391E29E9a179395a",
    dashboard:   "https://automation.chain.link/mainnet",
    incContract: "0xAD4Fbde4810f3919F169c827A582aed34330ADA0",
  },
  polygon: {
    linkToken:   "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
    registrar:   "0x9a811502d843E5a03913d5A2cfb646c11463467A",
    dashboard:   "https://automation.chain.link/polygon",
    incContract: "0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC",
  },
  arbitrum: {
    linkToken:   "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    registrar:   "0x37D9dC70bfcd8BC77Ec2858836B923c560E891D1",
    dashboard:   "https://automation.chain.link/arbitrum",
    incContract: "0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC",
  },
  avalanche: {
    linkToken:   "0x5947BB275c521040051D82396192181b413227A3",
    registrar:   "0x9778f3ea234B2D3B1E5F66beB99B4AaDE00D3d48",
    dashboard:   "https://automation.chain.link/avalanche",
    incContract: "0x83F723a613a47cE2F0FB805bCA71C4AAA2F8d9EC",
  },
  bnb: {
    linkToken:   "0x404460C6A5EdE2D891e8297795264fDe62ADBB75",
    registrar:   "0x965FE0e4D0D8CD7e5A0B57E98AFB07F5ef7E29D0",
    dashboard:   "https://automation.chain.link/bsc",
    incContract: process.env.INC_CONTRACT_BNB || "",
  },
  optimism: {
    linkToken:   "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
    registrar:   "0x69A65fB638B9Ed35e2D5e53CeF8CA85B9F5B5898",
    dashboard:   "https://automation.chain.link/optimism",
    incContract: process.env.INC_CONTRACT_OPTIMISM || "",
  },
};

const LINK_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const REGISTRAR_ABI = [
  {
    name: "registerUpkeep",
    type: "function",
    inputs: [{
      name: "requestParams",
      type: "tuple",
      components: [
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
      ],
    }],
    outputs: [{ name: "id", type: "uint256" }],
  },
];

async function main() {
  const net = network.name;
  const config = NETWORK_CONFIG[net];

  if (!config) throw new Error(`Rede "${net}" não configurada em NETWORK_CONFIG.`);
  if (!config.incContract) throw new Error(`INC_CONTRACT_POLYGON não definido no .env`);

  const LINK_AMOUNT = ethers.parseEther("5");
  const [deployer] = await ethers.getSigners();

  console.log(`Registrando Upkeep em ${net} com: ${deployer.address}`);
  console.log(`Contrato INC: ${config.incContract}`);

  const link      = new ethers.Contract(config.linkToken, LINK_ABI, deployer);
  const registrar = new ethers.Contract(config.registrar, REGISTRAR_ABI, deployer);

  const balance = await link.balanceOf(deployer.address);
  console.log("Saldo LINK:", ethers.formatEther(balance));

  if (balance < LINK_AMOUNT) throw new Error(`LINK insuficiente — precisa de 5, tem ${ethers.formatEther(balance)}`);

  const checkData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256"], [0, 20]
  );

  console.log("\n1. Aprovando LINK para o Registrar...");
  const approveTx = await link.approve(config.registrar, LINK_AMOUNT);
  await approveTx.wait();
  console.log("   ✔ Aprovado");

  console.log("2. Registrando Upkeep...");
  const tx = await registrar.registerUpkeep({
    name:           "INC Network",
    encryptedEmail: "0x",
    upkeepContract: config.incContract,
    gasLimit:       500000,
    adminAddress:   deployer.address,
    triggerType:    0,
    checkData:      checkData,
    triggerConfig:  "0x",
    offchainConfig: "0x",
    amount:         LINK_AMOUNT,
  });

  const receipt = await tx.wait();
  console.log("   ✔ Tx:", receipt.hash);

  const iface = new ethers.Interface([
    "event RegistrationRequested(bytes32 indexed hash, string name, bytes encryptedEmail, address indexed upkeepContract, uint32 gasLimit, address adminAddress, uint8 triggerType, bytes triggerConfig, address indexed sender, bytes checkData, uint96 amount)",
    "event RegistrationApproved(bytes32 indexed hash, string displayName, uint256 indexed upkeepId)",
  ]);

  let upkeepId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "RegistrationApproved") {
        upkeepId = parsed.args.upkeepId.toString();
      }
    } catch (_) {}
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Upkeep registrado com sucesso!             ║");
  console.log("╚══════════════════════════════════════════════╝");
  if (upkeepId) console.log("Upkeep ID:", upkeepId);
  console.log("Dashboard:", config.dashboard);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
