# Uniswap V2 Multicall Utils

This repository contains TypeScript script `uniswapV2MulticallUtils.ts` that provides utility functions to interact with Uniswap V2 contracts efficiently using concurrent multicalls. These functions are designed to fetch pair addresses, token pairs, reserves, and to write/read V2 pool data to/from JSON files.

## Features

- **Concurrent Multicall**: Utilizes `concurrentMulticall` function to execute multiple calls concurrently, improving efficiency.
- **Multicall Size and Thread Count**: Allows customization of multicall size and thread count to manage memory usage and concurrency.
- **Chunking**: Automatically chunks large requests to avoid exceeding heap memory limits.

## Contents

- **`uniswapV2MulticallUtils.ts`**: TypeScript script containing utility functions.
- **`concurrentMulticall.ts`**: Utility function for concurrent multicalls.

## Usage

1. Install dependencies:

   ```bash
   npm install ethers@^5 fs
   ```

2. Import concurrentMulticall and utility functions from uniswapV2MulticallUtils.ts in your TypeScript project.

3. Use the provided utility functions as needed in your project to interact with Uniswap V2 contracts efficiently.

## Funtionality

- `fetchV2PairAddressesFromFactoryMulticall`: Fetches V2 pair addresses from Uniswap V2 factory contract using concurrent multicalls.
- `fetchV2TokensMulticall`: Fetches V2 token pairs from Uniswap V2 pair contracts using concurrent multicalls.
- `fetchReservesMulticall`: Fetches reserves for V2 pairs from Uniswap V2 pair contracts using concurrent multicalls.
- `writeV2PoolDatasToJSON`: Writes V2 pool data to a JSON file.
- `readV2PoolDatasFromJSON`: Reads V2 pool data from a JSON file.

## Requirements

-Node.js v14.x or higher
-TypeScript

## License

This project is licensed under the MIT License - see the LICENSE file for details.