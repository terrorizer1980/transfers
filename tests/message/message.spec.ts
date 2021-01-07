import { Balance, Address, Bytes32, SignatureString} from "@connext/vector-types";
import { expect, ChannelSigner, encodeTransferState, encodeBalance, keyify, encodeTransferResolver, recoverAddressFromChannelMessage, getRandomBytes32, mkBytes32 } from "@connext/vector-utils"
import { Wallet } from "ethers"
import { defaultAbiCoder, keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat"
import { Insurance } from "../../typechain"

type MessageState = {
    message: string
}

type MessageResolver = {
    message: string
}