import { task } from "hardhat/config";
import { TransferRegistry } from "@connext/vector-contracts";

export default task("registry-info", "Gets Transfer Registry Info")
  .addParam("registryAddress", "The registry's deployed address")
  .setAction(async (args, hre) => {
    const transferRegistry = await hre.ethers.getContractAt(
      TransferRegistry.abi,
      args.registryAddress
    );

    const owner = await transferRegistry.owner();
    console.log("owner: ", owner);

    const registered = await transferRegistry.getTransferDefinitions();
    console.log("registered: ", registered);
  });
