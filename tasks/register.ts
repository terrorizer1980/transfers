import { task } from "hardhat/config";
import { TransferRegistry } from "@connext/vector-contracts";

import { tidy } from "@connext/vector-types";

export default task("register", "Registers a transfer")
  .addParam("transferAddress", "The transfer's deployed address")
  .addParam("registryAddress", "The registry's deployed address")
  .setAction(async (args, hre) => {
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
      encodedCancel: info.encodedCancel ?? "0x",
    };
    console.log(
      `Adding transfer to registry ${JSON.stringify(cleaned, null, 2)}`
    );
    const tx = await transferRegistry.addTransferDefinition(cleaned);
    const txSent = await tx.wait();
    console.log(`Confirmed addTransferDefinition: ${txSent.transactionHash}`);
  });
