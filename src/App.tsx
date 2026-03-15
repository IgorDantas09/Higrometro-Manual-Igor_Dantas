import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import {
  Play,
  RotateCcw,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  FileDown,
} from "lucide-react";

type Nozzle = {
  id: number;
  lpm: string;
};

type ResultRow = {
  bico: string;
  numeroBico: number;
  lpm: number;
  lha: number;
  alvo: number;
  alvoLpm: number;
  desvioAbs: number;
  desvioPct: number;
  status: "Fora" | "Ok";
  color: string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatBR = (value: unknown, digits = 2): string => {
  const numericValue = toNumber(value);
  return numericValue.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const buildNozzles = (count: number): Nozzle[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, lpm: "" }));

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0];
  const row = first?.payload as ResultRow | undefined;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        padding: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        color: "#000000",
        fontSize: 13,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Bico {String(label)}</div>
      <div>LPM coletado: {formatBR(row?.lpm, 3)}</div>
      <div>Vazão final: {formatBR(row?.lha, 2)} L/ha</div>
      <div>Desvio: {formatBR(row?.desvioPct, 2)}%</div>
      <div>Status: {row?.status ?? "-"}</div>
    </div>
  );
}

export default function App() {
  const [bloco, setBloco] = useState("");
  const [modelo, setModelo] = useState("");
  const [frota, setFrota] = useState("");
  const [velocidade, setVelocidade] = useState("6");
  const [espacamento, setEspacamento] = useState("0.5");
  const [vazaoAlvo, setVazaoAlvo] = useState("60");
  const [quantidadeBicos, setQuantidadeBicos] = useState("60");
  const [nozzles, setNozzles] = useState<Nozzle[]>(buildNozzles(60));
  const [executado, setExecutado] = useState(false);
  const [exportandoGrafico, setExportandoGrafico] = useState(false);
  const [exportandoTabela, setExportandoTabela] = useState(false);

  const graficoPdfRef = useRef<HTMLDivElement>(null);
  const tabelaPdfRef = useRef<HTMLDivElement>(null);

  const nozzleCount = Math.max(1, Math.floor(toNumber(quantidadeBicos)) || 1);
  const v = toNumber(velocidade);
  const esp = toNumber(espacamento);
  const alvoLha = toNumber(vazaoAlvo);

  const updateNozzleCount = () => {
    setNozzles((prev) => {
      const next = buildNozzles(nozzleCount);
      return next.map((item, idx) => ({
        ...item,
        lpm: prev[idx]?.lpm ?? "",
      }));
    });
  };

  const setLpm = (id: number, value: string) => {
    setNozzles((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, lpm: value.replace(",", ".") } : n
      )
    );
  };

  const results = useMemo(() => {
    const divisor = v * esp;
    const alvoLpm = divisor > 0 ? (alvoLha * divisor) / 600 : 0;
    const tolerancia = alvoLha * 0.1;

    const rows: ResultRow[] = nozzles.slice(0, nozzleCount).map((n) => {
      const lpm = toNumber(n.lpm);
      const lha = divisor > 0 ? (lpm * 600) / divisor : 0;
      const desvioAbs = lha - alvoLha;
      const desvioPct = alvoLha > 0 ? (desvioAbs / alvoLha) * 100 : 0;
      const fora = Math.abs(desvioAbs) > tolerancia;

      return {
        bico: `B${n.id}`,
        numeroBico: n.id,
        lpm,
        lha,
        alvo: alvoLha,
        alvoLpm,
        desvioAbs,
        desvioPct,
        status: fora ? "Fora" : "Ok",
        color: fora ? "#dc2626" : "#16a34a",
      };
    });

    const validRows = rows.filter((r) => r.lpm > 0);

    const mediaLha =
      validRows.length > 0
        ? validRows.reduce((acc, r) => acc + r.lha, 0) / validRows.length
        : 0;

    const dp =
      validRows.length > 1
        ? Math.sqrt(
            validRows.reduce((acc, r) => acc + (r.lha - mediaLha) ** 2, 0) /
              validRows.length
          )
        : 0;

    const cv = mediaLha > 0 ? (dp / mediaLha) * 100 : 0;
    const foraQtd = rows.filter((r) => r.status === "Fora").length;

    return {
      rows,
      alvoLpm,
      mediaLha,
      cv,
      foraQtd,
      okQtd: rows.length - foraQtd,
    };
  }, [nozzles, nozzleCount, v, esp, alvoLha]);

  const canRun = v > 0 && esp > 0 && alvoLha > 0 && nozzleCount > 0;

  const handleRun = () => {
    if (!canRun) return;
    setExecutado(true);
  };

  const handleReset = () => {
    setBloco("");
    setModelo("");
    setFrota("");
    setVelocidade("6");
    setEspacamento("0.5");
    setVazaoAlvo("60");
    setQuantidadeBicos("60");
    setNozzles(buildNozzles(60));
    setExecutado(false);
  };

  const exportarGraficoPDF = async () => {
    if (!graficoPdfRef.current) return;

    try {
      setExportandoGrafico(true);

      const canvas = await html2canvas(graficoPdfRef.current, {
        scale: 2.2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: graficoPdfRef.current.scrollWidth,
        windowHeight: graficoPdfRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;

      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = Math.min(usableWidth / imgWidth, usableHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      const x = (pageWidth - finalWidth) / 2;
      const y = (pageHeight - finalHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
      pdf.save(`grafico_validacao_${bloco || "sem_bloco"}.pdf`);
    } finally {
      setExportandoGrafico(false);
    }
  };

  const exportarTabelaPDF = async () => {
    if (!tabelaPdfRef.current) return;

    try {
      setExportandoTabela(true);

      const canvas = await html2canvas(tabelaPdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: tabelaPdfRef.current.scrollWidth,
        windowHeight: tabelaPdfRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= usableHeight;
      }

      pdf.save(`tabela_conferencia_${bloco || "sem_bloco"}.pdf`);
    } finally {
      setExportandoTabela(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#000000",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 8,
              color: "#000000",
            }}
          >
            Dashboard de Validação da Vazão
          </h1>
          <p style={{ color: "#000000", fontSize: 14 }}>
            Preencha os dados operacionais, informe o LPM de cada bico e gere a
            validação com gráfico, destaque visual e indicadores automáticos.
          </p>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={{ ...cardTitleStyle, textAlign: "center" }}>
              1. Entrada de dados
            </h2>
          </div>

          <div style={{ padding: 20 }}>
            <div style={grid4Style}>
              <Field
                label="Bloco"
                value={bloco}
                onChange={setBloco}
                placeholder="Ex.: BLOCO 04"
              />
              <Field
                label="Modelo da máquina"
                value={modelo}
                onChange={setModelo}
                placeholder="Ex.: 4030M"
              />
              <Field
                label="Frota da máquina"
                value={frota}
                onChange={setFrota}
                placeholder="Ex.: 16690"
              />

              <div>
                <label style={labelStyle}>Quantidade de bicos</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    value={quantidadeBicos}
                    onChange={(e) => setQuantidadeBicos(e.target.value)}
                  />
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={updateNozzleCount}
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              <Field
                label="Vazão alvo (L/ha)"
                type="number"
                step="0.01"
                value={vazaoAlvo}
                onChange={setVazaoAlvo}
              />
              <Field
                label="Velocidade (km/h)"
                type="number"
                step="0.01"
                value={velocidade}
                onChange={setVelocidade}
              />
              <Field
                label="Espaçamento entre bicos (m)"
                type="number"
                step="0.01"
                value={espacamento}
                onChange={setEspacamento}
              />
              <Field
                label="Litros por minuto alvo (calculado)"
                value={formatBR(results.alvoLpm, 3)}
                readOnly
              />
            </div>

            <div style={alertStyle}>
              <div style={{ fontSize: 14, color: "#000000", lineHeight: 1.6, textAlign: "center" }}>
                Fórmulas aplicadas no dashboard:
                <br />
                <strong>Litros por hectare = (LPM × 600) / (V × ESP)</strong>
                <br />
                <strong>
                  Litros por minuto alvo = (L/ha alvo × V × ESP) / 600
                </strong>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#000000",
                  }}
                >
                  LPM coletado de cada bico
                </h2>
                <span style={badgeSecondaryStyle}>{nozzleCount} bicos</span>
              </div>

              <div style={nozzleGridStyle}>
                {nozzles.slice(0, nozzleCount).map((n) => (
                  <div key={n.id} style={miniCardStyle}>
                    <label style={{ ...labelStyle, fontSize: 12, textAlign: "center" }}>
                      Bico {n.id}
                    </label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      placeholder="LPM"
                      value={n.lpm}
                      onChange={(e) => setLpm(n.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleRun}
                disabled={!canRun}
              >
                <Play size={16} />
                Gerar validação
              </button>

              <button
                type="button"
                style={outlineButtonStyle}
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                Limpar
              </button>
            </div>
          </div>
        </div>

        {executado && (
          <>
            <div
              ref={graficoPdfRef}
              style={{
                background: "#ffffff",
                padding: 12,
                color: "#000000",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={statsGridPdfStyle}>
                <StatCard
                  icon={<Gauge size={22} />}
                  iconBg="#eaf6ff"
                  iconColor="#0b74c9"
                  label="LPM alvo"
                  value={formatBR(results.alvoLpm, 3)}
                />
                <StatCard
                  icon={<CheckCircle2 size={22} />}
                  iconBg="#e9f9ee"
                  iconColor="#0a8f46"
                  label="Bicos dentro do alvo"
                  value={String(results.okQtd)}
                />
                <StatCard
                  icon={<AlertTriangle size={22} />}
                  iconBg="#ffeef0"
                  iconColor="#d61f45"
                  label="Bicos fora de ±10%"
                  value={String(results.foraQtd)}
                />
                <div style={pdfStatCardStyle}>
                  <div style={{ padding: 16 }}>
                    <p style={pdfStatLabelStyle}>CV da vazão final (%)</p>
                    <p style={pdfStatValueStyle}>{formatBR(results.cv, 2)}%</p>
                    <p style={pdfStatNoteStyle}>
                      Com base no L/ha calculado dos bicos preenchidos.
                    </p>
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <h2 style={{ ...cardTitleStyle, textAlign: "center" }}>
                    2. Gráfico de validação
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <span style={badgeBlueStyle}>Linha azul = alvo L/ha</span>
                    <span style={badgeGreenStyle}>
                      Barra verde = dentro do alvo
                    </span>
                    <span style={badgeRedStyle}>
                      Barra vermelha = fora de ±10%
                    </span>
                  </div>
                </div>

                <div style={{ padding: 20 }}>
                  <div
                    style={{
                      marginBottom: 16,
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                      gap: 12,
                      fontSize: 14,
                      color: "#000000",
                    }}
                  >
                    <div>
                      <strong>Bloco:</strong> {bloco || "-"}
                    </div>
                    <div>
                      <strong>Modelo:</strong> {modelo || "-"}
                    </div>
                    <div>
                      <strong>Frota:</strong> {frota || "-"}
                    </div>
                  </div>

                  <div style={{ width: "100%", height: 480 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={results.rows}
                        margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="numeroBico"
                          tick={{ fill: "#000000", fontSize: 12 }}
                          stroke="#000000"
                        />
                        <YAxis
                          tick={{ fill: "#000000", fontSize: 12 }}
                          stroke="#000000"
                          label={{
                            value: "Vazão final (L/ha)",
                            angle: -90,
                            position: "insideLeft",
                            style: { fill: "#000000", fontSize: 14 },
                          }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: "#000000", fontSize: 12 }} />
                        <ReferenceLine
                          y={alvoLha}
                          stroke="#2563eb"
                          strokeWidth={3}
                        />
                        <Bar
                          dataKey="lha"
                          name="Vazão final"
                          radius={[8, 8, 0, 0]}
                        >
                          {results.rows.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={exportarGraficoPDF}
                disabled={exportandoGrafico}
              >
                <FileDown size={16} />
                {exportandoGrafico
                  ? "Gerando PDF..."
                  : "Gerar PDF do gráfico"}
              </button>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <h2 style={cardTitleStyle}>3. Tabela de conferência</h2>
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={exportarTabelaPDF}
                    disabled={exportandoTabela}
                  >
                    <FileDown size={16} />
                    {exportandoTabela
                      ? "Gerando PDF..."
                      : "Gerar PDF da tabela"}
                  </button>
                </div>
              </div>

              <div style={{ padding: 20 }}>
                <div
                  ref={tabelaPdfRef}
                  style={{
                    background: "#fff",
                    padding: 8,
                    color: "#000000",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 16,
                      fontSize: 14,
                      color: "#000000",
                    }}
                  >
                    <div>
                      <strong>Bloco:</strong> {bloco || "-"}
                    </div>
                    <div>
                      <strong>Modelo:</strong> {modelo || "-"}
                    </div>
                    <div>
                      <strong>Frota:</strong> {frota || "-"}
                    </div>
                  </div>

                  <div
                    style={{
                      overflowX: "auto",
                      border: "1px solid #cbd5e1",
                      borderRadius: 16,
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                        color: "#000000",
                      }}
                    >
                      <thead style={{ background: "#e2e8f0" }}>
                        <tr>
                          <Th>Bico</Th>
                          <Th>LPM coletado</Th>
                          <Th>LPM alvo</Th>
                          <Th>Vazão final (L/ha)</Th>
                          <Th>Desvio (%)</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.rows.map((row) => (
                          <tr
                            key={row.numeroBico}
                            style={{ borderTop: "1px solid #e2e8f0" }}
                          >
                            <Td>{row.numeroBico}</Td>
                            <Td>{formatBR(row.lpm, 3)}</Td>
                            <Td>{formatBR(row.alvoLpm, 3)}</Td>
                            <Td>{formatBR(row.lha, 2)}</Td>
                            <Td>{formatBR(row.desvioPct, 2)}%</Td>
                            <Td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "6px 12px",
                                  borderRadius: 999,
                                  fontWeight: 700,
                                  color: "#ffffff",
                                  background:
                                    row.status === "Fora"
                                      ? "#dc2626"
                                      : "#16a34a",
                                }}
                              >
                                {row.status}
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div style={pdfStatCardStyle}>
      <div
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            padding: 10,
            borderRadius: 16,
            background: iconBg,
            color: iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={pdfStatLabelStyle}>{label}</p>
          <p style={pdfStatValueStyle}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px",
        fontWeight: 700,
        color: "#000000",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: "12px", color: "#000000" }}>{children}</td>;
}

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  marginBottom: 20,
};

const cardHeaderStyle: CSSProperties = {
  padding: 20,
  borderBottom: "1px solid #e2e8f0",
};

const cardTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  color: "#000000",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
  color: "#000000",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  color: "#000000",
  background: "#ffffff",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#0f172a",
  color: "#ffffff",
  border: "none",
  borderRadius: 16,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#e2e8f0",
  color: "#000000",
  border: "none",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#ffffff",
  color: "#000000",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const alertStyle: CSSProperties = {
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  borderRadius: 20,
  padding: 16,
  marginTop: 20,
};

const badgeSecondaryStyle: CSSProperties = {
  display: "inline-block",
  background: "#e2e8f0",
  color: "#000000",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 700,
};

const badgeBlueStyle: CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
};

const badgeGreenStyle: CSSProperties = {
  display: "inline-block",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
};

const badgeRedStyle: CSSProperties = {
  display: "inline-block",
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
};

const grid4Style: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const nozzleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 14,
};

const miniCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  background: "#ffffff",
};

const statsGridPdfStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 18,
  width: "100%",
};

const pdfStatCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  minWidth: 0,
};

const pdfStatLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#000000",
  margin: 0,
  lineHeight: 1.2,
  fontWeight: 600,
};

const pdfStatValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#000000",
  margin: "6px 0 0 0",
  lineHeight: 1.1,
};

const pdfStatNoteStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#000000",
  lineHeight: 1.25,
};
