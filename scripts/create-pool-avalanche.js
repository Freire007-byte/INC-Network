// scripts/create-pool-avalanche.js — Pool Uniswap V3 $INC/WAVAX na Avalanche
const { ethers } = require("ethers");
require("dotenv").config();

const WAVAX         = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const INC_TOKEN     = "0x9A48dCDF8FC1e9047F1834D70e328C30B1B1863B";
const FACTORY       = "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD";
const POS_MANAGER   = "0x655C406EBFa14EE2006250925e54ec43AD184f8B";
const FEE           = 10000; // 1%
const MIN_TICK      = -887200;
const MAX_TICK      =  887200;

// INC (0x9a48...) < WAVAX (0xb31f...) → token0=INC, token1=WAVAX
// Preço: 1 AVAX = 2500 INC  →  1 INC = $0.01 @ AVAX=$25
// price = WAVAX/INC = 1/2500 = 0.0004

const FACTORY_ABI = [
  "function createPool(address,address,uint24) returns (address)",
  "function getPool(address,address,uint24) view returns (address)",
];
const POOL_ABI = [
  "function initialize(uint160 sqrtPriceX96) external",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
];
const PM_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) external payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
];
const WAVAX_ABI = [
  "function deposit() external payable",
  "function approve(address,uint256) returns (bool)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
];

function sqrtBigInt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const avaxBal = await provider.getBalance(wallet.address);
  console.log("Carteira   :", wallet.address);
  console.log("AVAX saldo :", ethers.formatEther(avaxBal));

  const AVAX_LIQ = ethers.parseEther("0.15");
  const INC_LIQ  = ethers.parseEther("375");

  // token0=INC, token1=WAVAX → price = WAVAX/INC = 1/2500
  const Q96          = 2n ** 96n;
  const sqrtPriceX96 = sqrtBigInt(Q96 * Q96 / 2500n);

  const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, wallet);
  const wavax    = new ethers.Contract(WAVAX, WAVAX_ABI, wallet);
  const incToken = new ethers.Contract(INC_TOKEN, ERC20_ABI, wallet);
  const pm       = new ethers.Contract(POS_MANAGER, PM_ABI, wallet);

  // 1. Criar pool
  console.log("\n1. Verificando pool INC/WAVAX 1% na Avalanche...");
  let poolAddr = await factory.getPool(INC_TOKEN, WAVAX, FEE);

  if (poolAddr === ethers.ZeroAddress) {
    console.log("   Pool inexistente — criando...");
    const tx = await factory.createPool(INC_TOKEN, WAVAX, FEE);
    await tx.wait();
    poolAddr = await factory.getPool(INC_TOKEN, WAVAX, FEE);
    console.log("   ✔ Pool criado:", poolAddr);
  } else {
    console.log("   Pool existente:", poolAddr);
  }

  // 2. Inicializar preço
  const pool  = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  const slot0 = await pool.slot0();

  if (slot0[0] === 0n) {
    console.log("\n2. Inicializando preço: 1 INC = $0.01 (1 AVAX = 2500 INC)...");
    const tx = await pool.initialize(sqrtPriceX96);
    await tx.wait();
    console.log("   ✔ Preço configurado");
  } else {
    console.log("\n2. Pool já tem preço — mantendo preço existente");
  }

  // 3. Wrap AVAX → WAVAX
  console.log("\n3. Convertendo", ethers.formatEther(AVAX_LIQ), "AVAX → WAVAX...");
  await (await wavax.deposit({ value: AVAX_LIQ })).wait();
  console.log("   ✔ WAVAX ok");

  // 4. Aprovações
  console.log("\n4. Aprovando WAVAX e INC...");
  await (await wavax.approve(POS_MANAGER, AVAX_LIQ)).wait();
  console.log("   ✔ WAVAX aprovado");
  await (await incToken.approve(POS_MANAGER, INC_LIQ)).wait();
  console.log("   ✔ INC aprovado");

  // 5. Adicionar liquidez (token0=INC, token1=WAVAX)
  console.log("\n5. Adicionando liquidez...");
  console.log("   INC  :", ethers.formatUnits(INC_LIQ, 18));
  console.log("   WAVAX:", ethers.formatEther(AVAX_LIQ));

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const tx = await pm.mint({
    token0:         INC_TOKEN,
    token1:         WAVAX,
    fee:            FEE,
    tickLower:      MIN_TICK,
    tickUpper:      MAX_TICK,
    amount0Desired: INC_LIQ,
    amount1Desired: AVAX_LIQ,
    amount0Min:     0n,
    amount1Min:     0n,
    recipient:      wallet.address,
    deadline,
  });

  const receipt = await tx.wait();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Pool de liquidez criado com sucesso!           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("TX        :", receipt.hash);
  console.log("Pool      :", poolAddr);
  console.log("Preço     : 1 INC = $0.01");
  console.log("Snowscan  :", "https://snowscan.xyz/tx/" + receipt.hash);
  console.log("Uniswap   :", "https://app.uniswap.org/explore/pools/avalanche/" + poolAddr);
}

main().catch(e => { console.error(e.message); process.exit(1); });
