const { ethers } = require("hardhat");
const { readFileSync } = require("fs");

// Load .env manually if PRIVATE_KEY not in env
if (!process.env.PRIVATE_KEY) {
  try {
    const envContent = readFileSync("./.env", "utf-8");
    envContent.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes("=")) {
        const [key, ...valueParts] = trimmed.split("=");
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    });
  } catch (e) {
    console.error("Could not load .env:", e.message);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    console.error("❌ No deployer account found. Check PRIVATE_KEY in .env");
    process.exit(1);
  }
  console.log(`🔑 Deploying from: ${deployer.address}`);

  console.log("🌙 Deploying RitualDreamlog to Ritual Testnet...");

  const Dreamlog = await ethers.getContractFactory("Dreamlog");
  const dreamlog = await Dreamlog.deploy();

  await dreamlog.waitForDeployment();
  const address = await dreamlog.getAddress();

  console.log(`✅ RitualDreamlog deployed to: ${address}`);
  console.log(`🔗 Explorer: https://explorer.ritualfoundation.org/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
