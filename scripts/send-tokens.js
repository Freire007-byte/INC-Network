// scripts/send-tokens.js
const { ethers } = require("ethers");
require("dotenv").config();

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  const rpc      = process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc";
  const token    = process.env.TOKEN_ADDRESS   || "0xeAa4FAF815e36caaa082C71aC8ca962F531443d7";
  const to       = ethers.getAddress((process.env.TO_ADDRESS || "0x14eaf50783f6eA96d9a6ceDE380e3C1FA19D5C3C").toLowerCase());
  const amountUI = process.env.AMOUNT          || "10";

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const contract = new ethers.Contract(token, ERC20_ABI, wallet);

  const [symbol, decimals, balance] = await Promise.all([
    contract.symbol(),
    contract.decimals(),
    contract.balanceOf(wallet.address),
  ]);

  const amount = ethers.parseUnits(amountUI, decimals);

  console.log(`Rede    : Arbitrum One`);
  console.log(`Token   : ${token} (${symbol})`);
  console.log(`De      : ${wallet.address}`);
  console.log(`Para    : ${to}`);
  console.log(`Valor   : ${amountUI} ${symbol}`);
  console.log(`Saldo   : ${ethers.formatUnits(balance, decimals)} ${symbol}`);

  if (balance < amount) throw new Error("Saldo insuficiente");

  const tx = await contract.transfer(to, amount);
  console.log(`\nTX enviada: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✔ Confirmada no bloco ${receipt.blockNumber}`);
  console.log(`  https://arbiscan.io/tx/${receipt.hash}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
