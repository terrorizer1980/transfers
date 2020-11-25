import { task } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/types";
import { TransferRegistry } from "@connext/vector-contracts";

import * as packageJson from "./package.json";

import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle";
import { tidy } from "@connext/vector-types";

task("register", "Registers a transfer")
  .addParam("transferAddress", "The transfer's deployed address")
  .addParam("registryAddress", "The registry's deployed address")
  .setAction(async (args, hre) => {
    await hre.ethers.getSigners();
    const transfer = await hre.ethers.getContractAt(
      "TransferDefinition",
      args.transferAddress
    );
    const transferRegistry = await hre.ethers.getContractAt(
      TransferRegistry.abi,
      args.registryAddress
    );
    const info = await transfer.getRegistryInformation();
    const cleaned = {
      name: info.name,
      definition: info.definition,
      resolverEncoding: tidy(info.resolverEncoding),
      stateEncoding: tidy(info.stateEncoding),
    };
    console.log(
      `Adding transfer to registry ${JSON.stringify(cleaned, null, 2)}`
    );
    const tx = await transferRegistry.addTransferDefinition(cleaned);
    const txSent = await tx.wait();
    console.log(`Confirmed addTransferDefinition: ${txSent.transactionHash}`);
  });

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
  },
  typechain: {
    target: "ethers-v5",
  },
};

export default config;
