import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const POST = async (request: Request) => {
  try {
    return await handler.POST(request);
  } catch (error) {
    console.error("Better Auth API error:", error);
    throw error;
  }
};

export const GET = async (request: Request) => {
  try {
    return await handler.GET(request);
  } catch (error) {
    console.error("Better Auth API error:", error);
    throw error;
  }
};