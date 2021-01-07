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
import { defaultAbiCoder, keccak256, recoverAddress } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Parameterized } from "../../typechain";

// Here we define the state & resolver encodings as types
// Note that uints are formatted as strings

type Rate = {
  deltaAmount: string;
  deltaTime: string;
};

type ParameterizedState = {
  receiver: Address;
  start: string;
  expiration: string;
  UUID: Bytes32;
  rate: Rate;
};

type ParameterizedResolverData = {
  UUID: Bytes32;
  paymentAmountTaken: string;
};

type ParameterizedResolver = {
  data: ParameterizedResolverData;
  payeeSignature: SignatureString;
};

describe("Parameterized", () => {
  let parameterized: Parameterized;

  let alice: ChannelSigner;
  let bob: ChannelSigner;

  let ParameterizedStateEncoding: string;
  let ParameterizedResolverEncoding: string;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    // Create channel signers
    alice = new ChannelSigner(Wallet.createRandom().privateKey);
    bob = new ChannelSigner(Wallet.createRandom().privateKey);

    // Deploy the Parameterized contract
    const factory = await ethers.getContractFactory(
      "Parameterized",
      signers[0]
    );
    const deployed = await factory.deploy();
    parameterized = (await deployed.deployed()) as Parameterized;

    // Get encodings
    const registry = await parameterized.getRegistryInformation();
    ParameterizedStateEncoding = registry.stateEncoding;
    ParameterizedResolverEncoding = registry.resolverEncoding;
  });

  // Encode/create the insurance state encoding (for create())
  const createInitialState = async (
    initialState: ParameterizedState,
    initialBalances: Balance
  ): Promise<{ state: ParameterizedState; balance: Balance }> => {
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
    initialState: ParameterizedState
  ): Promise<boolean> => {
    const encodedState = encodeTransferState(
      initialState,
      ParameterizedStateEncoding
    );
    const encodedBalance = encodeBalance(balance);

    return parameterized.create(encodedBalance, encodedState);
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
    initialState: ParameterizedState,
    resolver: ParameterizedResolver
  ): Promise<Balance> => {
    const encodedState = encodeTransferState(
      initialState,
      ParameterizedStateEncoding
    );
    const encodedResolver = encodeTransferResolver(
      resolver,
      ParameterizedResolverEncoding
    );
    const encodedBalance = encodeBalance(balance);

    const ret = (
      await parameterized.functions.resolve(
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
    initialState: ParameterizedState,
    resolver: ParameterizedResolver,
    result: Balance
  ): Promise<void> => {
    let resolverDataEncoding = [
      "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
    ];
    let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
      resolver.data,
    ]);
    let hashedData = keccak256(encodedData);
    let signer = await recoverAddressFroUtilityMessage(
      hashedData,
      resolver.payeeSignature
    );

    // Receiver signs, payment completed as normal
    expect(signer == initialState.receiver);

    let amountTransferred = resolver.data.paymentAmountTaken;

    let finalBalance0 =
      BigInt(initialBalance.amount[0]) - BigInt(amountTransferred);
    let finalBalance1 = BigInt(amountTransferred);

    expect(result.amount[0].toString()).to.eq(finalBalance0.toString());
    expect(result.amount[1].toString()).to.eq(finalBalance1.toString());
  };

  /** basic tests */

  it("should deploy", async () => {
    expect(parameterized.address).to.be.a("string");
  });

  it("should return the registry information", async () => {
    const registry = await parameterized.getRegistryInformation();

    expect(registry.name).to.be.eq("Parameterized");
    expect(registry.stateEncoding).to.be.eq(
      "tuple(address receiver, uint256 start, uint256 expiration, bytes32 UUID, tuple(uint256 deltaAmount, uint256 deltaTime) rate)"
    );
    expect(registry.resolverEncoding).to.be.eq(
      "tuple(tuple(bytes32 UUID, uint256 paymentAmountTaken) data, bytes payeeSignature)"
    );
    expect(registry.definition).to.be.eq(parameterized.address);

    let parameterizedResolverData: ParameterizedResolverData = {
      UUID: '',
      paymentAmountTaken: '0'
    }

    let parameterizedResolver: ParameterizedResolver = {
      data: parameterizedResolverData,
      payeeSignature: ''
    }

    expect(registry.encodedCancel).to.be.eq(
      encodeTransferResolver({ parameterizedResolver }, registry.resolverEncoding)
    );
  });

  /** create tests */

  describe("Create", () => {
    it("should create successfully", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      await createInitialState(initialState, initialBalance);
    });

    it("should fail if recipient has nonzero balance", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "10000"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Cannot create parameterized payment with nonzero recipient init balance"
      );
    });

    it("should fail if recipient is the zero address", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: "0x0000000000000000000000000000000000000000",
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Receiver address cannot be the zero address!"
      );
    });

    it("should fail if the expiration is less than 3 days in the future", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "Expiration must be at least 3 days in the future."
      );
    });

    it("should fail if the UUID is null", async () => {
      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: mkBytes32("0x"),
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );
      await expect(createTransfer(balance, state)).revertedWith(
        "UUID cannot be null."
      );
    });

    it("should fail is the rate is invalid", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      let rate1: Rate = { deltaAmount: "0", deltaTime: "1" };
      let rate2: Rate = { deltaAmount: "1", deltaTime: "0" };

      // Start: now
      // Expiration: 5 days in the future
      let initialState1: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate1,
      };

      let initialState2: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate2,
      };

      const state1 = await createInitialState(initialState1, initialBalance);
      const state2 = await createInitialState(initialState2, initialBalance);

      await expect(createTransfer(state1.balance, state1.state)).revertedWith(
        "Per-unit amount must be at least 1 wei"
      );

      await expect(createTransfer(state2.balance, state2.state)).revertedWith(
        "Per-unit time must be at least 1 second"
      );
    });
  });

  /** resolve tests */

  describe("Resolve", () => {
    it("should resolve successfully when cancelled by the recipient", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = [
        "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
      ];
      let resolverData: ParameterizedResolverData = {
        UUID: UUID,
        paymentAmountTaken: "0",
      };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: ParameterizedResolver = {
        data: resolverData,
        payeeSignature: recipientSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should resolve successfully when taking full payment", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = [
        "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
      ];
      let resolverData: ParameterizedResolverData = {
        UUID: UUID,
        paymentAmountTaken: "10000",
      };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: ParameterizedResolver = {
        data: resolverData,
        payeeSignature: recipientSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should resolve successfully when taking partial payment", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = [
        "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
      ];
      let resolverData: ParameterizedResolverData = {
        UUID: UUID,
        paymentAmountTaken: "5000",
      };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: ParameterizedResolver = {
        data: resolverData,
        payeeSignature: recipientSignature,
      };

      const result = await resolveTransfer(balance, state, resolver);
      await validateResult(initialBalance, initialState, resolver, result);
    });

    it("should fail if trying to take too much payment", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // Essentially an infinite rate since it's larger than the balance @ 1 second
      let rate: Rate = {
        deltaAmount: "100000",
        deltaTime: "1",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = [
        "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
      ];
      let resolverData: ParameterizedResolverData = {
        UUID: UUID,
        paymentAmountTaken: "10001",
      };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: ParameterizedResolver = {
        data: resolverData,
        payeeSignature: recipientSignature,
      };

      await expect(resolveTransfer(balance, state, resolver)).revertedWith(
        "Cannot take more payment than originally allocated."
      );
    });
    it("should fail if trying to take payment too fast (exceeding the rate)", async () => {
      let UUID = getRandomBytes32();

      // Alice puts up 10k, bob puts up zero
      let initialBalance: Balance = {
        amount: ["10000", "0"],
        to: [alice.address, bob.address],
      };

      // A small rate
      let rate: Rate = {
        deltaAmount: "1",
        deltaTime: "100",
      };

      // Start: now
      // Expiration: 5 days in the future
      let initialState: ParameterizedState = {
        receiver: bob.address,
        start: `${Math.floor(Date.now() / 1000)}`,
        expiration: `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}`,
        UUID: UUID,
        rate: rate,
      };

      const { balance, state } = await createInitialState(
        initialState,
        initialBalance
      );

      let resolverDataEncoding = [
        "tuple(bytes32 UUID, uint256 paymentAmountTaken)",
      ];
      let resolverData: ParameterizedResolverData = {
        UUID: UUID,
        paymentAmountTaken: "10000",
      };
      let encodedData = defaultAbiCoder.encode(resolverDataEncoding, [
        resolverData,
      ]);
      let hashedData = keccak256(encodedData);

      const recipientSignature = await bob.signUtilityMessage(hashedData);

      let resolver: ParameterizedResolver = {
        data: resolverData,
        payeeSignature: recipientSignature,
      };

      await expect(resolveTransfer(balance, state, resolver)).revertedWith(
        "Payment rate exceeded."
      );
    });
  });
});
