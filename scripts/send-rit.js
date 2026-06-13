const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.ritualfoundation.org");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const CONTRACT = "0xcf20cAA57F6984859b3663690a0B147FC8eB7150";
  
  console.log("Sending 0.5 RIT to contract...");
  const tx = await wallet.sendTransaction({
    to: CONTRACT,
    value: ethers.parseEther("0.5"),
    gasLimit: 500000n,
  });
  
  console.log("TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  
  // Check RitualWallet balance
  const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
  const walletAbi = ["function balanceOf(address) view returns (uint256)"];
  const ritWallet = new ethers.Contract(RITUAL_WALLET, walletAbi, provider);
  const bal = await ritWallet.balanceOf(CONTRACT);
  console.log("Contract RitualWallet balance:", ethers.formatEther(bal));
}

main().catch(console.error);
