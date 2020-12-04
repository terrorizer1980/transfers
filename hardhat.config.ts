import { HardhatUserConfig } from "hardhat/types";
import { config as dotEnvConfig } from "dotenv";
import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle";

dotEnvConfig();

import * as packageJson from "./package.json";
import "./tasks";

const GANACHE_MNEMONIC =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

const config: HardhatUserConfig = {
  paths: {
    sources: "./contracts",
    tests: "./tests",
    artifacts: "./artifacts",
  },
  solidity: {
    compilers: [
      {
        version: packageJson.devDependencies.solc,
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    ganache: {
      chainId: 1337,
      url: "http://localhost:8545",
      accounts: {
        mnemonic: GANACHE_MNEMONIC,
      },
    },
    hardhat: {
      chainId: 1338,
      loggingEnabled: false,
    },
    rinkeby: {
      url: process.env.ETH_PROVIDER,
      chainId: 4,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    kovan: {
      url: process.env.ETH_PROVIDER,
      chainId: 42,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
  typechain: {
    target: "ethers-v5",
  },
};

export default config;
