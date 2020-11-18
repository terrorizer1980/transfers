import { Balance, Address, Bytes32, SignatureString} from "@connext/vector-types";
import { expect, ChannelSigner, encodeTransferState, encodeBalance, keyify, encodeTransferResolver, recoverAddressFromChannelMessage, getRandomBytes32, mkBytes32 } from "@connext/vector-utils"
import { Wallet } from "ethers"
import { defaultAbiCoder, keccak256, recoverAddress } from "ethers/lib/utils";
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
    let parameterized: Parameterized

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
        parameterized = (await deployed.deployed()) as Parameterized

        // Get encodings
        const registry = await parameterized.getRegistryInformation()
        ParameterizedStateEncoding = registry.stateEncoding
        ParameterizedResolverEncoding = registry.resolverEncoding
    })

    
    // Encode/create the insurance state encoding (for create())
    const createInitialState = async (
        initialState: ParameterizedState,
        initialBalances: Balance
    ): Promise<{ state: ParameterizedState; balance: Balance }> => {
        return {
            state: initialState,
            balance: initialBalances
        }
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
        const encodedState = encodeTransferState(initialState, ParameterizedStateEncoding)
        const encodedBalance = encodeBalance(balance)
        
        return parameterized.create(encodedBalance, encodedState)
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
        const encodedState = encodeTransferState(initialState, ParameterizedStateEncoding)
        const encodedResolver = encodeTransferResolver(resolver, ParameterizedResolverEncoding)
        const encodedBalance = encodeBalance(balance)

        const ret = (
            await parameterized.functions.resolve(
                encodedBalance,
                encodedState,
                encodedResolver
            )
        )[0]

        return keyify(balance, ret)
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
        let resolverDataEncoding = ["tuple(bytes32 UUID, uint256 paymentAmountTaken)"]
        let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [resolver.data])
        let hashedData = keccak256(encodedData)
        let signer = await recoverAddressFromChannelMessage(hashedData, resolver.payeeSignature)

        // Receiver signs, payment completed as normal
        expect(signer == initialState.receiver) {
            let amountTransferred = resolver.data.paymentAmountTaken

            let finalBalance0 = BigInt(initialBalance.amount[0]) - BigInt(amountTransferred)
            let finalBalance1 = BigInt(amountTransferred)

            expect(result.amount[0].toString()).to.eq(finalBalance0.toString())
            expect(result.amount[1].toString()).to.eq(finalBalance1.toString())
        }
    }
    
    /** basic tests */

    it("should deploy", async () => {
        expect(parameterized.address).to.be.a("string");
    })

    it("should return the registry information", async () => {
        const registry = await parameterized.getRegistryInformation()

        expect(registry.name).to.be.eq(
            "Parameterized"
        )
        expect(registry.stateEncoding).to.be.eq(
            "tuple(address receiver, address mediator, uint256 collateral, uint256 expiration, bytes32 UUID)"
        )
        expect(registry.resolverEncoding).to.be.eq(
            "tuple(tuple(uint256 amount, bytes32 UUID) data, bytes signature)"
        )
        expect(registry.definition).to.be.eq(parameterized.address)
    })

    /** create tests */

    describe("Create", () => {
        it("should create successfully", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if recipient has nonzero balance", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if recipient is the zero address", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if the expiration is less than 3 days in the future", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if the UUID is null", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail is the rate is invalid", async () => {
            throw new Error('Method not yet implemented.')
        })
    });

    /** resolve tests */

    describe("Resolve", () => {
        it("should resolve successfully", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if the recipient signature is invalid", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if the amount is greater than the transfer", async () => {
            throw new Error('Method not yet implemented.')
        })

        it("should fail if the amount taken exceeds the allowed rate", async () => {
            throw new Error('Method not yet implemented.')
        })
    });

})