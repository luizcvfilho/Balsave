"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import { type SubmitEvent, useState } from "react";
import { SectionCard } from "../../components/cards/section-card";
import { formatDate, formatMoney, formatNumericDate, parseAmount } from "../../lib/format";
import { maxMoney, type SimulatorSources } from "./simulator-sources";
import styles from "./simulator.module.css";

type Scenario = { cost_cents: number; balance_cents: number; extra_cents: number };
type BreakEven = { status: "unique"; rate_bps: number } | { status: "any" | "none" | "outside_range" };
type Simulation = {
  ends_on: string;
  cash: Scenario;
  installments: Scenario;
  advantage_cents: number;
  break_even: BreakEven;
};

const rateFormat = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const rateInputFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function isSupportedRate(rateBps: number) {
  return Number.isInteger(rateBps) && rateBps >= -9_999 && rateBps <= 10_000;
}

function scenarioInput(form: HTMLFormElement, today: string, defaultDueOn: string, syncedCashCents: number | null) {
  const fields = new FormData(form);
  const text = (name: string) => String(fields.get(name) ?? "").trim();
  const money = (name: string) => {
    const value = text(name);
    return parseAmount(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value) ? value.replaceAll(".", "") : value);
  };
  const cash = money("cash");
  const installment = money("installment");
  const down = text("down") ? money("down") : 0;
  const initial = syncedCashCents ?? (text("initial") ? money("initial") : null);
  if (!cash || !installment || down === undefined || initial === undefined ||
      Math.max(cash, installment, down, initial ?? 0) > maxMoney) {
    return "Informe valores válidos em reais, até R$ 9.999.999,99. O preço à vista e o valor da parcela devem ser maiores que zero.";
  }
  const rate = text("rate");
  const magnitude = parseAmount(rate.replace(/^[+-]/, ""));
  const rateBps = magnitude === undefined ? NaN : rate.startsWith("-") ? -magnitude : magnitude;
  if (!isSupportedRate(rateBps)) {
    return "Informe uma taxa anual entre −99,99% e 100%, com até duas casas decimais.";
  }
  const count = Number(text("count"));
  if (!Number.isInteger(count) || count < 1 || count > 120) return "Informe de 1 a 120 parcelas.";
  const due = text("due") || defaultDueOn;
  const dueField = form.querySelector<HTMLInputElement>("input[name='due']");
  if (dueField?.validity.badInput || !/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today) {
    return "Escolha um vencimento a partir de hoje.";
  }

  return {
    cash_price_cents: cash,
    installment_cents: installment,
    down_payment_cents: down,
    initial_cash_cents: initial,
    installment_count: count,
    first_due_on: due,
    rate_bps: rateBps,
  };
}

function ScenarioSummary({ id, title, scenario }: { id: string; title: string; scenario: Scenario }) {
  return <SectionCard id={id} title={title}>
    <dl className={styles.figures}>
      <div><dt>Saldo final investido</dt><dd>{formatMoney(scenario.balance_cents)}</dd></div>
      <div><dt>Custo nominal</dt><dd>{formatMoney(scenario.cost_cents)}</dd></div>
      <div><dt>Aportes extras do orçamento</dt><dd>{formatMoney(scenario.extra_cents)}</dd></div>
    </dl>
  </SectionCard>;
}

function Results({ result }: { result: Simulation }) {
  const { advantage_cents: advantage, break_even: rate } = result;
  const breakEvenLabel = {
    any: "Os cenários se equivalem para qualquer taxa.",
    none: "Nenhuma taxa iguala os cenários.",
    outside_range: "A taxa de equilíbrio está fora do intervalo simulado.",
  };

  return <div className={styles.results}>
    <SectionCard id="resultado-simulacao" title="Resultado" highlighted>
      <p role="status" className={styles.outcome}>{advantage === 0 ? "Os dois cenários se equivalem." :
        `${advantage > 0 ? "Parcelar" : "Pagar à vista"} tem vantagem de ${formatMoney(Math.abs(advantage))}.`}</p>
      <p className="report-muted">Comparação em {formatDate(result.ends_on)}, incluindo o rendimento que os aportes extras teriam até essa data.</p>
      <dl className={styles.figures}>
        <div><dt>Taxa líquida anual de equilíbrio</dt><dd>{rate.status === "unique" ? rateFormat.format(rate.rate_bps / 10_000) : breakEvenLabel[rate.status]}</dd></div>
      </dl>
    </SectionCard>
    <div className="report-columns">
      <ScenarioSummary id="compra-a-vista" title="À vista" scenario={result.cash} />
      <ScenarioSummary id="compra-parcelada" title="Parcelado" scenario={result.installments} />
    </div>
  </div>;
}

