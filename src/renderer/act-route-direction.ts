import type { GuideEntry } from '../shared/types';

type RouteGuide = Pick<GuideEntry, 'id' | 'next_zone_ru'>;
type Point = readonly [number, number];

export function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');
}

// Selection is a guide preview, never proof of the player's live location.
export function resolveRouteDirection(
  selected: RouteGuide | null,
  liveId: string | null,
  byName: ReadonlyMap<string, { entry: { guide: RouteGuide } }>
) {
  const originId = selected?.id ?? null;
  const target = selected ? byName.get(normalizedName(selected.next_zone_ru))?.entry.guide.id ?? null : null;
  return { originId, nextId: target === originId ? null : target, isPreview: originId !== null && originId !== liveId };
}

// Keep markers, bonus badges and labels inside the visible map frame.
export function insetMapPoint(point: Point): Point {
  return [13 + (point[0] - 13) * .9, 14 + (point[1] - 13) * .86];
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function buildRoutePath(from: Point, to: Point, withMidpoint = false): string {
  const start = insetMapPoint(from);
  const end = insetMapPoint(to);
  const a: Point = [start[0] * 10, start[1] * 7.4];
  const d: Point = [end[0] * 10, end[1] * 7.4];
  const bend = Math.max(14, Math.min(65, Math.abs(d[0] - a[0]) * .22));
  const sign = d[1] >= a[1] ? 1 : -1;
  const b: Point = [a[0] + bend, a[1] + sign * 12];
  const c: Point = [d[0] - bend, d[1] - sign * 12];
  if (!withMidpoint) return `M${a} C${b} ${c} ${d}`;
  // De Casteljau subdivision at t=.5 keeps the same curve and tangent,
  // while providing an SVG marker-mid vertex outside the endpoint nodes.
  const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d);
  const abc = midpoint(ab, bc), bcd = midpoint(bc, cd);
  const center = midpoint(abc, bcd);
  return `M${a} C${ab} ${abc} ${center} C${bcd} ${cd} ${d}`;
}
