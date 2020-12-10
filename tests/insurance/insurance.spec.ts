import {
  Balance,
  Address,
  Bytes32,
  SignatureString,
} from "@connext/vector-types";
import {
  expect,
  ChannelSigner,
  encodeTransferState,
  encodeBalance,
  keyify,
  encodeTransferResolver,
  recoverAddressFromChannelMessage,
  getRandomBytes32,
  mkBytes32,
  recoverAddressFroUtilityMessage,
} from "@connext/vector-utils";
import { Wallet } from "ethers";
import { defaultAbiCoder, keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Insurance } from "../../typechain";

// Here we define the state & resolver encodings as types
// Note that uints are formatted as strings

type InsuranceState = {
  receiver: Address;
  mediator: Address;
  collateral: string;
  expiration: string;
  UUID: Bytes32;
};

type InsuranceResolverData = {
  amount: string;
  UUID: Bytes32;
};

type InsuranceResolver = {
  data: InsuranceResolverData;
  signature: SignatureString;
};

describe("Insurance", () => {
  let insurance: Insurance;

  let alice: ChannelSigner;
  let bob: ChannelSigner;
  let mediator: ChannelSigner;

  let InsuranceStateEncoding: string;
  let InsuranceResolverEncoding: string;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    // Create channel signers
    alice = new ChannelSigner(Wallet.createRandom().privateKey);
    bob = new ChannelSigner(Wallet.createRandom().privateKey);
    mediator = new ChannelSigner(Wallet.createRandom().privateKey);

    // Deploy the insurance contract
    const factory = await ethers.getContractFactory("Insurance", signers[0]);
    const deployed = await factory.deploy();
    insurance = (await deployed.deployed()) as Insurance;

    // Get encodings
    const registry = await insurance.getRegistryInformation();
    InsuranceStateEncoding = registry.stateEncoding;
    InsuranceResolverEncoding = registry.resolverEncoding;
  });

  // Encode/create the insurance state encoding (for create())
  const createInitialState = async (
    initialState: InsuranceState,
    initialBalances: Balance
  ): Promise<{ state: InsuranceState; balance: Balance }> => {
    return {
      state: initialState,
      balance: initialBalances,
    };
  };

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
    const encodedState = encodeTransferState(
      initialState,
      InsuranceStateEncoding
    );
    const encodedBalance = encodeBalance(balance);

    return insurance.create(encodedBalance, encodedState);
  };

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
    const encodedState = encodeTransferState(
      initialState,
      InsuranceStateEncoding
    );
    const encodedResolver = encodeTransferResolver(
      resolver,
      InsuranceResolverEncoding
    );
    const encodedBalance = encodeBalance(balance);

    const ret = (
      await insurance.functions.resolve(
        encodedBalance,
        encodedState,
        encodedResolver
      )
    )[0];

    return keyify(balance, ret);
  };

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
    let resolverDataEncoding = ["tuple(uint256 amount, bytes32 UUID)"];
    let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
      resolver.data,
    ]);
    let hashedData = keccak256(encodedData);
    let signer = await recoverAddressFroUtilityMessage(
      hashedData,
      resolver.signature
    );

    // Receiver signs, payment aborted
    if (signer == initialState.receiver) {
      expect(result.amount[0].toString()).to.eq(initialBalance.amount[0]);
      expect(result.amount[1].toString()).to.eq(initialBalance.amount[1]);
      expect(result.to).to.deep.equal(initialBalance.to);
      // Mediator signs, payment made
    } else {
      let finalBalance0 =
        BigInt(initialBalance.amount[0]) - BigInt(resolver.data.amount);
      let finalBalance1 = BigInt(resolver.data.amount);

      expect(result.amount[0].toString()).to.eq(finalBalance0.toString());
      expect(result.amount[1].toString()).to.eq(finalBalance1.toString());
    }
  };

  /** basic tests **/

  it("should deploy", async () => {
    expect(insurance.address).to.be.a("string");
  });

  it("should return the registry information", async () => {
    const registry = await insurance.getRegistryInformation();

    expect(registry.name).to.be.eq("Insurance");
    expect(registry.stateEncoding).to.be.eq(
      "tuple(address receiver, address mediator, uint256 collateral, uint256 expiration, bytes32 UUID)"
    );
    expect(registry.resolverEncoding).to.be.eq(
      "tuple(tuple(uint256 amount, bytes32 UUID) data, bytes signature)"
    );
    expect(registry.definition).to.be.eq(insurance.address);
  });

  /** create tests **/
  describe("Create", () => {
    it("should create successfully", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: getRandomBytes32(),
      };

      await createInitialState(initialState, initialBalance);
    });

    it("should fail if recipient has nonzero balance", async () => {
      // Alice puts up 10k, bob puts up 10k
      let initialBalance: Balance = {
        amount: ["10000", "10000"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: getRandomBytes32(),
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Cannot create parameterized payment with nonzero recipient init balance"
      );
    });

    it("should fail if recipient or mediator have zero address", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState1: InsuranceState = {
        receiver: "0x0000000000000000000000000000000000000000",
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: getRandomBytes32(),
      };

      let initialState2: InsuranceState = {
        receiver: bob.address,
        mediator: "0x0000000000000000000000000000000000000000",
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: getRandomBytes32(),
      };

      const state1 = await createInitialState(initialState1, initialBalance);
      const state2 = await createInitialState(initialState2, initialBalance);
      await expect(createTransfer(state1.balance, state1.state)).revertedWith(
        "Receiver address cannot be the zero address!"
      );
      await expect(createTransfer(state2.balance, state2.state)).revertedWith(
        "Mediator address cannot be the zero address!"
      );
    });

    it("should fail if expiration is less than 3 days in the future", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 2 * 24 * 60}`,
        UUID: getRandomBytes32(),
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Expiration must be at least 3 days in the future."
      );
    });

    it("should fail if UUID is null", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: mkBytes32("0x"),
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "UUID cannot be null."
      );
    });

    it("should fail is collateral is zero", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "0",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: getRandomBytes32(),
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Collateral must be nonzero"
      );
    });
  });

  /** resolve tests **/
  describe("Resolve", () => {
    it("should resolve successfully when cancelled by the recipient", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = ["tuple(uint256 amount, bytes32 UUID)"];
      let resolverData: InsuranceResolverData = { amount: "0", UUID: UUID };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: recipientSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should resolve successfully when signed by the mediator for the full collateral amount", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = ["tuple(uint256 amount, bytes32 UUID)"];
      let resolverData: InsuranceResolverData = { amount: "10000", UUID: UUID };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const mediatorSignature = await mediator.signUtilityMessage(hashedData);

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: mediatorSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should resolve successfully when signed by the mediator for a partial collateral amount", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = ["tuple(uint256 amount, bytes32 UUID)"];
      let resolverData: InsuranceResolverData = { amount: "5000", UUID: UUID };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const mediatorSignature = await mediator.signUtilityMessage(hashedData);

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: mediatorSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should fail if the recipient signature is invalid", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverData: InsuranceResolverData = { amount: "5000", UUID: UUID };

      const recipientSignature = await bob.signUtilityMessage(
        getRandomBytes32()
      );

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: recipientSignature,
      };

      await expect(resolveTransfer(balance, state, resolver)).revertedWith(
        "Signature did not verify!"
      );
    });

    it("should fail if the mediator signature is invalid", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverData: InsuranceResolverData = { amount: "5000", UUID: UUID };

      const mediatorSignature = await mediator.signUtilityMessage(
        getRandomBytes32()
      );

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: mediatorSignature,
      };

      await expect(resolveTransfer(balance, state, resolver)).revertedWith(
        "Signature did not verify!"
      );
    });

    it("should fail if the amount is greater than the transfer", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let initialState: InsuranceState = {
        receiver: bob.address,
        mediator: mediator.address,
        collateral: "10000",
        expiration: `${Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60}`,
        UUID: UUID,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = ["tuple(uint256 amount, bytes32 UUID)"];
      let resolverData: InsuranceResolverData = { amount: "15000", UUID: UUID };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const mediatorSignature = await mediator.signUtilityMessage(hashedData);

      let resolver: InsuranceResolver = {
        data: resolverData,
        signature: mediatorSignature,
      };

      await expect(resolveTransfer(balance, state, resolver)).revertedWith(
        "Cannot transfer more than originally allocated."
      );
    });
  });
});
