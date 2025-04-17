require("@nomicfoundation/hardhat-toolbox");
// require("@chainlink/env-enc").config()
require("dotenv").config()
require("hardhat-deploy");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const GANACHE_URL = "HTTP://127.0.0.1:8545"
const GANACHE_PRIVATE_KEY = process.env.GANACHE_PRIVATE_KEY
const GANACHE_PRIVATE_KEY_1 = process.env.GANACHE_PRIVATE_KEY_1
const GANACHE_PRIVATE_KEY_2 = process.env.GANACHE_PRIVATE_KEY_2

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY, PRIVATE_KEY_1],
      chainId: 11155111
    },
    ganache: {
      url: GANACHE_URL,
      accounts: [GANACHE_PRIVATE_KEY, GANACHE_PRIVATE_KEY_1,GANACHE_PRIVATE_KEY_2],
      chainId: 1337
    }
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY
    }
  },
  namedAccounts: {
    firstAccount: {
      default: 0
    },
    secondAccount: {
      default: 1
    },
    thirdAccount: {
      default: 2
    },
  },
  sourcify: {
    enabled: true
  },
};
