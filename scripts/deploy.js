import { createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

// Load .env manually
const envContent = readFileSync("./.env", "utf-8");
const env = Object.fromEntries(
  envContent.split("\n").filter(l => l.includes("=")).map(l => l.split("="))
);

// Load contract ABI and bytecode from Hardhat artifacts
const artifact = JSON.parse(
  readFileSync("./artifacts/contracts/Dreamlog.sol/RitualDreamlog.json", "utf-8")
);

const ritualChain = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ritualfoundation.org"] } },
});

async function main() {
  const privateKey = env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");

  const account = privateKeyToAccount(`0x${privateKey}`);
  console.log(`🔑 Deploying from: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: ritualChain,
    transport: http(),
  });

  console.log("🌙 Deploying RitualDreamlog to Ritual Testnet...");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });

  console.log(`📝 TX Hash: ${hash}`);
  console.log(`🔗 Explorer: https://explorer.ritualfoundation.org/tx/${hash}`);
  console.log("⏳ Waiting for confirmation...");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
