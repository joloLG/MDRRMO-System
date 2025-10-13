import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const SEMAPHORE_OTP_URL = "https://api.semaphore.co/api/v4/otp";
const OTP_COOKIE_NAME = "semaphoreOtp";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const getApiKey = () => {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) {
    throw new Error("Semaphore API key is not configured");
  }
  return apiKey;
};

const getSenderName = () => process.env.SEMAPHORE_SENDER_NAME;

export async function POST(request: Request) {
  try {
    const { mobileNumber } = await request.json();

    if (typeof mobileNumber !== "string" || !/^\d{10}$/.test(mobileNumber)) {
      return NextResponse.json(
        { error: "A valid 10-digit mobile number is required." },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    const senderName = getSenderName();
    const fullNumber = `63${mobileNumber}`;
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const messageTemplate = "Your MDRRMO Emergency App OTP is: {otp}. Please use it within 5 minutes.";

    const body = new URLSearchParams({
      apikey: apiKey,
      number: fullNumber,
      message: messageTemplate,
      code: otpCode,
    });

    if (senderName) {
      body.append("sendername", senderName);
    }

    const response = await fetch(SEMAPHORE_OTP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = Array.isArray(data) && data.length > 0 && data[0]?.message
        ? data[0].message
        : data?.error || "Failed to send verification code.";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Unexpected response from Semaphore." }, { status: 502 });
    }

    const result = data[0];
    const messageId = String(result?.message_id ?? "");
    if (!messageId) {
      return NextResponse.json({ error: "Semaphore did not return a message ID." }, { status: 502 });
    }

    if (result.status && typeof result.status === "string" && result.status.toLowerCase() === "failed") {
      return NextResponse.json({ error: result?.message || "Failed to send verification code." }, { status: 400 });
    }

    const hash = crypto
      .createHash("sha256")
      .update(`${otpCode}:${messageId}`)
      .digest("hex");

    const cookiePayload = {
      hash,
      messageId,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
    };

    cookies().set({
      name: OTP_COOKIE_NAME,
      value: JSON.stringify(cookiePayload),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: OTP_EXPIRY_MS / 1000,
      path: "/",
    });

    return NextResponse.json({ messageId });
  } catch (error: any) {
    console.error("Semaphore OTP send error", error);
    const message = error?.message || "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
