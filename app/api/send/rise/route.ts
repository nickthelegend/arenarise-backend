import { NextRequest, NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, beginCell, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWallet, amount } = body;

    if (!userWallet) {
      return NextResponse.json(
        { error: "userWallet is required" },
        { status: 400 }
      );
    }

    // Default send 1 RISE
    const jettonAmount = BigInt(amount ?? 1) * BigInt(Math.pow(10, 9));

    // -------- Load Owner Mnemonic --------
    const MNEMONIC = process.env.OWNER_MNEMONIC?.split(" ");
    if (!MNEMONIC || MNEMONIC.length < 12)
      throw new Error("OWNER_MNEMONIC missing or invalid");

    const keyPair = await mnemonicToPrivateKey(MNEMONIC);

    // -------- TON RPC Client --------
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY || "",
    });

    // -------- Owner Main Wallet (signs tx) --------
    const mainWallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    const contract = client.open(mainWallet);
    const seqno = await contract.getSeqno();

    // -------- Your Jetton Wallet (receiver of internal msg) --------
    const JETTON_WALLET = "kQDt1cugwBboev3AnobpMQOmuOLGj05e4_5NbUSMfq1sefoi";
    const jettonWalletAddress = Address.parse(JETTON_WALLET);

    // -------- Build Jetton Transfer Payload --------
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

    // -------- INTERNAL MESSAGE (main wallet → jetton wallet) --------
    const internalMessage = internal({
      to: jettonWalletAddress,
      value: "0.05", // must pay jetton-wallet gas fee
      body: payload,
      bounce: true,
    });

    // -------- SIGN + SEND --------
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [internalMessage]
    });

    return NextResponse.json({
      success: true,
      message: "RISE jetton sent!",
      fromWallet: mainWallet.address.toString(),
      toWallet: userWallet,
      jettonAmount: jettonAmount.toString(),
    });

  } catch (err: any) {
    console.error("JETTON ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}