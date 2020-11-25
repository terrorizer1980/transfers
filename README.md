# Transfers

Stores all transfer definitions supported by the vector protocol.

## Background

// TODO

## Adding Transfers

To add a new transfer definition, you must submit a pull request that includes the following:

- A `.sol` file defining your transfer logic. This should implement the `ITransferDefinition` interface, defined [here](https://github.com/connext/vector/blob/main/modules/contracts/src.sol/interfaces/ITransferDefinition.sol)
- Tests for your transfer definition
- An address of your deployed contract for the networks you want the transfer to be supported on (rinkeby, mainnet, goerli, etc.)

See the `hashlock` or `withdraw` directories for examples.

## Running Tests

To run the tests, do the following:

1. Install all dependencies:

```sh
> npm i
```

2. Build the repo

```sh
> npm run build
```

3. Run tests

```sh
> npm run test
```

## Working with a local vector stack

Transfers added to this repository will **NOT** be included in the default vector contract deployment when working with a local vector deployment.

To deploy these contracts and add them to the local network, do the following:

1. Start up vector locally (whichever stack you wish, but at least make sure the `global` stack is running):

```sh
~/vector > make start # can be make start-trio, make start-duet, or make start-global as well
```

2. Update the `transferNames` array in the `scripts/deploy.ts` file to include all the transfer names you would like to deploy and register locally:

```ts
// Update the `transferNames` variable in ~/transfers/scripts/deploy.ts
// i.e. deploying Withdraw and Hashlock
const transferNames = ["HashlockTransfer", "Withdraw"];
// ...
```

3. From the root of this repository, deploy the transfers to the running chain (will by default have `chainId` 1337):

```sh
~/transfers > npx hardhat run scripts/deploy.ts --network ganache
```

4. Manually update the `~/vector/.chaindata/address-book.json` file to include the printed `address-book` entry information from the script output

5. Register the transfer with the deployed `TransferRegistry`:

```sh
~/vector > bash ops/register-transfer.sh -t <NAME_OR_ADDRESS_TO_REGISTER>
```
