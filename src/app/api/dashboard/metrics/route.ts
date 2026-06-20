import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { triggerDueFollowUpsInBackground } from "@/lib/services/follow-up-service";
import { canRole } from "@/lib/services/permission-service";
import { getDashboardPeriod, queryCommercialMetrics } from "@/lib/services/report-query-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const canViewDashboard = await canRole(session.role, "viewTeamReports")
      || await canRole(session.role, "viewOwnReports")
      || await canRole(session.role, "viewLeads");

    if (!canViewDashboard) {
      return NextResponse.json({ error: "Sem permissao para visualizar metricas." }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado." },
      { status: 401 }
    );
  }

  try {
    triggerDueFollowUpsInBackground({ source: "dashboard-metrics", limit: 10 });

    const period = getDashboardPeriod(request.nextUrl.searchParams.get("period"));
    const metrics = await queryCommercialMetrics({
      start: period.start,
      end: period.end,
      limit: 500
    });

    return NextResponse.json({
      ok: true,
      period: {
        label: period.label,
        start: period.start?.toISOString() ?? null,
        end: period.end?.toISOString() ?? null
      },
      updatedAt: new Date().toISOString(),
      stats: metrics.stats,
      thermometer: metrics.thermometer,
      leadsByOrigin: metrics.leadsByOrigin,
      sellerClosing: metrics.sellerClosing,
      funnelData: metrics.funnelData,
      aiPerformance: metrics.aiPerformance,
      monthlyConversion: metrics.monthlyConversion,
      commercialPulse: metrics.commercialPulse
    });
  } catch (error) {
    console.error("[dashboard-metrics] failed to load real metrics", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nao foi possivel carregar metricas reais."
      },
      { status: 500 }
    );
  }
}
