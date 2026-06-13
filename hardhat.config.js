import hardhatEthers from "@nomicfoundation/hardhat-ethers";

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ritual: {
      type: "http",
      url: "https://rpc.ritualfoundation.org",
      chainId: 1979,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
