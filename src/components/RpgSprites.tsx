import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { MonsterKind } from '@/lib/rpg';

// Small storybook-style sprites for adventure mode, drawn in a 64 × 64 box standing on y ≈ 58.
// The hero faces right, monsters face left.

const DARK = '#1C1917';
const BONE = '#E7E5E4';
const TOOTH = '#FEF9C3';

function Shadow({ rx = 14 }: { rx?: number }) {
  return <Ellipse cx={32} cy={59.5} rx={rx} ry={2.8} fill="#000" opacity={0.35} />;
}

export function HeroSprite({ size = 80 }: { size?: number }) {
  const skin = '#F2C9A0';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="hero">
      <Shadow />
      {/* cape */}
      <Path d="M23 31 Q15 45 19 57 L31 53 Z" fill="#B91C1C" />
      {/* legs and boots */}
      <Rect x={25} y={47} width={6} height={10} rx={2} fill="#3F3A52" />
      <Rect x={33} y={47} width={6} height={10} rx={2} fill="#3F3A52" />
      <Rect x={24} y={55} width={8} height={4} rx={1.5} fill="#5B3A1E" />
      <Rect x={32} y={55} width={9} height={4} rx={1.5} fill="#5B3A1E" />
      {/* tunic, breastplate, belt */}
      <Path d="M23 32 Q32 28 41 32 L42 50 Q32 53 22 50 Z" fill="#2563EB" stroke="#1E3A8A" strokeWidth={1} />
      <Path d="M26 33 Q32 31 38 33 L38 42 Q32 45 26 42 Z" fill="#CBD5E1" stroke="#64748B" strokeWidth={0.8} />
      <Rect x={22} y={45} width={20} height={3} fill="#5B3A1E" />
      <Rect x={30} y={44.5} width={4} height={4} rx={0.8} fill="#FACC15" />
      {/* sword arm */}
      <Path d="M39 34 Q44 36 45.5 40" stroke="#2563EB" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Path d="M44.2 12 L46 7.5 L47.8 12 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.6} />
      <Rect x={44.2} y={12} width={3.6} height={26} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.6} />
      <Line x1={46} y1={13} x2={46} y2={36} stroke="#94A3B8" strokeWidth={0.6} />
      <Rect x={40.5} y={37} width={11} height={2.6} rx={1} fill="#FACC15" stroke="#A16207" strokeWidth={0.5} />
      <Rect x={44.8} y={39.5} width={2.4} height={5} fill="#5B3A1E" />
      <Circle cx={46} cy={41.5} r={2.6} fill={skin} stroke="#B07D55" strokeWidth={0.6} />
      {/* head and helmet */}
      <Circle cx={32} cy={21} r={9} fill={skin} stroke="#B07D55" strokeWidth={0.8} />
      <Path d="M32 11 Q36 3 43 5 Q37 7.5 34.5 12 Z" fill="#DC2626" />
      <Path d="M22.3 20 A9.7 9.7 0 0 1 41.7 20 Z" fill="#94A3B8" stroke="#475569" strokeWidth={0.8} />
      <Rect x={22} y={18.5} width={20} height={3} rx={1} fill="#64748B" />
      <Circle cx={29.5} cy={24} r={1.3} fill={DARK} />
      <Circle cx={36} cy={24} r={1.3} fill={DARK} />
      <Path d="M31.5 27.5 Q34 29 36.5 27.5" stroke={DARK} strokeWidth={1} fill="none" strokeLinecap="round" />
      {/* shield */}
      <Circle cx={22} cy={40} r={7.5} fill="#B91C1C" stroke="#FACC15" strokeWidth={1.5} />
      <Path d="M22 35 L22 45 M17 40 L27 40" stroke="#FACC15" strokeWidth={1.5} />
    </Svg>
  );
}

