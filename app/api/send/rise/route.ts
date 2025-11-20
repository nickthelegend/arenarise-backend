import { NextRequest, NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, beginCell, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

export async function POST(request: NextRequest) {
  try {
    console.log("=== RISE JETTON TRANSFER START ===");
    
    const body = await request.json();
    const { userWallet, amount } = body;
    
    console.log("Request body:", { userWallet, amount });

    if (!userWallet) {
      console.log("ERROR: Missing userWallet parameter");
      return NextResponse.json(
        { error: "userWallet is required" },
        { status: 400 }
      );
    }

    // Default send 1 RISE
    const jettonAmount = BigInt(amount ?? 1) * BigInt(Math.pow(10, 9));
    console.log("Jetton amount:", jettonAmount.toString(), "nano-RISE");

    // -------- Load Owner Mnemonic --------
    const MNEMONIC = process.env.OWNER_MNEMONIC?.split(" ");
    console.log("Mnemonic loaded:", MNEMONIC ? `${MNEMONIC.length} words` : "NOT FOUND");
    
    if (!MNEMONIC || MNEMONIC.length < 12)
      throw new Error("OWNER_MNEMONIC missing or invalid");

    const keyPair = await mnemonicToPrivateKey(MNEMONIC);
    console.log("Key pair generated successfully");

    // -------- TON RPC Client --------
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY || "",
    });
    console.log("TON client initialized");

    // -------- Owner Main Wallet (signs tx) --------
    const mainWallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });
    console.log("Wallet address:", mainWallet.address.toString());

    const contract = client.open(mainWallet);
    const seqno = await contract.getSeqno();
    console.log("Current seqno:", seqno);

    // -------- Your Jetton Wallet (receiver of internal msg) --------
    const JETTON_WALLET = "kQDt1cugwBboev3AnobpMQOmuOLGj05e4_5NbUSMfq1sefoi";
    const jettonWalletAddress = Address.parse(JETTON_WALLET);
    console.log("Jetton wallet address:", jettonWalletAddress.toString());

    // -------- Build Jetton Transfer Payload --------
    console.log("Building jetton transfer payload...");
    const payload = beginCell()
      .storeUint(0xf8a7ea5, 32)                // jetton transfer op
      .storeUint(0, 64)                       // query_id
      .storeCoins(jettonAmount)               // jetton amount
      .storeAddress(Address.parse(userWallet))// recipient
      .storeAddress(mainWallet.address)       // response destination
      .storeBit(false)                        // no custom payload
      .storeCoins(0)                          // fwd_amount
      .storeBit(false)                        // no fwd_payload
      .endCell();
    console.log("Jetton transfer payload created");

    // -------- INTERNAL MESSAGE (main wallet → jetton wallet) --------
    const internalMessage = internal({
      to: jettonWalletAddress,
      value: "0.05", // must pay jetton-wallet gas fee
      body: payload,
      bounce: true,
    });
    console.log("Internal message prepared:", {
      to: jettonWalletAddress.toString(),
      value: "0.05 TON",
      bounce: true
    });

    // -------- SIGN + SEND --------
    console.log("Sending jetton transfer transaction...");
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [internalMessage]
    });
    console.log("Transaction sent successfully!");

    const result = {
      success: true,
      message: "RISE jetton sent!",
      fromWallet: mainWallet.address.toString(),
      toWallet: userWallet,
      jettonAmount: jettonAmount.toString(),
      seqno,
    };
    
    console.log("=== RISE JETTON TRANSFER SUCCESS ===", result);
    return NextResponse.json(result);

  } catch (err: any) {
    console.error("JETTON ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}