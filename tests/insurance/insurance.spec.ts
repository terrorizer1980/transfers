import { Balance, Address, Bytes32, SignatureString } from "@connext/vector-types";
import { expect, ChannelSigner } from "@connext/vector-utils"
import { Wallet } from "ethers"
import { ethers } from "hardhat"
import { Insurance } from "../../typechain"

// Here we define the state & resolver encodings as types
// Note that uints are formatted as strings

type InsuranceState = {
    receiver: Address
    mediator: Address
    collateral: string
    expiration: string
    UUID: Bytes32
}

type InsuranceResolverData = {
    amount: string,
    UUID: Bytes32
}

type InsuranceResolver = {
    data: InsuranceResolverData
    signature: SignatureString
}

describe("Insurance", () => {
    let insurance: Insurance

    let alice: ChannelSigner
    let bob: ChannelSigner

    let InsuranceStateEncoding: string
    let InsuranceResolverEncoding: string

    beforeEach(async () => {
        // Create channel signers
        alice = new ChannelSigner(Wallet.createRandom().privateKey)
        bob = new ChannelSigner(Wallet.createRandom().privateKey)

        // Deploy the insurance contract
        const factory = await ethers.getContractFactory("Insurance", alice)
        const deployed = await factory.deploy()
        insurance = (await deployed.deployed()) as Insurance

        // Get encodings
        const registry = await insurance.getRegistryInformation()
        InsuranceStateEncoding = registry.stateEncoding
        InsuranceResolverEncoding = registry.resolverEncoding
    })

    // Encode/create the insurance state encoding (for create())
    const createInitialState = async (
        data: string,
        overrides: {
            state?: Partial<InsuranceState>
            balance?: Partial<Balance>
        } = { balance: {}, state: {} }
    ): Promise<{ state: InsuranceState; balance: Balance }> => {
        throw new Error('Method not yet implemented')
    }

    /**
     * Takes in a balance and a state - should match create() in the 
     * associated smart contract for this transfer definition
     * 
     * Should return the result of actually calling
     * create(balance, state) on the smart contract itself
     */
    const createTransfer = async (
        balance: Balance,
        initialState: InsuranceState
    ): Promise<boolean> => {
        throw new Error('Method not yet implemented')
    }

    /**
     * Takes in a balance, (initial) state, and a resolver. Should match
     * resolve() in the associated smart contract for this transfer definition.
     * 
     * Should return the result of actually calling 
     * resolve(balance, state, resolver) on the smart contract itself
     */
    const resolveTransfer = async (
        balance: Balance,
        initialState: InsuranceState,
        resolver: InsuranceResolver
    ): Promise<Balance> => {
        throw new Error('Method not yet implemented')
    }

    /**
     * Given the balance, state, resolver, and resulting balances after a transfer
     * is created and then resolved, verifies expected balances against actual
     */
    const validateResult = async (
        initialBalance: Balance,
        initialState: InsuranceState,
        resolver: InsuranceResolver,
        result: Balance
    ): Promise<void> => {
        throw new Error('Method not yet implemented')
    }

    /** basic tests **/

    it("should deploy", async () => {
        expect(insurance.address).to.be.a("string");
    })

    it("should return the registry information", async () => {
        const registry = await insurance.getRegistryInformation()

        expect(registry.name).to.be.eq(
            "Insurance"
        )
        expect(registry.stateEncoding).to.be.eq(
            "tuple(address receiver, address mediator, uint256 collateral, uint256 expiration, bytes32 UUID)"
        )
        expect(registry.resolverEncoding).to.be.eq(
            "tuple(tuple(uint256 amount, bytes32 UUID) data, bytes signature)"
        )
        expect(registry.definition).to.be.eq(insurance.address)
    })

    /** create tests **/
    describe("Create", () => {
        throw new Error('Method not yet implemented')
    });

    /** resolve tests **/
    describe("Resolve", () => {
        throw new Error('Method not yet implemented')
    });
})