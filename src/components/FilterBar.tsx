import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
  ArrowRight,
} from "./icons";
import { useBoardStore } from "../data/store";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDialog } from "../hooks/useDialog";
import { daysBetween, formatSiteDate, validDate } from "../lib/dates";
import type { Filters } from "../lib/urlState";
import { Icon, shortSiteName } from "./ui";
interface Props {
  filters: Filters;
  defaults: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  resultCount: number;
}
function SearchInput({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(query);
  const debounced = useDebouncedValue(text);
  const latestQuery = useRef(query);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    latestQuery.current = query;
    setText(query);
  }, [query]);
  useEffect(() => {
    if (debounced.trim() !== latestQuery.current)
      onChangeRef.current(debounced);
  }, [debounced]);
  function clear() {
    setText("");
    onChange("");
  }
  return (
    <div className="search-field">
      <Icon as={Search} size={17} />
      <input
        aria-label="Search requests on this page"
        placeholder="Search this page…"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            clear();
          }
        }}
      />
      {text && (
        <button
          className="search-clear"
          aria-label="Clear search"
          onClick={clear}
        >
          <Icon as={X} size={15} />
        </button>
      )}
      <span className="search-hint">Ref, title, person…</span>
    </div>
  );
}
function CheckList({
  values,
  selected,
  onChange,
}: {
  values: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="check-list">
      {values.map((item) => (
        <label className="check-option" key={item.value}>
          <input
            type="checkbox"
            checked={selected.includes(item.value)}
            onChange={() =>
              onChange(
                selected.includes(item.value)
                  ? selected.filter((value) => value !== item.value)
                  : [...selected, item.value],
              )
            }
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
function MultiSelect({
  label,
  summary,
  values,
  selected,
  onChange,
}: {
  label: string;
  summary: string;
  values: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="filter-field"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      <span className="field-label" id={`label-${label}`}>
        {label}
      </span>
      <button
        className="select-trigger"
        aria-labelledby={`label-${label} value-${label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span id={`value-${label}`} className="select-value">
          {summary}
        </span>
        {selected.length > 0 && (
          <span className="count-badge">{selected.length}</span>
        )}
        <Icon as={ChevronDown} size={16} />
      </button>
      {open && (
        <div className="select-popover">
          <button className="all-option" onClick={() => onChange([])}>
            All {label.toLowerCase() === "site" ? "sites" : "statuses"}
          </button>
          <CheckList values={values} selected={selected} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
function DateRange({
  filters,
  setFilters,
  defaults,
}: Pick<Props, "filters" | "setFilters" | "defaults">) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filters.from),
    [to, setTo] = useState(filters.to);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div
      className="filter-field date-range-field"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      <span className="field-label" id="date-range-label">
        Date range
      </span>
      <div className="date-range-control">
        <button
          className="date-range-trigger"
          aria-labelledby="date-range-label date-range-value"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon as={Calendar} size={18} />
          <span id="date-range-value">
            {formatSiteDate(filters.from)} <Icon as={ArrowRight} size={15} />{" "}
            {formatSiteDate(filters.to)}
          </span>
        </button>
        {filters.from === defaults.from && filters.to === defaults.to && (
          <span className="range-hint">
            Last {daysBetween(filters.from, filters.to) + 1} days
          </span>
        )}
      </div>
      {open && (
        <form
          className="select-popover date-popover"
          onSubmit={(event) => {
            event.preventDefault();
            if (validDate(from) && validDate(to)) {
              setFilters({
                from: from < to ? from : to,
                to: to > from ? to : from,
              });
              setOpen(false);
            }
          }}
        >
          <label>
            From
            <input
              type="date"
              required
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <div className="date-popover-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setFilters({ from: defaults.from, to: defaults.to });
                setOpen(false);
              }}
            >
              Last 30 days
            </button>
            <button className="button button-primary" type="submit">
              Apply range
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
export function SortSelect({
  filters,
  setFilters,
  compact = false,
}: {
  filters: Filters;
  setFilters: Props["setFilters"];
  compact?: boolean;
}) {
  return (
    <label
      className={`filter-field sort-field ${compact ? "compact-sort" : ""}`}
    >
      <span className={compact ? "sr-only" : "field-label"}>Sort</span>
      <span className="native-select">
        <select
          value={`${filters.sort}-${filters.dir}`}
          onChange={(event) => {
            const [sort, dir] = event.target.value.split("-");
            setFilters({
              sort: sort as Filters["sort"],
              dir: dir as Filters["dir"],
            });
          }}
        >
          <option value="due-asc">
            {compact ? "Due ↑" : "Due date · soonest first"}
          </option>
          <option value="due-desc">
            {compact ? "Due ↓" : "Due date · latest first"}
          </option>
          <option value="created-desc">
            {compact ? "Newest first" : "Created · newest first"}
          </option>
          <option value="created-asc">
            {compact ? "Oldest first" : "Created · oldest first"}
          </option>
        </select>
        <Icon as={ChevronDown} size={16} />
      </span>
    </label>
  );
}
function MobileSheet({
  filters,
  defaults,
  setFilters,
  onClose,
  resultCount,
}: Props & { onClose: () => void }) {
  const ref = useDialog(onClose);
  const sites = useBoardStore((state) => state.sites),
    labels = useBoardStore((state) => state.statusLabels);
  return (
    <div
      className="sheet-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        ref={ref}
      >
        <span className="sheet-handle" />
        <div className="sheet-header">
          <h2 id="filter-sheet-title" tabIndex={-1} data-initial-focus>
            Filters
          </h2>
          <button
            className="icon-button"
            aria-label="Close filters"
            onClick={onClose}
          >
            <Icon as={X} />
          </button>
        </div>
        <div className="sheet-body">
          <fieldset>
            <legend>Date range</legend>
            <div className="sheet-dates">
              <label>
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => {
                    if (validDate(event.target.value))
                      setFilters({ from: event.target.value });
                  }}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => {
                    if (validDate(event.target.value))
                      setFilters({ to: event.target.value });
                  }}
                />
              </label>
            </div>
            <button
              className="text-button"
              onClick={() =>
                setFilters({ from: defaults.from, to: defaults.to })
              }
            >
              Last 30 days
            </button>
          </fieldset>
          <fieldset>
            <legend>Site</legend>
            <CheckList
              values={Object.values(sites).map((site) => ({
                value: String(site.id),
                label: shortSiteName(site),
              }))}
              selected={filters.sites.map(String)}
              onChange={(values) => setFilters({ sites: values.map(Number) })}
            />
          </fieldset>
          <fieldset>
            <legend>
              Status <span className="muted">(none selected means all)</span>
            </legend>
            <CheckList
              values={["pending", "processing", "complete"].map((value) => ({
                value,
                label: labels[value] ?? value,
              }))}
              selected={filters.statuses}
              onChange={(statuses) => setFilters({ statuses })}
            />
          </fieldset>
        </div>
        <div className="sheet-footer">
          <button
            className="text-button"
            onClick={() => setFilters({ ...defaults, statuses: [] })}
          >
            Clear
          </button>
          <button className="button button-primary" onClick={onClose}>
            Show {resultCount.toLocaleString()} on this page
          </button>
        </div>
      </div>
    </div>
  );
}
export function FilterBar(props: Props) {
  const { filters, defaults, setFilters } = props;
  const sites = useBoardStore((state) => state.sites),
    labels = useBoardStore((state) => state.statusLabels);
  const [sheet, setSheet] = useState(false);
  const siteValues = Object.values(sites).map((site) => ({
    value: String(site.id),
    label: shortSiteName(site),
  }));
  const selectedSiteNames = filters.sites.map((id) =>
    sites[id] ? shortSiteName(sites[id]) : `Site #${id}`,
  );
  const activeCount =
    filters.sites.length +
    filters.statuses.length +
    (filters.from !== defaults.from || filters.to !== defaults.to ? 1 : 0);
  return (
    <section className="filters" aria-label="Request filters">
      <div className="desktop-filters">
        <DateRange {...props} />
        <MultiSelect
          label="Site"
          summary={
            selectedSiteNames.length
              ? selectedSiteNames.join(", ")
              : "All sites"
          }
          values={siteValues}
          selected={filters.sites.map(String)}
          onChange={(values) => setFilters({ sites: values.map(Number) })}
        />
        <MultiSelect
          label="Status"
          summary={
            filters.statuses.length
              ? filters.statuses
                  .map((status) => labels[status] ?? status)
                  .join(", ")
              : "All statuses"
          }
          values={["pending", "processing", "complete"].map((value) => ({
            value,
            label: labels[value] ?? value,
          }))}
          selected={filters.statuses}
          onChange={(statuses) => setFilters({ statuses })}
        />
        <SortSelect filters={filters} setFilters={setFilters} />
        <button
          className="text-button clear-filters"
          onClick={() => setFilters({ ...defaults, statuses: [] })}
        >
          Clear filters
        </button>
      </div>
      <div className="search-row">
        <SearchInput query={filters.q} onChange={(q) => setFilters({ q })} />
        <span className="search-caption">Search and sort the current page</span>
      </div>
      <div className="mobile-filter-controls">
        <button
          className="button button-outline"
          onClick={() => setSheet(true)}
        >
          <Icon as={SlidersHorizontal} />
          Filters
          {activeCount ? (
            <span className="neutral-count">{activeCount}</span>
          ) : null}
        </button>
        <SortSelect filters={filters} setFilters={setFilters} compact />
      </div>
      {sheet && <MobileSheet {...props} onClose={() => setSheet(false)} />}
    </section>
  );
}
