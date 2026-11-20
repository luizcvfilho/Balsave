"use client";

import Slider from "@mui/material/Slider";
import { type PointerEvent, useState } from "react";
import { formatCompactMoney, formatMoney } from "../../lib/format";
import "./line-chart.css";

type Point = {
  axisLabel: string;
  label: string;
  values: (number | null)[];
};

type Series = { label: string; style: "actual" | "reference" };

type Props = {
  points: Point[];
  series: Series[];
  axisIndices: number[];
  initialIndex: number;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  axisLabel: string;
  zeroBased?: boolean;
  compareToReference?: boolean;
};

type Comparison = "above" | "below" | "equal";
type ComparedPoint = { x: number; y: number; difference: number };

function comparisonState(difference: number): Comparison {
  if (difference > 0) return "above";
  if (difference < 0) return "below";
  return "equal";
}

function comparisonSegments(points: (ComparedPoint | null)[]) {
  const paths: Record<Comparison, string[]> = { above: [], below: [], equal: [] };

  function addSegment(from: ComparedPoint, to: ComparedPoint, state: Comparison) {
    paths[state].push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`);
  }

  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;

    if (Math.sign(from.difference) * Math.sign(to.difference) < 0) {
      // Both lines are linear between observations, so their difference is linear too.
      const fraction = from.difference / (from.difference - to.difference);
      const crossing = {
        x: from.x + fraction * (to.x - from.x),
        y: from.y + fraction * (to.y - from.y),
        difference: 0,
      };
      addSegment(from, crossing, comparisonState(from.difference));
      addSegment(crossing, to, comparisonState(to.difference));
    } else {
      addSegment(from, to, comparisonState(from.difference || to.difference));
    }
  }

  return paths;
}

function comparisonLabel(difference: number) {
  if (difference === 0) return "Igual à média";
  const direction = difference > 0 ? "acima" : "abaixo";
  return `${formatMoney(Math.abs(difference))} ${direction} da média`;
}

function chartScale(values: number[], zeroBased: boolean) {
  const min = zeroBased ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const roughStep = Math.max((max - min) / 3, 100);
  const unit = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 5, 10].find(factor => factor * unit >= roughStep) ?? 10) * unit;
  const start = Math.floor(min / step) * step;
  const end = Math.max(start + step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: (end - start) / step + 1 }, (_, index) => start + index * step);
  return { start, end, ticks };
}

export function LineChart({
  points, series, axisIndices, initialIndex, selectedIndex: controlledIndex, axisLabel, onSelect,
  zeroBased = false, compareToReference = false,
}: Props) {
  const [localIndex, setSelectedIndex] = useState(initialIndex);
  const selectedIndex = controlledIndex ?? localIndex;
  const selected = points[selectedIndex];
  const lastIndex = points.length - 1;
  const values = points.flatMap(point => point.values.filter(value => value !== null));
  const { start, end, ticks } = chartScale(values, zeroBased);
  const x = (index: number) => index / Math.max(1, lastIndex) * 100;
  const y = (value: number) => (end - value) / (end - start) * 100;
  const actualIndex = series.findIndex(({ style }) => style === "actual");
  const referenceIndex = series.findIndex(({ style }) => style === "reference");

  function comparedPoint(point: Point, index: number) {
    const actual = point.values[actualIndex];
    const reference = point.values[referenceIndex];
    if (actual == null || reference == null) return null;
    return { x: x(index), y: y(actual), difference: actual - reference };
  }

  const comparisonPoints = compareToReference ? points.map(comparedPoint) : [];
  const selectedComparison = comparisonPoints[selectedIndex];
  const selectedState = selectedComparison ? ` chart-${comparisonState(selectedComparison.difference)}` : "";
  const selectedLabel = selectedComparison && comparisonLabel(selectedComparison.difference);

  function selectIndex(index: number) {
    if (controlledIndex === undefined) setSelectedIndex(index);
    onSelect?.(index);
  }

  function selectPoint(event: PointerEvent<HTMLDivElement>) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(1, Math.max(0, (event.clientX - left) / width));
    selectIndex(Math.round(relativeX * lastIndex));
  }

  function pointSummary(index: number) {
    const point = points[index];
    const amounts = series.map(({ label }, seriesIndex) => {
      const cents = point.values[seriesIndex];
      return `${label} ${cents === null ? "ainda sem dados" : formatMoney(cents)}`;
    }).join(", ");
    const comparison = comparisonPoints[index];
    const detail = comparison ? `. ${comparisonLabel(comparison.difference)}` : "";
    return `${point.label}. ${amounts}${detail}`;
  }

  return (
    <figure className="line-chart" aria-label={axisLabel}>
      <figcaption className="chart-readout" aria-live="polite" aria-atomic="true">
        <p className="chart-date">{selected.label}</p>
        <div className="chart-legend">
          {series.map(({ label, style }, index) => {
            const cents = selected.values[index];
            return (
              <div className="chart-legend-item" key={label}>
                <span className={`chart-key chart-${style}${style === "actual" ? selectedState : ""}`} aria-hidden="true" />
                <span>{label}</span>
                <strong>
                  {cents === null ? <><span aria-hidden="true">—</span><span className="sr-only">Ainda sem dados</span></> : formatMoney(cents)}
                </strong>
              </div>
            );
          })}
        </div>
        {compareToReference && <p className={`chart-comparison${selectedState}`}>{selectedLabel}</p>}
      </figcaption>

      <div className="chart-grid">
        <div className="chart-axis-y" aria-hidden="true">
          {ticks.map(value => <span key={value} style={{ top: `${y(value)}%` }}>{formatCompactMoney(value)}</span>)}
        </div>

        <div className="chart-plot" onPointerUp={selectPoint}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ticks.map(value => (
              <line key={value} className="chart-gridline" x1="0" x2="100" y1={y(value)} y2={y(value)} vectorEffect="non-scaling-stroke" />
            ))}
            <line className="chart-guide" x1={x(selectedIndex)} x2={x(selectedIndex)} y1="0" y2="100" vectorEffect="non-scaling-stroke" />
            {series.map(({ style }, seriesIndex) => {
              if (compareToReference && style === "actual") {
                return Object.entries(comparisonSegments(comparisonPoints)).map(([state, segments]) => (
                  segments.length > 0 && (
                    <path
                      key={state}
                      className={`chart-line chart-actual chart-${state}`}
                      d={segments.join(" ")}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                ));
              }

              const positions = points.flatMap(({ values: amounts }, index) => {
                const cents = amounts[seriesIndex];
                return cents === null ? [] : [`${x(index)},${y(cents)}`];
              });
              return (
                <polyline
                  key={style}
                  className={`chart-line chart-${style}`}
                  points={positions.join(" ")}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {series.map(({ style }, index) => {
            const cents = selected.values[index];
            return cents === null ? null : (
              <span
                className={`chart-dot chart-${style}${style === "actual" ? selectedState : ""}`}
                key={style}
                style={{ left: `${x(selectedIndex)}%`, top: `${y(cents)}%` }}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <div className="chart-axis-x" aria-hidden="true">
          {axisIndices.map((index, tickIndex) => (
            <span key={index} className={tickIndex % 2 === 1 && index !== lastIndex ? "chart-extra-tick" : undefined}
              style={{ left: `${x(index)}%` }}>
              {points[index].axisLabel}
            </span>
          ))}
        </div>
        <Slider
          min={0}
          max={lastIndex}
          step={1}
          color="secondary"
          value={selectedIndex}
          aria-label={axisLabel}
          getAriaValueText={pointSummary}
          onChange={(_, value) => selectIndex(value)}
          sx={{ gridColumn: 2, alignSelf: "center", minHeight: 44, boxSizing: "border-box" }}
        />
      </div>
    </figure>
  );
}
