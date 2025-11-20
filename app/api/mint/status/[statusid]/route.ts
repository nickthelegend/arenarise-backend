import { NextRequest, NextResponse } from "next/server";

const GETGEMS_BASE = process.env.GETGEMS_BASE ?? "https://api.testnet.getgems.io/public-api";
const GETGEMS_COLLECTION = process.env.GETGEMS_COLLECTION ?? "";
const GETGEMS_AUTHORIZATION = process.env.GETGEMS_AUTHORIZATION ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: { statusid: string } }
) {
  try {
    if (!GETGEMS_COLLECTION || !GETGEMS_AUTHORIZATION) {
      return NextResponse.json({ error: "Missing GetGems configuration" }, { status: 500 });
    }

    const requestId = params.statusid;
    
    if (!requestId) {
      return NextResponse.json({ error: "Missing request ID" }, { status: 400 });
    }

    // Check status with GetGems API
    const statusUrl = `${GETGEMS_BASE}/minting/${GETGEMS_COLLECTION}/${requestId}`;
    
    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: GETGEMS_AUTHORIZATION,
      },
    });

    const statusText = await statusRes.text();
    let statusJson: any = null;
    try {
      statusJson = JSON.parse(statusText);
    } catch {
      statusJson = { raw: statusText };
    }

    if (!statusRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `GetGems status check failed (${statusRes.status})`,
          details: statusJson,
        },
        { status: statusRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      ...statusJson,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}