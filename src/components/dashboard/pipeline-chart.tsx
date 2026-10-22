"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ApplicationStatus } from "@/lib/schema/application";
import { APPLICATION_STATUS_LABELS } from "@/lib/schema/application";
import { pipelineBreakdown } from "@/lib/demo/demo-data";
import type { Application } from "@/lib/schema/application";

const COLORS: Record<ApplicationStatus, string> = {
  brouillon: "#BBA8B5",
  a_envoyer: "#BBA6D9",
  envoyee: "#9B8AC4",
  en_attente: "#E7C4D3",
  entretien: "#D98AA8",
  offre_recue: "#9BC4A8",
  acceptee: "#7FB894",
  refusee: "#D98A8A",
  abandonnee: "#6E5A68",
};

interface PipelineChartProps {
  applications: Application[];
}

export function PipelineChart({ applications }: PipelineChartProps) {
  const data = pipelineBreakdown(applications);
  const total = applications.length;

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-subtle bg-background/40">
        <p className="text-sm text-secondary">Aucune candidature pour le moment</p>
      </div>
    );
  }

  return (
    <div className="h-48 w-full" role="img" aria-label="Répartition des candidatures par statut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius={52}
            outerRadius={76}
            paddingAngle={2}
            stroke="rgba(235, 205, 222, 0.10)"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#2B1E2C",
              border: "1px solid rgba(235, 205, 222, 0.16)",
              borderRadius: "12px",
              color: "#F8EDF2",
              fontSize: "12px",
            }}
            formatter={(value, name) => [
              `${value} candidature${Number(value) > 1 ? "s" : ""}`,
              APPLICATION_STATUS_LABELS[name as ApplicationStatus],
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
