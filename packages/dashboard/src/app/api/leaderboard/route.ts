import { NextResponse } from "next/server";
import { z } from "zod";
import { listLeaderboard, registerRepositoryRun } from "../../../lib/db";

const writeSchema = z.object({
  owner: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
  repo: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
  stars: z.number().int().min(0),
  passCount: z.number().int().min(0),
  failCount: z.number().int().min(0),
  skipCount: z.number().int().min(0),
  lastRunAt: z.string().datetime(),
});

/**
 * Returns the current public leaderboard.
 * @returns JSON leaderboard response.
 */
export function GET(): NextResponse {
  return NextResponse.json({ entries: listLeaderboard() });
}

/**
 * Validates and stores one authenticated aggregate run.
 * @param request Incoming registration request.
 * @returns Stored entry or an actionable validation/auth error.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.LEADERBOARD_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret === undefined || authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized leaderboard write." },
      { status: 401 },
    );
  }

  try {
    const input = writeSchema.parse(await request.json());
    return NextResponse.json(
      { entry: registerRepositoryRun(input) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid leaderboard payload.",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 400 },
    );
  }
}
