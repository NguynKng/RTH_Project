const widths = ["60%", "88%", "65%", "56%", "75%", "85%", "70%", "90%"];
export function SkeletonRows({ count = 8 }: { count?: number } = {}) {
  return (
    <>
      <div className="table-scroll" aria-hidden="true">
        <div className="skeleton-table">
          <div className="skeleton-table-head">
            {[
              "Ref",
              "Title",
              "Site",
              "Priority",
              "Status",
              "Assignee",
              "Due",
              "Created",
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {Array.from({ length: count }, (_, row) => (
            <div className="skeleton-table-row" key={row}>
              {widths.map((width, col) => (
                <span key={col} className="skeleton" style={{ width }}>
                  {col === 1 ? "\u00a0\n\u00a0" : "\u00a0"}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading requests…</span>
    </>
  );
}
export function SkeletonDetail() {
  return (
    <div aria-busy="true">
      <div className="detail-loading" aria-hidden="true">
        <div className="skeleton" style={{ width: "75%", height: 30 }} />
        <div className="skeleton" style={{ width: "45%", height: 24 }} />
        <div className="skeleton" style={{ height: 180 }} />
        <div className="skeleton" style={{ height: 90 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            className="skeleton"
            style={{ height: 50, width: i % 2 ? "80%" : "100%" }}
            key={i}
          />
        ))}
      </div>
      <span className="sr-only">Loading request details…</span>
    </div>
  );
}