export function PurchaseSimulator({ today, sources, demo }: { today: string; sources?: SimulatorSources; demo: boolean }) {
  const [result, setResult] = useState<Simulation>();
  const [error, setError] = useState<number | string>();
  const [pending, setPending] = useState(false);
  const [cashChoice, setCashChoice] = useState<string>();
  const [manualCash, setManualCash] = useState("");
  const [fundId, setFundId] = useState("");
  const [rateEdit, setRateEdit] = useState<string>();
  const bank = sources?.banks.find(({ bank }) => cashChoice === `bank:${bank}`);
  const totalCents = sources?.totalCents ?? null;
  const cashSource = bank ? `bank:${bank.bank}` : cashChoice === "manual" || totalCents === null ? "manual" : "total";
  const syncedCashCents = bank?.balanceCents ?? (cashSource === "total" ? totalCents : null);
  const fund = sources?.funds.find(({ id }) => id === fundId);
  const historicalRateBps = fund?.lastTwelveMonthsRateBps ?? null;
  const fundRateBps = historicalRateBps !== null && isSupportedRate(historicalRateBps) ? historicalRateBps : null;
  const rateValue = rateEdit ?? (fundRateBps === null ? "" : rateInputFormat.format(fundRateBps / 100));
  const defaultDueDate = new Date(today);
  defaultDueDate.setUTCMonth(defaultDueDate.getUTCMonth() + 1, 5);
  const defaultDueOn = defaultDueDate.toISOString().slice(0, 10);

  async function calculate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const payload = scenarioInput(event.currentTarget, today, defaultDueOn, syncedCashCents);
    setResult(undefined);
    if (typeof payload === "string") {
      setError(payload);
      return;
    }

    setError(undefined);
    setPending(true);
    try {
      const response = await fetch("/simulador/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) setResult(await response.json());
      else setError(response.status);
    } catch {
      setError(503);
    } finally {
      setPending(false);
    }
  }

  return <div className={styles.layout}>
    <SectionCard id="dados-da-compra" title="Dados da compra">
      {demo && <p className="report-muted">Saldos e fundos de demonstração.</p>}
      <form noValidate onSubmit={calculate} onInput={() => { setResult(undefined); setError(undefined); }}>
        <fieldset className={styles.fields} disabled={pending}>
          <label>Preço à vista (R$)<input name="cash" inputMode="decimal" maxLength={16} required /></label>
          <div className={styles.source}>
            <label htmlFor="origem-caixa">Origem do caixa inicial</label>
            <select id="origem-caixa" value={cashSource} onChange={event => setCashChoice(event.target.value)}
              aria-describedby="origem-caixa-ajuda">
              <option value="total" disabled={totalCents === null}>Saldo total</option>
              {sources?.banks.map(({ bank }) => <option key={bank} value={`bank:${bank}`}>{bank}</option>)}
              <option value="manual">Informar valor</option>
            </select>
            <small id="origem-caixa-ajuda" aria-live="polite">
              {syncedCashCents !== null && sources ? `${formatMoney(syncedCashCents)} · Saldo de ${formatDate(sources.asOf)}` :
                totalCents === null ? "Saldo total indisponível para a simulação." : ""}
            </small>
            {cashSource === "manual" && <label>Caixa inicial (R$)
              <input name="initial" inputMode="decimal" maxLength={16} aria-describedby="caixa-ajuda"
                value={manualCash} onChange={event => setManualCash(event.target.value)} />
              <small id="caixa-ajuda">Se vazio, usamos o preço à vista.</small>
            </label>}
          </div>
          <label>Entrada (R$)<input name="down" inputMode="decimal" maxLength={16} /><small>Opcional</small></label>
          <label>Valor da parcela (R$)<input name="installment" inputMode="decimal" maxLength={16} required /></label>
          <label>Número de parcelas<input name="count" type="number" min={1} max={120} step={1} required /></label>
          <label>Vencimento da primeira parcela
            <input name="due" type="date" min={today} aria-describedby="vencimento-ajuda" />
            <small id="vencimento-ajuda">Se vazio, usamos {formatNumericDate(defaultDueOn)}.</small>
          </label>
          {!!sources?.funds.length && <div className={`${styles.source} ${styles.rate}`}>
            <label htmlFor="fundo-simulador">Fundo de investimento</label>
            <select id="fundo-simulador" value={fund?.id ?? ""} onChange={event => {
              setFundId(event.target.value);
              setRateEdit(undefined);
            }}
              aria-describedby="fundo-ajuda">
              <option value="">Sem fundo selecionado</option>
              {sources.funds.map(({ id, name, bank }) => <option key={id} value={id}>{name} · {bank}</option>)}
            </select>
            <small id="fundo-ajuda" aria-live="polite">
              {!fund ? "Selecione um fundo para usar o histórico disponível." : historicalRateBps === null ?
                "Rentabilidade histórica indisponível para este fundo." :
                `Rentabilidade em 12 meses de ${rateFormat.format(historicalRateBps / 10_000)} · Posição de ${formatDate(fund.asOf)}`}
            </small>
          </div>}
          <label className={styles.rate}>Rendimento anual da simulação (%)
            <input name="rate" inputMode="decimal" maxLength={7} required aria-describedby="rendimento-ajuda"
              value={rateValue} onChange={event => setRateEdit(event.target.value)} />
            <small id="rendimento-ajuda">
              {!sources?.funds.length && "Nenhum fundo sincronizado disponível. "}
              {historicalRateBps !== null && fundRateBps === null && "O histórico está fora do intervalo da simulação. "}
              {rateEdit === undefined && fundRateBps !== null ?
                "Estimativa preenchida com o histórico do fundo. Ajuste se precisar descontar impostos e taxas." :
                "Informe sua estimativa anual já descontando impostos e taxas."}
            </small>
          </label>
        </fieldset>
        <Button type="submit" variant="contained" disabled={pending} sx={{ minHeight: 44 }}>
          {pending ? "Calculando…" : "Calcular"}
        </Button>
        {error && <p role="alert" className={styles.error}>{typeof error === "string" ? error :
          error === 422 ? "Revise os valores e escolha um vencimento entre hoje e os próximos 3.650 dias." :
          error === 401 ? <>Sua sessão expirou. <Link href="/acesso">Entre novamente</Link> para calcular.</> :
          "Não foi possível calcular agora. Tente novamente em instantes."}</p>}
      </form>
    </SectionCard>
    {result && <Results result={result} />}
  </div>;
}