function Slime() {
  return (
    <>
      <Shadow rx={17} />
      <Path
        d="M12 57 Q9 39 23 31 Q28 23 31 19 Q34 23 41 31 Q55 39 52 57 Q32 61 12 57 Z"
        fill="#4ADE80"
        stroke="#166534"
        strokeWidth={1.5}
      />
      <Ellipse cx={22} cy={39} rx={4} ry={2.4} fill="#fff" opacity={0.5} transform="rotate(-35 22 39)" />
      <Circle cx={25} cy={45} r={3.2} fill="#fff" />
      <Circle cx={36} cy={45} r={3.2} fill="#fff" />
      <Circle cx={24.2} cy={45.5} r={1.7} fill={DARK} />
      <Circle cx={35.2} cy={45.5} r={1.7} fill={DARK} />
      <Path d="M26 51 Q30.5 54 35 51" stroke={DARK} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bat() {
  const wing = '#6D28D9';
  return (
    <>
      <Shadow rx={9} />
      <Path d="M28 30 Q14 16 4 24 Q10 28 8 34 Q14 32 16 38 Q22 33 28 36 Z" fill={wing} stroke="#2E1065" strokeWidth={1} />
      <Path d="M36 30 Q50 16 60 24 Q54 28 56 34 Q50 32 48 38 Q42 33 36 36 Z" fill={wing} stroke="#2E1065" strokeWidth={1} />
      <Path d="M26 28 L25 18 L30.5 25 Z M38 28 L39 18 L33.5 25 Z" fill="#7C3AED" stroke="#2E1065" strokeWidth={0.8} />
      <Ellipse cx={32} cy={34} rx={8} ry={10} fill="#7C3AED" stroke="#2E1065" strokeWidth={1} />
      <Circle cx={28.5} cy={31.5} r={2} fill="#F87171" />
      <Circle cx={35.5} cy={31.5} r={2} fill="#F87171" />
      <Path d="M29 38.5 L30 42 L31 38.5 Z M33 38.5 L34 42 L35 38.5 Z" fill="#fff" />
      <Path d="M29 43.5 L28 46.5 M35 43.5 L36 46.5" stroke="#2E1065" strokeWidth={1.2} strokeLinecap="round" />
    </>
  );
}

function Skeleton() {
  const glow = '#22D3EE';
  return (
    <>
      <Shadow rx={12} />
      <Path d="M28 46 L26 57 M36 46 L38 57 M22 58 L27 58 M37 58 L42 58" stroke={BONE} strokeWidth={3} strokeLinecap="round" />
      <Path d="M25 44 Q32 49 39 44 L37 47.5 Q32 50 27 47.5 Z" fill={BONE} stroke="#78716C" strokeWidth={0.6} />
      <Line x1={32} y1={29} x2={32} y2={45} stroke={BONE} strokeWidth={2.5} />
      <Path d="M25 32 Q32 29 39 32 M25 36 Q32 33 39 36 M26 40 Q32 37 38 40" stroke={BONE} strokeWidth={2} fill="none" />
      {/* rusty sword */}
      <Path d="M15.5 42 L9 22 L11.8 21.2 L18 41.2 Z" fill="#A8A29E" stroke="#57534E" strokeWidth={0.7} />
      <Line x1={13} y1={42.5} x2={20.5} y2={40} stroke="#78350F" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M25 31 Q19 36 17.5 41.5 M39 31 Q44 35 43.5 41" stroke={BONE} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={17} cy={42} r={1.8} fill={BONE} />
      {/* skull */}
      <Rect x={27} y={23} width={10} height={6} rx={2} fill={BONE} stroke="#78716C" strokeWidth={0.7} />
      <Circle cx={32} cy={19} r={8.5} fill={BONE} stroke="#78716C" strokeWidth={0.8} />
      <Circle cx={28.5} cy={19} r={2.6} fill={DARK} />
      <Circle cx={35.5} cy={19} r={2.6} fill={DARK} />
      <Circle cx={28.5} cy={19} r={1} fill={glow} />
      <Circle cx={35.5} cy={19} r={1} fill={glow} />
      <Path d="M31.2 23.5 L32 21.8 L32.8 23.5 Z" fill={DARK} />
      <Path d="M29.5 26 L29.5 28.5 M32 26 L32 28.5 M34.5 26 L34.5 28.5" stroke="#78716C" strokeWidth={0.8} />
    </>
  );
}

function Goblin() {
  const skin = '#65A30D';
  const line = '#365314';
  return (
    <>
      <Shadow rx={13} />
      <Rect x={26} y={47} width={5} height={10} fill="#4D7C0F" />
      <Rect x={33} y={47} width={5} height={10} fill="#4D7C0F" />
      <Ellipse cx={27} cy={57.5} rx={4} ry={2} fill="#3F6212" />
      <Ellipse cx={36} cy={57.5} rx={4} ry={2} fill="#3F6212" />
      <Path d="M23 34 Q32 30 41 34 L42 50 L22 50 Z" fill="#78350F" stroke="#451A03" strokeWidth={0.8} />
      <Rect x={22} y={44} width={20} height={2.5} fill="#A16207" />
      {/* club */}
      <Path d="M14 46 L8 26 Q8 20 13 21 Q17 22 16 28 L17 46 Z" fill="#92400E" stroke="#451A03" strokeWidth={1} />
      <Circle cx={10.5} cy={26} r={1} fill="#D6D3D1" />
      <Circle cx={14.5} cy={24.5} r={1} fill="#D6D3D1" />
      <Path d="M24 36 Q18 40 15.5 44" stroke={skin} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Circle cx={15.5} cy={45} r={3} fill={skin} stroke={line} strokeWidth={0.6} />
      <Path d="M40 36 Q44 41 42 46" stroke={skin} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      {/* head */}
      <Path d="M23.5 19 L10 13 L23 26 Z M40.5 19 L54 13 L41 26 Z" fill={skin} stroke={line} strokeWidth={1} />
      <Ellipse cx={32} cy={22} rx={10} ry={9} fill={skin} stroke={line} strokeWidth={1} />
      <Ellipse cx={28} cy={21} rx={2.4} ry={2} fill="#FDE047" />
      <Ellipse cx={35.5} cy={21} rx={2.4} ry={2} fill="#FDE047" />
      <Circle cx={27.3} cy={21.2} r={1.1} fill={DARK} />
      <Circle cx={34.8} cy={21.2} r={1.1} fill={DARK} />
      <Path d="M25 17.5 L30 19 M38.5 17.5 L33.5 19" stroke={DARK} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M31 22 Q27.5 25 31.5 26" stroke={line} strokeWidth={1} fill="none" />
      <Path d="M26 27.5 Q32 31.5 37 27.5 Z" fill={DARK} />
      <Path d="M28 28.3 L29 30.3 L30 28.9 Z M34 28.9 L35 30.3 L36 28.3 Z" fill={TOOTH} />
    </>
  );
}

function Ogre() {
  const skin = '#A3A35C';
  const line = '#4D4D24';
  return (
    <>
      <Shadow rx={19} />
      <Rect x={22} y={48} width={8} height={9} rx={2} fill={skin} stroke={line} strokeWidth={0.8} />
      <Rect x={35} y={48} width={8} height={9} rx={2} fill={skin} stroke={line} strokeWidth={0.8} />
      <Ellipse cx={25} cy={58} rx={6} ry={2.5} fill="#44403C" />
      <Ellipse cx={39} cy={58} rx={6} ry={2.5} fill="#44403C" />
      {/* club */}
      <Path d="M11 46 L3 18 Q4 11 10 13 Q14 15 13.5 22 L15 46 Z" fill="#92400E" stroke="#451A03" strokeWidth={1} />
      <Ellipse cx={16} cy={39} rx={5} ry={8} fill={skin} stroke={line} strokeWidth={1} transform="rotate(20 16 39)" />
      <Ellipse cx={48.5} cy={39} rx={5} ry={8} fill={skin} stroke={line} strokeWidth={1} transform="rotate(-15 48.5 39)" />
      <Ellipse cx={32} cy={39} rx={16} ry={13} fill={skin} stroke={line} strokeWidth={1.2} />
      <Ellipse cx={33} cy={42} rx={10} ry={8} fill="#BDBD7A" />
      <Path d="M19 47 L45 47 L41 56 L23 56 Z" fill="#78350F" stroke="#451A03" strokeWidth={0.8} />
      <Circle cx={13} cy={46} r={4} fill={skin} stroke={line} strokeWidth={1} />
      {/* head */}
      <Ellipse cx={32} cy={21} rx={8.5} ry={8} fill={skin} stroke={line} strokeWidth={1} />
      <Path d="M25.5 17.5 Q32 15 38.5 17.5" stroke={DARK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={29} cy={20.5} r={1.4} fill={DARK} />
      <Circle cx={35} cy={20.5} r={1.4} fill={DARK} />
      <Path d="M27.5 25.5 Q32 27.5 36.5 25.5" stroke={DARK} strokeWidth={1.1} fill="none" />
      <Path d="M28.5 26 L28 21.8 L30.2 25 Z M35.5 26 L36 21.8 L33.8 25 Z" fill={TOOTH} />
    </>
  );
}

function Golem() {
  const stone = '#A8A29E';
  const line = '#44403C';
  const rune = '#22D3EE';
  return (
    <>
      <Shadow rx={18} />
      <Rect x={22} y={46} width={8} height={12} rx={2} fill="#78716C" stroke={line} strokeWidth={1} />
      <Rect x={34} y={46} width={8} height={12} rx={2} fill="#78716C" stroke={line} strokeWidth={1} />
      <Rect x={8} y={27} width={9} height={19} rx={3} fill="#8D8782" stroke={line} strokeWidth={1} />
      <Rect x={47} y={27} width={9} height={19} rx={3} fill="#8D8782" stroke={line} strokeWidth={1} />
      <Rect x={18} y={25} width={28} height={23} rx={4} fill={stone} stroke={line} strokeWidth={1.5} />
      <Path d="M23 29 L27 34 L25 40 M41 30 L38 35" stroke="#57534E" strokeWidth={1} fill="none" />
      <Circle cx={32} cy={37} r={4.5} fill={rune} opacity={0.9} />
      <Circle cx={32} cy={37} r={2} fill="#fff" opacity={0.75} />
      <Rect x={6.5} y={44} width={12} height={9} rx={3} fill="#78716C" stroke={line} strokeWidth={1} />
      <Rect x={45.5} y={44} width={12} height={9} rx={3} fill="#78716C" stroke={line} strokeWidth={1} />
      <Rect x={24} y={11} width={16} height={14} rx={3} fill={stone} stroke={line} strokeWidth={1.2} />
      <Rect x={26} y={16.5} width={4.5} height={2.6} rx={1} fill={rune} />
      <Rect x={33.5} y={16.5} width={4.5} height={2.6} rx={1} fill={rune} />
      <Path d="M24.5 13.5 Q28 10.5 31.5 12.5" stroke="#4D7C0F" strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  );
}

function Dragon() {
  const scale = '#DC2626';
  const line = '#450A0A';
  return (
    <>
      <Shadow rx={21} />
      <Path d="M46 50 Q58 52 60 42 Q61 37 57 34" stroke="#B91C1C" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M56 35 L62 29.5 L60.5 37.5 Z" fill="#7F1D1D" />
      <Path d="M36 33 Q44 10 61 7 Q56 15 58 21 Q52 21 52 27 Q46 26 44 34 Z" fill="#7F1D1D" stroke={line} strokeWidth={1} />
      <Path d="M44 14 L47 27 M52 11 L50 25" stroke={line} strokeWidth={0.8} />
      <Rect x={30} y={49} width={6} height={9} rx={2} fill="#B91C1C" stroke={line} strokeWidth={0.8} />
      <Rect x={42} y={49} width={6} height={9} rx={2} fill="#B91C1C" stroke={line} strokeWidth={0.8} />
      <Path d="M29 58 L30 60 L31.5 58 L33 60 L34.5 58 M41 58 L42 60 L43.5 58 L45 60 L46.5 58" stroke="#fff" strokeWidth={0.9} fill="none" />
      <Ellipse cx={39} cy={44} rx={13} ry={10} fill={scale} stroke={line} strokeWidth={1.2} />
      <Ellipse cx={36} cy={47} rx={8} ry={6} fill="#FCA5A5" />
      <Path d="M31 42 Q22 35 22 26" stroke={scale} strokeWidth={8} fill="none" strokeLinecap="round" />
      <Path d="M26 19 Q20 15.5 10 19.5 L6 23.5 Q8 28 14 28 L24 30 Q30.5 28 28 21 Z" fill={scale} stroke={line} strokeWidth={1} />
      <Path d="M25 19.5 L31 10 L28 21 Z M21.5 18 L24.5 8.5 L24 19 Z" fill="#FDE68A" stroke="#A16207" strokeWidth={0.6} />
      <Ellipse cx={18} cy={21.5} rx={2.1} ry={1.5} fill="#FDE047" />
      <Ellipse cx={17.6} cy={21.5} rx={0.6} ry={1.3} fill={DARK} />
      <Circle cx={8.5} cy={23} r={0.8} fill={DARK} />
      <Path d="M10 27 L11 29.2 L12 27.3 Z M14.5 27.7 L15.5 29.8 L16.5 27.9 Z" fill="#fff" />
      <Circle cx={3} cy={26.5} r={2.1} fill="#FB923C" opacity={0.85} />
      <Circle cx={1.4} cy={24} r={1.3} fill="#FDE047" opacity={0.9} />
    </>
  );
}

const MONSTERS: Record<MonsterKind, { Body: () => ReactElement; crownBase: number }> = {
  slime: { Body: Slime, crownBase: 23 },
  bat: { Body: Bat, crownBase: 25 },
  skeleton: { Body: Skeleton, crownBase: 12 },
  goblin: { Body: Goblin, crownBase: 14.5 },
  ogre: { Body: Ogre, crownBase: 14.5 },
  golem: { Body: Golem, crownBase: 12 },
  dragon: { Body: Dragon, crownBase: 0 },
};

export function MonsterSprite({ kind, size = 80, elite }: { kind: MonsterKind; size?: number; elite?: boolean }) {
  const { Body, crownBase } = MONSTERS[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel={`monster-${kind}`}>
      <Body />
      {elite && kind !== 'dragon' ? (
        <G transform={`translate(0 ${crownBase - 8})`}>
          <Path d="M25 8 L26 1.5 L29.3 5.5 L32 0.5 L34.7 5.5 L38 1.5 L39 8 Z" fill="#FACC15" stroke="#A16207" strokeWidth={0.8} />
          <Circle cx={32} cy={5.8} r={1} fill="#EF4444" />
        </G>
      ) : null}
    </Svg>
  );
}

export function ChestSprite({ size = 80 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="treasure">
      <Shadow rx={18} />
      <Path d="M14 30 Q14 18 32 18 Q50 18 50 30 Z" fill="#92400E" stroke="#451A03" strokeWidth={1.2} />
      <Path d="M20 22 Q32 14 44 22" stroke="#FDE047" strokeWidth={2} fill="none" opacity={0.6} />
      <Rect x={14} y={30} width={36} height={27} rx={2} fill="#B45309" stroke="#451A03" strokeWidth={1.2} />
      <Rect x={14} y={29} width={36} height={4} fill="#FACC15" stroke="#A16207" strokeWidth={0.8} />
      <Rect x={20} y={18.5} width={4} height={38.5} fill="#FACC15" opacity={0.85} />
      <Rect x={40} y={18.5} width={4} height={38.5} fill="#FACC15" opacity={0.85} />
      <Rect x={28.5} y={31} width={7} height={8} rx={1.5} fill="#FDE047" stroke="#A16207" strokeWidth={0.8} />
      <Circle cx={32} cy={34.5} r={1.2} fill={DARK} />
      <Path d="M24 13 L25 10 L26 13 L29 14 L26 15 L25 18 L24 15 L21 14 Z" fill="#FEF08A" />
      <Path d="M40 10 L40.8 8 L41.6 10 L43.6 10.8 L41.6 11.6 L40.8 13.6 L40 11.6 L38 10.8 Z" fill="#FEF08A" />
    </Svg>
  );
}
