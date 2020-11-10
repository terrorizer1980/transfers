import { HardhatUserConfig } from "hardhat/types";

import * as packageJson from "./package.json";

import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle";

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
        }
      }
    ]
  },
  defaultNetwork: "hardhat",
  networks: {
    ganache: {
      chainId: 1337,
      url: "http://localhost:8545",
    },
    hardhat: {
      chainId: 1338,
      loggingEnabled: false,
    },
  },
  typechain: {
    target: "ethers-v5",
  },
};

export default config;