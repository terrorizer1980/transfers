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

```
> npm run test
```
