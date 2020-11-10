import { Balance, Address, Bytes32, SignatureString } from "@connext/vector-types";
import { expect, ChannelSigner } from "@connext/vector-utils"
import { Wallet } from "ethers"
import { ethers } from "hardhat"
import { Parameterized } from "../../typechain"

// Here we define the state & resolver encodings as types
// Note that uints are formatted as strings

type Rate = {
    deltaAmount: string
    deltaTime: string
}

type ParameterizedState = {
    receiver: Address
    start: string
    expiration: string
    UUID: Bytes32
    rate: Rate
}

type ParameterizedResolverData = {
    UUID: Bytes32
    paymentAmountTaken: string
}

type ParameterizedResolver = {
    data: ParameterizedResolverData
    payeeSignature: SignatureString
}

describe("Parameterized", () => {
    let Parameterized: Parameterized

    let alice: ChannelSigner
    let bob: ChannelSigner

    let ParameterizedStateEncoding: string
    let ParameterizedResolverEncoding: string

    beforeEach(async () => {
        // Create channel signers
        alice = new ChannelSigner(Wallet.createRandom().privateKey)
        bob = new ChannelSigner(Wallet.createRandom().privateKey)

        // Deploy the Parameterized contract
        const factory = await ethers.getContractFactory("Parameterized", alice)
        const deployed = await factory.deploy()
        Parameterized = (await deployed.deployed()) as Parameterized

        // Get encodings
        const registry = await Parameterized.getRegistryInformation()
        ParameterizedStateEncoding = registry.stateEncoding
        ParameterizedResolverEncoding = registry.resolverEncoding
    })

    // Encode/create the parameterized state encoding (for create())
    const createInitialState = async (
        data: string,
        overrides: {
            state?: Partial<ParameterizedState>
            balance?: Partial<Balance>
        } = { balance: {}, state: {} }
    ): Promise<{ state: ParameterizedState; balance: Balance }> => {
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
        initialState: ParameterizedState
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
        initialState: ParameterizedState,
        resolver: ParameterizedResolver
    ): Promise<Balance> => {
        throw new Error('Method not yet implemented')
    }

    /**
     * Given the balance, state, resolver, and resulting balances after a transfer
     * is created and then resolved, verifies expected balances against actual
     */
    const validateResult = async (
        initialBalance: Balance,
        initialState: ParameterizedState,
        resolver: ParameterizedResolver,
        result: Balance
    ): Promise<void> => {
        throw new Error('Method not yet implemented')
    }

    /** basic tests */

    it("should deploy", async () => {
        expect(Parameterized.address).to.be.a("string");
    })

    it("should return the registry information", async () => {
        const registry = await Parameterized.getRegistryInformation()

        expect(registry.name).to.be.eq(
            "Parameterized"
        )
        expect(registry.stateEncoding).to.be.eq(
            "tuple(address receiver, address mediator, uint256 collateral, uint256 expiration, bytes32 UUID)"
        )
        expect(registry.resolverEncoding).to.be.eq(
            "tuple(tuple(uint256 amount, bytes32 UUID) data, bytes signature)"
        )
        expect(registry.definition).to.be.eq(Parameterized.address)
    })

    /** create tests */
    describe("Create", () => {
        throw new Error('Method not yet implemented')
    });

    /** resolve tests */
    describe("Resolve", () => {
        throw new Error('Method not yet implemented')
    });
})