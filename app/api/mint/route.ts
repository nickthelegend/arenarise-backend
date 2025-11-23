// /app/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import pinataSDK from "@pinata/sdk";
import { Readable } from "stream";
import { supabase } from "../../../lib/supabase";

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
const BEAST_TYPES = ['Dragon', 'Phoenix', 'Griffin', 'Hydra', 'Wyvern', 'Basilisk', 'Chimera', 'Manticore', 'Sphinx', 'Kraken', 'Leviathan', 'Behemoth', 'Gargoyle', 'Pegasus', 'Unicorn', 'Cerberus', 'Minotaur', 'Banshee'];
const COLORS = ['Crimson', 'Azure', 'Golden', 'Emerald', 'Shadow', 'Crystal', 'Flame', 'Frost', 'Obsidian', 'Silver', 'Violet', 'Copper', 'Jade', 'Ruby', 'Sapphire', 'Onyx', 'Pearl', 'Amber'];
const ELEMENTS = ['Fire', 'Ice', 'Lightning', 'Earth', 'Wind', 'Dark', 'Light', 'Poison', 'Arcane', 'Nature', 'Void', 'Spirit', 'Blood', 'Celestial', 'Infernal', 'Temporal'];
const TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const ADJECTIVES = ['Ancient', 'Fierce', 'Majestic', 'Ethereal', 'Primal', 'Divine', 'Cursed', 'Noble', 'Savage', 'Mystical', 'Eternal', 'Wrathful'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomBeast() {
  const beastType = getRandomElement(BEAST_TYPES);
  const color = getRandomElement(COLORS);
  const element = getRandomElement(ELEMENTS);
  const tier = getRandomElement(TIERS);
  const adjective = getRandomElement(ADJECTIVES);
  
  // More varied naming patterns
  const namePatterns = [
    `${color} ${beastType}`,
    `${adjective} ${beastType}`,
    `${element} ${beastType}`,
    `${color} ${adjective} ${beastType}`,
    `${beastType} of ${element}`,
  ];
  const name = getRandomElement(namePatterns);
  
  const descriptions = [
    `A ${tier.toLowerCase()} ${element.toLowerCase()} beast with incredible power`,
    `An ${adjective.toLowerCase()} creature wielding ${element.toLowerCase()} magic`,
    `A legendary ${beastType.toLowerCase()} infused with ${element.toLowerCase()} energy`,
    `A ${tier.toLowerCase()} guardian blessed with ${element.toLowerCase()} abilities`,
    `A ${color.toLowerCase()} ${beastType.toLowerCase()} of ${tier.toLowerCase()} rarity`,
  ];
  const description = getRandomElement(descriptions);
  
  // Generate random stats based on tier with more variation
  const tierMultipliers = { Common: 0.8, Rare: 1.0, Epic: 1.3, Legendary: 1.6, Mythic: 2.0 };
  const multiplier = tierMultipliers[tier as keyof typeof tierMultipliers] || 1.0;
  
  const baseAttack = Math.floor((Math.random() * 60 + 40) * multiplier);
  const baseDefense = Math.floor((Math.random() * 60 + 40) * multiplier);
  const baseSpeed = Math.floor((Math.random() * 60 + 40) * multiplier);
  
  const traits = [
    { trait_type: "Attack", value: baseAttack.toString() },
    { trait_type: "Defense", value: baseDefense.toString() },
    { trait_type: "Speed", value: baseSpeed.toString() },
    { trait_type: "Element", value: element },
    { trait_type: "Tier", value: tier },
    { trait_type: "Type", value: beastType },
  ];
  
  // More dynamic and varied prompts
  const promptStyles = [
    `Create a high-detail pixel art ${color.toLowerCase()} ${beastType.toLowerCase()} with ${element.toLowerCase()} powers. Perfect side view, detailed textures, vibrant colors, ${element.toLowerCase()} aura effects. No background, crisp pixel style.`,
    `Render an ${adjective.toLowerCase()} ${beastType.toLowerCase()} in pixel art style. ${color} coloring with ${element.toLowerCase()} elemental magic. Side profile view, intricate details, glowing ${element.toLowerCase()} effects. Clean background.`,
    `Pixel art ${tier.toLowerCase()} ${beastType.toLowerCase()}: ${color.toLowerCase()} scales/fur with ${element.toLowerCase()} energy. Majestic side view, detailed anatomy, ${element.toLowerCase()} magical aura. High contrast, no background.`,
    `Design a ${color.toLowerCase()} ${beastType.toLowerCase()} wielding ${element.toLowerCase()} power. Pixel art style, symmetric side view, detailed features, ${element.toLowerCase()} elemental effects. ${tier} tier beast, clean composition.`,
  ];
  const prompt = getRandomElement(promptStyles);
  
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

    // Store in Supabase database
    const { error: dbError } = await supabase
      .from('beasts')
      .insert({
        request_id: mintBody.requestId,
        name,
        description,
        image_ipfs_uri: imageIpfsUri,
        owner_address: OWNER_WALLET,
        status: 'in_queue',
        traits,
        nft_address: mintJson.response?.address || null,
        nft_index: mintJson.response?.index || null,
        getgems_url: mintJson.response?.url || null,
      });

    if (dbError) {
      console.error('Database insert error:', dbError);
    }

    return NextResponse.json({
      success: true,
      requestId: mintBody.requestId,
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
