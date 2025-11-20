import { NextRequest, NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, beginCell, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

export async function POST(request: NextRequest) {
  try {
    console.log("=== NFT TRANSFER REQUEST START ===");
    
    const body = await request.json();
    const { toAddress, nftAddress } = body;
    
    console.log("Request body:", { toAddress, nftAddress });

    if (!toAddress || !nftAddress) {
      console.log("ERROR: Missing required parameters");
      return NextResponse.json(
        { error: "Missing toAddress or nftAddress" },
        { status: 400 }
      );
    }

    // -------- ENV: OWNER SEED / PRIVATE KEY --------
    const MNEMONIC = process.env.OWNER_MNEMONIC?.split(" ");
    console.log("Mnemonic loaded:", MNEMONIC ? `${MNEMONIC.length} words` : "NOT FOUND");
    
    if (!MNEMONIC || MNEMONIC.length < 12)
      throw new Error("OWNER_MNEMONIC is missing or invalid");

    // derive key
    const keyPair = await mnemonicToPrivateKey(MNEMONIC);
    console.log("Key pair generated successfully");

    // -------- RPC CLIENT --------
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY || "",
    });
    console.log("TON client initialized");

    // -------- LOAD WALLET CONTRACT --------
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    const walletAddress = wallet.address;
    console.log("Wallet address:", walletAddress.toString());
    
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    console.log("Current seqno:", seqno);
    
    // Check wallet balance
    const balance = await contract.getBalance();
    console.log("Wallet balance:", balance.toString(), "nanoTON");
    console.log("Wallet balance:", (Number(balance) / 1e9).toFixed(4), "TON");
    
    if (Number(balance) < 100000000) { // Less than 0.1 TON
      throw new Error(`Insufficient wallet balance: ${(Number(balance) / 1e9).toFixed(4)} TON`);
    }

    // -------- BUILD NFT TRANSFER BODY (TIP-004) --------
    console.log("Building NFT transfer message...");
    const nftTransfer = beginCell()
      .storeUint(0x5fcc3d14, 32) // transfer op
      .storeUint(0, 64) // query_id
      .storeAddress(Address.parse(toAddress)) // new owner
      .storeAddress(null) // response destination
      .storeCoins(0) // forward_amount
      .storeBit(false) // no forward_payload
      .endCell();
    console.log("NFT transfer body created");

    // -------- PREPARE INTERNAL MESSAGE --------
    const msg = internal({
      to: Address.parse(nftAddress),
      value: "0.1", // increased gas for NFT transfer
      body: nftTransfer,
      bounce: false,
    });
    console.log("Internal message prepared:", {
      to: nftAddress,
      value: "0.1 TON",
      bounce: false
    });

    // -------- SEND TRANSACTION --------
    console.log("Sending transaction...");
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [msg]
    });
    console.log("Transaction sent successfully!");

    const result = {
      success: true,
      message: "NFT transfer submitted!",
      fromWallet: walletAddress.toString(),
      toAddress,
      nftAddress,
      seqno,
    };
    
    console.log("=== NFT TRANSFER SUCCESS ===", result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("SEND ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}