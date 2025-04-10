import { ActionGetResponse, ActionPostResponse } from "@solana/actions";
import { serialize, http } from "wagmi";
import { parseEther, encodeFunctionData, createPublicClient } from "viem";
import { monad } from "@/monad";

const blockchain = "eip155:10143";
const nftContractAddress = "0x244FBFA8b2E02A0c5634d30Bb16E2d9B1B63Cb0d";

const client = createPublicClient({
  chain: monad,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

async function estimateGasFees() {
  const feeData = await client.estimateFeesPerGas();
  
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error("Failed to retrieve gas fee data from the network");
  }
  
  return {
    maxFeePerGas: feeData.maxFeePerGas.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString(),
  };
}

const nftAbi = [
  {
    inputs: [{ internalType: "address", name: "to", type: "address" }],
    name: "safeMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-blockchain-ids, x-action-version",
  "Access-Control-Expose-Headers": "x-blockchain-ids, x-action-version",
  "Content-Type": "application/json",
  "x-blockchain-ids": blockchain,
  "x-action-version": "2.4",
};

export const OPTIONS = async () => {
  return new Response(null, { headers });
};

export const GET = async (req: Request) => {
  const response: ActionGetResponse = {
    type: "action",
    icon: `${new URL("/nft-mint.png", req.url).toString()}`,
    label: "",
    title: "",
    description:
      `1 ProtoMON = 0.0069420 MON`,
    links: {
      actions: [
        {
          type: "transaction",
          href: `/api/actions/mint-nft?amount={amount}`,
          label: "Mint NFT",
          parameters: [
            {
              name: "amount",
              label: `Enter MON amount`,
              type: "number",
            },
          ],
        }
      ],
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
};

export const POST = async (req: Request) => {
  try {
    // Get data from request
    const requestBody = await req.json();
    const userAddress = requestBody.account;
    
    // Get amount from URL parameters
    const url = new URL(req.url);
    const inputAmount = url.searchParams.get("amount");
    
    if (!userAddress) {
      throw new Error("User address is required");
    }
    
    if (!inputAmount) {
      throw new Error("Amount is required");
    }
    
    // Encode the function call for safeMint
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: "safeMint",
      args: [userAddress],
    });

    const gasEstimate = await estimateGasFees();
    
    const transaction = {
      to: nftContractAddress,
      data,
      value: parseEther(inputAmount).toString(),
      chainId: "10143",
      type: "0x2",
      maxFeePerGas: gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
    };

    const transactionJson = serialize(transaction);

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: transactionJson,
      message: "Your NFT is being minted!",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ 
      error: "Error processing request", 
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 400,
      headers,
    });
  }
};