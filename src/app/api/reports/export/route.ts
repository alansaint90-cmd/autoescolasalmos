import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/services/permission-service";
import { createPdfBuffer, queryCommercialMetrics } from "@/lib/services/report-query-service";

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "exportPdf");

    const body = await request.json().catch(() => ({})) as {
      start?: string;
      end?: string;
      origin?: string;
      seller?: string;
    };

    const metrics = await queryCommercialMetrics({
      start: parseDate(body.start),
      end: parseDate(body.end),
      origin: body.origin && body.origin !== "Todas" ? body.origin : null,
      seller: body.seller && body.seller !== "Todos" ? body.seller : null,
      limit: 500
    });

    const startLabel = body.start?.slice(0, 10) ?? "inicio";
    const endLabel = body.end?.slice(0, 10) ?? "fim";
    const lines = [
      "AUTO PRO IA",
      "Relatorio comercial",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `Periodo: ${startLabel} ate ${endLabel}`,
      `Vendedor: ${body.seller || "Todos"}`,
      `Origem: ${body.origin || "Todas"}`,
      "",
      "Resumo",
      `Leads captados: ${metrics.summary.totalLeads}`,
      `Matriculas: ${metrics.summary.enrollments}`,
      `Conversao: ${metrics.summary.conversion}%`,
      `Receita estimada: ${metrics.stats.vendasMes}`,
      `Ticket medio: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(metrics.summary.averageTicket)}`,
      `IA atendendo: ${metrics.summary.aiHandled}`,
      `Tempo medio de resposta: ${metrics.summary.responseTime}`,
      "",
      "Ranking por vendedor",
      ...(metrics.sellerClosing.length
        ? metrics.sellerClosing.map((row) => `${row.position}. ${row.seller} - ${row.closed} fechamentos - ${row.conversion}% - ${row.revenue}`)
        : ["Aguardando dados reais."]),
      "",
      "Leads por origem",
      ...(metrics.leadsByOrigin.length
        ? metrics.leadsByOrigin.map((item) => `${item.label}: ${item.value} leads (${item.percent}%)`)
        : ["Aguardando dados reais."]),
      "",
      "Funil operacional",
      ...(metrics.funnelData.length
        ? metrics.funnelData.map((item) => `${item.etapa}: ${item.value} leads`)
        : ["Aguardando dados reais."]),
      "",
      "Desempenho da IA",
      ...metrics.aiPerformance.map((item) => `${item.metric}: ${item.value}% - ${item.detail}`),
      "",
      "Motivos de perda",
      ...(metrics.lossReasons.length
        ? metrics.lossReasons.map((item) => `${item.label}: ${item.value}%`)
        : ["Aguardando dados reais."])
    ];

    const pdf = createPdfBuffer(lines);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-auto-pro-ia-${startLabel}-a-${endLabel}.pdf"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seu usuario nao tem permissao para gerar PDF." },
      { status: 403 }
    );
  }
}
