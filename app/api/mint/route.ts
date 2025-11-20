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

// Default base prompt (user-provided)
const BASE_PROMPT =
  'Create a high-detail pixel art dragon with no background. Render a perfect, symmetric side view of the entire dragon, showcasing its elongated body, detailed scales, and vibrant colors in crisp pixel style. The image should capture the dragon in full profile with clean lines and a balanced composition, emphasizing its majestic form without any additional elements.';

async function bufferFromReplicateOutput(output: any): Promise<Buffer> {
  // Many replicate model runs return a URL string (or an array with a URL).
  // If output is a URL, fetch it; if it's a Buffer/Uint8Array return it.
  if (!output) throw new Error("No output from Replicate");

  // If replicate returns an array like [{...}, ...] try to extract URL
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") {
      const res = await fetch(first);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    // if it's an object with a url property
    if (first?.url && typeof first.url === "string") {
      const res = await fetch(first.url);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  }

  if (typeof output === "string") {
    // treat as URL
    const res = await fetch(output);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // If replicate returned raw bytes (rare), handle Uint8Array
  if (output instanceof Uint8Array || (output?.data && output.data instanceof Uint8Array)) {
    return Buffer.from(output instanceof Uint8Array ? output : output.data);
  }

  // fallback: try JSON -> url
  if (output?.url) {
    const res = await fetch(output.url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
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

async function pinMetadata(metadata: Record<string, any>) {
  const result = await pinata.pinJSONToIPFS(metadata, {
    pinataMetadata: {
      name: metadata.name ?? "nft-metadata",
    },
    pinataOptions: {
      cidVersion: 1 as const,
    },
  });
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

    // Accept optional inputs, otherwise use defaults
    const customPrompt = typeof body?.prompt === "string" ? body.prompt : "";
    const prompt = `${BASE_PROMPT} ${customPrompt}`.trim();

    const name = body?.name ?? `Beast #${Date.now()}`;
    const description = body?.description ?? "A procedurally generated beast";
    // traits either provided or default provided set
    const traits = body?.traits ?? [
      { trait_type: "Attack", value: 120, display_type: "number" },
      { trait_type: "Defense", value: 80, display_type: "number" },
      { trait_type: "Speed", value: 65, display_type: "number" },
      { trait_type: "Tier", value: "Legendary" },
    ];

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

    // --- 3) Pin metadata JSON that includes the ipfs image link and attributes ---
    const metadata = {
      name,
      description,
      image: imageIpfsUri,
      attributes: traits,
    };

    const pinMetadataResult = await pinMetadata(metadata);
    const metadataCid = pinMetadataResult.IpfsHash;
    const metadataIpfsUri = `ipfs://${metadataCid}`;

    // --- 4) Call GetGems mint endpoint ---
    const mintUrl = `${GETGEMS_BASE}/minting/${GETGEMS_COLLECTION}`;
    const mintBody = {
      requestId: Date.now().toString(),
      ownerAddress: OWNER_WALLET,
      name,
      description,
      image: metadataIpfsUri, // send metadata or image url depending on GetGems expectation; sending metadata is common
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
      return NextResponse.json(
        {
          success: false,
          error: `GetGems mint failed (${mintRes.status})`,
          details: mintJson,
          imageIpfsUri,
          metadataIpfsUri,
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
      metadataIpfsUri,
      mintResponse: mintJson,
    });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
