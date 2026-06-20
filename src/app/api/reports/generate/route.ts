import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/services/permission-service";
import { queryCommercialMetrics } from "@/lib/services/report-query-service";

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "viewTeamReports");

    const body = await request.json().catch(() => ({})) as {
      start?: string;
      end?: string;
      origin?: string;
      seller?: string;
      limit?: number;
    };

    const metrics = await queryCommercialMetrics({
      start: parseDate(body.start),
      end: parseDate(body.end),
      origin: body.origin && body.origin !== "Todas" ? body.origin : null,
      seller: body.seller && body.seller !== "Todos" ? body.seller : null,
      limit: body.limit ?? 500
    });

    return NextResponse.json({
      ok: true,
      leads: metrics.leads,
      analytics: metrics.analytics,
      count: metrics.leads.length,
      summary: metrics.summary,
      origins: metrics.leadsByOrigin,
      sellers: metrics.sellerClosing,
      funnelData: metrics.funnelData,
      aiPerformance: metrics.aiPerformance,
      monthlyReport: metrics.monthlyReport,
      campaignConversion: metrics.campaignConversion,
      lossReasons: metrics.lossReasons,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel gerar o relatorio." },
      { status: 403 }
    );
  }
}
