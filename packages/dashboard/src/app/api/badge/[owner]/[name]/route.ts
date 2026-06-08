import { NextResponse } from "next/server";
import { getRepository } from "../../../../../lib/db";

interface BadgeRouteContext {
  params: Promise<{ owner: string; name: string }>;
}

/**
 * Returns shields.io endpoint JSON for one repository.
 * @param _request Incoming badge request.
 * @param context Dynamic repository route parameters.
 * @returns Shields.io-compatible JSON.
 */
export async function GET(
  _request: Request,
  context: BadgeRouteContext,
): Promise<NextResponse> {
  const { owner, name } = await context.params;
  const detail = getRepository(owner, name);
  if (detail === null) {
    return NextResponse.json({
      schemaVersion: 1,
      label: "docs tested",
      message: "not registered",
      color: "lightgrey",
    });
  }

  return NextResponse.json({
    schemaVersion: 1,
    label: "docs tested",
    message: `${detail.entry.passCount}/${detail.entry.passCount + detail.entry.failCount} passing`,
    color: detail.entry.badgeColor,
  });
}
