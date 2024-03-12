import { concurrentMulticall, MulticallCall } from './concurrentMulticall'; // Corrected spelling of 'concurrentMulticall'
import fs from 'fs';
import { ethers } from 'ethers';

export interface V2PoolData {
  address: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  reserve0: string;
  reserve1: string;
  fee: number;
  type: string;
}

// Fetch V2 pair addresses from factory using multicall
export async function fetchV2PairAddressesFromFactoryMulticall(provider: ethers.providers.JsonRpcProvider, factoryAddress: string): Promise<string[]> {
  const factoryABI: string[] = [
    'function allPairsLength() external view returns (uint)',
    'function allPairs(uint) external view returns (address)',
  ];
  const factoryInterface = new ethers.utils.Interface(factoryABI);

  // Fetch total number of pairs from the factory
  const totalPairsData = factoryInterface.encodeFunctionData('allPairsLength', []);
  const totalPairsResponse = await provider.call({ to: factoryAddress, data: totalPairsData });
  const totalPairs = factoryInterface.decodeFunctionResult('allPairsLength', totalPairsResponse)[0].toNumber();

  let targets: string[] = [];
  let callDatas: string[] = [];
  for (let i = 0; i < totalPairs; i++) {
    targets.push(factoryAddress); // Target is the factory contract for all calls
    callDatas.push(factoryInterface.encodeFunctionData('allPairs', [i])); // Call data for fetching pair address by index
  }

  // Define multicallSize and threadCount for batchMulticall execution
  const multicallSize = 1500; // Number of calls in each multicall
  const threadCount = 5; // Number of multicalls to run concurrently

  // Create MulticallCall objects
  const multicallCalls: MulticallCall[] = targets.map((target, index) => {
    return {
      target: target,
      allowFailure: true,
      callData: callDatas[index]
    };
  });

  // Execute batchMulticall to fetch all pair addresses
  const encodedAddresses = await concurrentMulticall(
    provider,
    multicallSize,
    threadCount,
    multicallCalls
  );

  // Decode addresses from the encoded results
  let pairAddresses: string[] = encodedAddresses.map(encodedAddress =>
    encodedAddress ? factoryInterface.decodeFunctionResult('allPairs', encodedAddress)[0] : null
  ).filter(address => address !== null); // Filter out any null results

  return pairAddresses;
}

export interface TokenPair {
  token0: string;
  token1: string;
}

// Fetch V2 tokens using multicall
export async function fetchV2TokensMulticall(provider: ethers.providers.JsonRpcProvider, pairAddresses: string[]): Promise<TokenPair[]>{

  const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const pairABI: string[] = [
      "function token0() external view returns (address)",
      "function token1() external view returns (address)"
  ];

  const pairContractInterface = new ethers.utils.Interface(pairABI);
  
  // Prepare callDatas for token0 and token1
  const callDatasToken0: string[] = pairAddresses.map(address => pairContractInterface.encodeFunctionData('token0'));
  const filteredCallDatasToken0: string[] = callDatasToken0.filter(data => data !== null);

  // Token 0
  // Create MulticallCall objects
  const multicallCallsToken0: MulticallCall[] = pairAddresses.map((address, index) => {
    return {
      target: address,
      allowFailure: true,
      callData: callDatasToken0[index]
    };
  });
  // Use concurrentMulticall to fetch token0 addresses concurrently
  const resultsToken0: string[] = (await concurrentMulticall(provider, 1000, 5, multicallCallsToken0)).filter(result => result !== null? result: "" ) as string[];
  const token0Addresses: string[] = resultsToken0.map((encoded, index) => {
    return pairContractInterface.decodeFunctionResult('token0', encoded)[0];
  });

  // Token 1
  // Create MulticallCall objects
  const multicallCallsToken1: MulticallCall[] = pairAddresses.map((address, index) => {
    return {
      target: address,
      allowFailure: true,
      callData: pairContractInterface.encodeFunctionData('token1')
    };
  });
  // Use concurrentMulticall to fetch token1 addresses concurrently
  const resultsToken1: string[] = (await concurrentMulticall(provider, 1000, 5, multicallCallsToken1)).filter(result => result !== null? result: "" ) as string[];
  const token1Addresses: string[] = resultsToken1.map((encoded, index) => {
    return pairContractInterface.decodeFunctionResult('token1', encoded)[0];
  });

  // Token 0 and Token 1
  const tokenPairs: TokenPair[] = [];
  for (let i = 0; i < pairAddresses.length; i++) {
    tokenPairs.push({token0: token0Addresses[i], token1: token1Addresses[i]});
  }

  return tokenPairs;
}

// Fetch reserves using multicall
export async function fetchReservesMulticall(provider: ethers.providers.JsonRpcProvider, pairAddresses: string[]): Promise<{ reserve0: ethers.BigNumber, reserve1: ethers.BigNumber }[]> {
  const pairABI: string[] = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
  ];
  const pairInterface = new ethers.utils.Interface(pairABI);
  
  // Prepare callData for 'getReserves' for each pair address
  const callDatas: string[] = pairAddresses.map(() => pairInterface.encodeFunctionData('getReserves'));

  // Create MulticallCall objects
  const multicallCalls: MulticallCall[] = pairAddresses.map((address, index) => {
    return {
      target: address,
      allowFailure: true,
      callData: callDatas[index]
    };
  });

  // Use concurrentMulticall to fetch reserves data concurrently
  const encodedResults: (string | null)[] = await concurrentMulticall(
    provider, 
    1000, // multicallSize
    5, // threadCount - Number of multicalls to process concurrently
    multicallCalls
  );

  // Decode the reserves data from the multicall results
  const reservesResults: { reserve0: ethers.BigNumber, reserve1: ethers.BigNumber }[] = encodedResults.map((encoded, index) => {
    if (encoded !== null) {
      const [reserve0, reserve1] = pairInterface.decodeFunctionResult('getReserves', encoded);
      console.log(`Reserves for pair at ${pairAddresses[index]}: ${reserve0}, ${reserve1}`);
      return { reserve0, reserve1 };
    } else {
      console.error(`Failed to fetch reserves for pair at ${pairAddresses[index]}`);
      return { reserve0: ethers.BigNumber.from(0), reserve1: ethers.BigNumber.from(0) }; // Return default values for failed calls
    }
  });

  return reservesResults;
}

// Write V2 pool data to JSON file
export async function writeV2PoolDatasToJSON(tokenPairs: V2PoolData[], filename: string) {
  const jsonString = JSON.stringify(tokenPairs, null, 2);
  fs.writeFile(filename, jsonString, err => {
    if (err) {
      console.log('Error writing file', err);
    } else {
      console.log('Successfully wrote file');
    }
  }); 
}

// Read V2 pool data from JSON file
export async function readV2PoolDatasFromJSON(filename: string): Promise<V2PoolData[]> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, jsonString) => {
      if (err) {
        console.log('Error reading file', err);
        reject(err);
      } else {
        console.log('Successfully read file');
        resolve(JSON.parse(jsonString));
      }
    });
  });
}
