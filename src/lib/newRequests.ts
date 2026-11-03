import type { HelpdeskRequest } from "../types";

export interface CreationCursor {
  createdAt: number;
  ids: number[];
}

/** The API head is newest-first. Navigation and older rows shifting into a page
 * must not turn into notifications. Keep only the timestamp boundary and its ties. */
export function detectNewRequests(
  requests: HelpdeskRequest[],
  previous: CreationCursor | null,
) {
  const unique = [
    ...new Map(requests.map((request) => [request.id, request])).values(),
  ].filter((request) => Number.isFinite(Date.parse(request.created_at)));
  const latest = Math.max(
    previous?.createdAt ?? 0,
    ...unique.map((request) => Date.parse(request.created_at)),
  );
  const known = new Set(previous?.ids ?? []);
  const newRequests =
    previous === null
      ? []
      : unique.filter((request) => {
          const createdAt = Date.parse(request.created_at);
          return (
            createdAt > previous.createdAt ||
            (createdAt === previous.createdAt && !known.has(request.id))
          );
        });
  const boundaryIds = unique
    .filter((request) => Date.parse(request.created_at) === latest)
    .map((request) => request.id);
  return {
    newRequests,
    cursor: {
      createdAt: latest,
      ids: [
        ...new Set([
          ...(previous?.createdAt === latest ? previous.ids : []),
          ...boundaryIds,
        ]),
      ],
    },
  };
}
