import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/lib/theme';

export interface Point {
  x: number;
  y: number;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return [width, (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)] as const;
}

const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

/** Simple line chart. `formatX` labels the first/last points. */
export function LineChart({
  data,
  height = 180,
  color = colors.primary,
  formatX,
  formatY = (v) => String(Math.round(v)),
}: {
  data: Point[];
  height?: number;
  color?: string;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
}) {
  const [width, onLayout] = useWidth();
  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }
  const xs = data.map((p) => p.x);
  const ys = data.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
  const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={colors.border} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={PAD.left - 6} y={sy(t) + 4} fill={colors.muted} fontSize={10} textAnchor="end">
              {formatY(t)}
            </SvgText>
          ))}
          <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {data.length <= 40 &&
            data.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={color} />)}
          {formatX && (
            <>
              <SvgText x={PAD.left} y={height - 6} fill={colors.muted} fontSize={10} textAnchor="start">
                {formatX(xMin)}
              </SvgText>
              {xMax !== xMin && (
                <SvgText x={width - PAD.right} y={height - 6} fill={colors.muted} fontSize={10} textAnchor="end">
                  {formatX(xMax)}
                </SvgText>
              )}
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

/** Vertical bar chart with a label under each bar. */
export function BarChart({
  data,
  height = 160,
  color = colors.primary,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max, Math.min(4, Math.ceil(max)));
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.6);
  const sy = (v: number) => PAD.top + plotH - (v / top) * plotH;
  // Labels are ~40px wide; skip enough of them to avoid overlap.
  const labelStep = Math.max(1, Math.ceil(40 / slot));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={colors.border} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={PAD.left - 6} y={sy(t) + 4} fill={colors.muted} fontSize={10} textAnchor="end">
              {String(t)}
            </SvgText>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const y = sy(d.value);
            return (
              <Rect key={i} x={x} y={y} width={barW} height={Math.max(0, PAD.top + plotH - y)} rx={3} fill={color} />
            );
          })}
          {data.map((d, i) =>
            // Thin out labels when there are many bars, always keeping the most recent one.
            (data.length - 1 - i) % labelStep === 0 ? (
              <SvgText
                key={`x${i}`}
                x={PAD.left + i * slot + slot / 2}
                y={height - 6}
                fill={colors.muted}
                fontSize={10}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.faint },
});
