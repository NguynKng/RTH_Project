export interface RowPosition {
  id: number;
  top: number;
  height: number;
}
export interface ArrivalFrame {
  batch: number;
  view: string;
  rows: RowPosition[];
}
export interface RowMotion {
  id: number;
  fromY: number;
  entering: boolean;
  delay: number;
}

/** FLIP offsets come from layout positions, never viewport scroll coordinates. */
export function planArrivalMotion(
  previous: ArrivalFrame | null,
  current: ArrivalFrame,
  arrivalIds: number[],
): RowMotion[] {
  if (
    !previous ||
    previous.view !== current.view ||
    current.batch <= previous.batch
  )
    return [];
  const arrivals = new Set(arrivalIds);
  if (!current.rows.some((row) => arrivals.has(row.id))) return [];
  const old = new Map(previous.rows.map((row) => [row.id, row.top]));
  let enteringIndex = 0;
  return current.rows.flatMap<RowMotion>((row) => {
    const before = old.get(row.id);
    if (before !== undefined) {
      const fromY = before - row.top;
      return Math.abs(fromY) > 0.5
        ? [{ id: row.id, fromY, entering: false, delay: 0 }]
        : [];
    }
    if (!arrivals.has(row.id)) return [];
    return [
      {
        id: row.id,
        fromY: -Math.min(32, row.height / 2),
        entering: true,
        delay: Math.min(enteringIndex++, 3) * 40,
      },
    ];
  });
}
