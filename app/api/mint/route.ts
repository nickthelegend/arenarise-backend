// /app/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import pinataSDK from "@pinata/sdk";
import { Readable } from "stream";

const replicate = new Replicate({
  // expects REPLICATE_API_TOKEN in env
  auth: process.env.REPLICATE_API_TOKEN,
});

const pinata = new pinataSDK(
  process.env.PINATA_API_KEY ?? "",
  process.env.PINATA_SECRET_KEY ?? ""
);

const GETGEMS_BASE = process.env.GETGEMS_BASE ?? "https://api.testnet.getgems.io/public-api";
const GETGEMS_COLLECTION = process.env.GETGEMS_COLLECTION ?? ""; // e.g. EQAz...
const GETGEMS_AUTHORIZATION = process.env.GETGEMS_AUTHORIZATION ?? ""; // token string as required by their API
const OWNER_WALLET = process.env.OWNER_ADDRESS ?? ""; // your wallet: 0QBZLTG194NM_...

// Random beast generation data
const BEAST_TYPES = ['Dragon', 'Phoenix', 'Griffin', 'Hydra', 'Wyvern', 'Basilisk', 'Chimera', 'Manticore'];
const COLORS = ['Crimson', 'Azure', 'Golden', 'Emerald', 'Shadow', 'Crystal', 'Flame', 'Frost'];
const ELEMENTS = ['Fire', 'Ice', 'Lightning', 'Earth', 'Wind', 'Dark', 'Light', 'Poison'];
const TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomBeast() {
  const beastType = getRandomElement(BEAST_TYPES);
  const color = getRandomElement(COLORS);
  const element = getRandomElement(ELEMENTS);
  const tier = getRandomElement(TIERS);
  
  const name = `${color} ${beastType}`;
  const description = `A ${tier.toLowerCase()} ${element.toLowerCase()} beast with incredible power`;
  
  // Generate random stats based on tier
  const tierMultiplier = TIERS.indexOf(tier) + 1;
  const baseAttack = Math.floor(Math.random() * 50) + 30;
  const baseDefense = Math.floor(Math.random() * 50) + 30;
  const baseSpeed = Math.floor(Math.random() * 50) + 30;
  
  const traits = [
    { trait_type: "Attack", value: (baseAttack * tierMultiplier).toString() },
    { trait_type: "Defense", value: (baseDefense * tierMultiplier).toString() },
    { trait_type: "Speed", value: (baseSpeed * tierMultiplier).toString() },
    { trait_type: "Element", value: element },
    { trait_type: "Tier", value: tier },
  ];
  
  const prompt = `Create a high-detail pixel art ${color.toLowerCase()} ${beastType.toLowerCase()} with ${element.toLowerCase()} powers. Render a perfect, symmetric side view with detailed scales, vibrant ${color.toLowerCase()} colors, and ${element.toLowerCase()} effects in crisp pixel style. No background, clean lines, majestic ${tier.toLowerCase()} beast.`;
  
  return { name, description, traits, prompt };
}

async function bufferFromReplicateOutput(output: any): Promise<Buffer> {
  if (!output) throw new Error("No output from Replicate");

  // Handle new Replicate SDK format with url() method
  if (output.url && typeof output.url === "function") {
    const imageUrl = output.url();
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // Legacy handling for direct URL strings
  if (typeof output === "string") {
    const res = await fetch(output);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // Handle arrays
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") {
      const res = await fetch(first);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    if (first?.url && typeof first.url === "function") {
      const imageUrl = first.url();
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  }

  throw new Error("Could not interpret replicate output");
}

async function uploadBufferToPinata(buffer: Buffer, fileName: string) {
  // Convert buffer to a readable stream for pinata
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const options = {
    pinataMetadata: {
      name: fileName,
    },
    pinataOptions: {
      cidVersion: 1 as const,
    },
  };

  // pinFileToIPFS expects a stream or file
  const result = await pinata.pinFileToIPFS(stream as any, options);
  // result.IpfsHash contains the CID
  return result;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: "Missing REPLICATE_API_TOKEN" }, { status: 500 });
    }
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
      return NextResponse.json({ error: "Missing Pinata credentials" }, { status: 500 });
    }
    if (!GETGEMS_COLLECTION || !GETGEMS_AUTHORIZATION || !OWNER_WALLET) {
      return NextResponse.json({ error: "Missing GetGems or owner configuration" }, { status: 500 });
    }

    const body = await request.json();

    // Generate random beast (ignore user input for now)
    const randomBeast = generateRandomBeast();
    const { name, description, traits, prompt } = randomBeast;

    // --- 1) Generate image via Replicate ---
    // Example model: black-forest-labs/flux-1.1-pro (user mentioned). The model input shape can vary.
    // This example follows the earlier snippet: { prompt, prompt_upsampling: true }
    const replicateModel = body?.replicateModel ?? "black-forest-labs/flux-1.1-pro";

    const replicateInput = {
      prompt,
      prompt_upsampling: true,
      // add other model inputs if needed (width, height, steps) depending on model spec
    };

    // Run replicate model
    const output = await replicate.run(replicateModel, { input: replicateInput });

    // Convert output to buffer (handles URL or raw bytes)
    const imageBuffer = await bufferFromReplicateOutput(output);

    // --- 2) Upload image to Pinata ---
    const fileName = `${name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.jpg`;
    const pinFileResult = await uploadBufferToPinata(imageBuffer, fileName);
    const imageCid = pinFileResult.IpfsHash;
    const imageIpfsUri = `ipfs://${imageCid}`;

    // --- 3) Call GetGems mint endpoint ---
    const mintUrl = `${GETGEMS_BASE}/minting/${GETGEMS_COLLECTION}`;
    const mintBody = {
      requestId: Date.now().toString(),
      ownerAddress: OWNER_WALLET,
      name,
      description,
      image: imageIpfsUri,
      attributes: traits,
    };

    const mintRes = await fetch(mintUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: GETGEMS_AUTHORIZATION, // follow the example curl header
        "content-type": "application/json",
      },
      body: JSON.stringify(mintBody),
    });

    const mintText = await mintRes.text();
    let mintJson: any = null;
    try {
      mintJson = JSON.parse(mintText);
    } catch {
      mintJson = { raw: mintText };
    }

    if (!mintRes.ok) {
      console.error("GetGems mint failed:", {
        status: mintRes.status,
        statusText: mintRes.statusText,
        response: mintJson,
        requestBody: mintBody
      });
      return NextResponse.json(
        {
          success: false,
          error: `GetGems mint failed (${mintRes.status})`,
          details: mintJson,
          imageIpfsUri,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      name,
      description,
      traits,
      imageIpfsUri,
      mintResponse: mintJson,
    });
  } catch (error) {
    console.error("Route error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
