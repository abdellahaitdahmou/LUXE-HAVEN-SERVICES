import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAuthorizedPropertyDetail } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const detail = await getAuthorizedPropertyDetail(id);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const publicStayUrl = `${origin}/stay/${detail.property.slug}`;

    const format = req.nextUrl.searchParams.get("format") || "png";

    if (format === "svg") {
      const svg = await QRCode.toString(publicStayUrl, {
        type: "svg",
        margin: 2,
        width: 512,
        color: {
          dark: "#1E1B18",
          light: "#FAF6F0",
        },
      });
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="luxe-haven-${detail.property.slug}-qr.svg"`,
        },
      });
    }

    const pngBuffer = await QRCode.toBuffer(publicStayUrl, {
      type: "png",
      margin: 2,
      width: 600,
      color: {
        dark: "#1E1B18",
        light: "#FAF6F0",
      },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="luxe-haven-${detail.property.slug}-qr.png"`,
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to generate QR code.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
