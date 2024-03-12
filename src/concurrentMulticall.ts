import { ethers } from 'ethers';

export interface MulticallCall {
  target: string;
  allowFailure: boolean;
  callData: string;
}

export async function concurrentMulticall(  
  provider: ethers.providers.JsonRpcProvider,
  multicallSize: number,
  threadCount: number,
  multicallCalls: MulticallCall[]
): Promise<(string | null)[]> {
  const chunkSize = 300000;

  const chunks: MulticallCall[][] = []; // Provide initial value for the 'chunks' array

  for (let i = 0; i < multicallCalls.length; i += chunkSize) {
    chunks.push(multicallCalls.slice(i, i + chunkSize));
  }

  console.log("chunks", chunks.length)

  const results: (string | null)[][] = [];
  for (const chunk of chunks) {
    results.push(await concurrentMulticallNotMemoryContrained(provider, multicallSize, threadCount, chunk));
  }

  return results.flat();
}

export async function concurrentMulticallNotMemoryContrained(
  provider: ethers.providers.JsonRpcProvider,
  multicallSize: number,
  threadCount: number,
  multicallCalls: MulticallCall[]
): Promise<(string | null)[]> {
  const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const multicallABI: string[] = [
    "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calldata calls) external view returns (tuple(bool success, bytes returnData)[])"
  ];
  const multicallInterface = new ethers.utils.Interface(multicallABI);

  const multicallGroups = chunkArray(multicallCalls, multicallSize);

  const processMulticallGroup = async (group: { target: string, allowFailure: boolean, callData: string }[]): Promise<(string | null)[]> => {
    try {
      const callData = multicallInterface.encodeFunctionData('aggregate3', [group]);
      const response = await provider.call({ to: multicallAddress, data: callData });
      const [callResults] = multicallInterface.decodeFunctionResult('aggregate3', response);
      return callResults.map((result: { success: boolean, returnData: string }) => result.success ? result.returnData : null);
    } catch (error) {
      console.error('Error processing multicall group:', error);
      // Return an array of nulls equivalent to the group size to maintain result structure
      return group.map(() => null);
    }
  };

  let results: (string | null)[] = [];
  for (let i = 0; i < multicallGroups.length; i += threadCount) {
    console.log(`Processing items ${i*multicallSize} to ${(i+threadCount)*multicallSize} of ${multicallCalls.length}`);
    const concurrentGroups = multicallGroups.slice(i, i + threadCount);
    console.log(`Processing ${concurrentGroups.length} groups concurrently.`);
    const batchResults = await Promise.all(concurrentGroups.map(group => processMulticallGroup(group).catch(error => {
      console.error('Error in multicall:', error);
      // Return an array of nulls for failed calls
      return new Array(group.length).fill(null);
    })));
    results.push(...batchResults.flat());
  }

  return results.flat().filter(result => result !== null);
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      chunks.push(chunk);
  }
  return chunks;
}

