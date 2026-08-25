import type { ReactNode } from "react";

/**
 * The back office is built from cards and nothing else.
 *
 * The reason is maintenance, not decoration. A page that writes its own markup drifts: the third
 * section gets a slightly different heading size, the fifth forgets the empty state, and changing
 * the padding everywhere becomes a search-and-replace across files. When a section is a card, a
 * new one is a few lines and every existing one moves together when the card moves.
 *
 * Anything added to this file becomes the convention for every admin page. Adding a variant here
 * is right; writing bespoke markup in a page is not.
 */

type Tone = "default" | "note" | "warning";

export function AdminCard({
  title,
  description,
  actions,
  footer,
  tone = "default",
  children
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <section className={`admin-card${tone === "default" ? "" : ` admin-card--${tone}`}`}>
      {title || description || actions ? (
        <header className="admin-card__head">
          <div>
            {title ? <h2 className="admin-card__title">{title}</h2> : null}
            {description ? <p className="admin-card__desc">{description}</p> : null}
          </div>
          {actions ? <div className="admin-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="admin-card__body">{children}</div> : null}
      {footer ? <footer className="admin-card__foot">{footer}</footer> : null}
    </section>
  );
}

/** Lays cards out. `columns` is a maximum: narrow screens collapse it without the caller asking. */
export function AdminGrid({ columns = 2, children }: { columns?: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <div className="admin-grid" data-columns={columns}>
      {children}
    </div>
  );
}

/**
 * A single counted figure. `value` is a number because this is for counts, and `empty` is required
 * so a tile can never silently render a zero that looks like a measurement nobody took.
 */
export function AdminStat({ label, value, empty, hint }: { label: string; value: number; empty: string; hint?: string }) {
  return (
    <article className="admin-stat">
      <p className="admin-stat__label">{label}</p>
      {value > 0 ? (
        <p className="admin-stat__value">{value.toLocaleString("th-TH")}</p>
      ) : (
        <p className="admin-stat__empty">{empty}</p>
      )}
      {hint ? <p className="admin-stat__hint">{hint}</p> : null}
    </article>
  );
}

export function AdminStatRow({ children }: { children: ReactNode }) {
  return <div className="admin-stat-row">{children}</div>;
}

/**
 * Says nothing is here yet, in the one place that decides how that looks. Pages call this instead
 * of inventing a sentence each time, so "no rows" reads the same everywhere in the back office.
 */
export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

export type AdminTableColumn<Row> = {
  key: string;
  header: string;
  /** Right-aligned and tabular. Use for anything a reader will compare down the column. */
  numeric?: boolean;
  render: (row: Row) => ReactNode;
};

/**
 * One table implementation for the whole back office. A caller supplies columns and rows; it never
 * supplies `<table>`, so header styling, alignment and the empty case cannot diverge per page.
 */
export function AdminTable<Row>({
  columns,
  rows,
  rowKey,
  empty
}: {
  columns: readonly AdminTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  empty: string;
}) {
  if (rows.length === 0) return <AdminEmpty>{empty}</AdminEmpty>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-numeric={column.numeric ? "true" : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.key} scope="row">
                    {column.render(row)}
                  </th>
                ) : (
                  <td key={column.key} data-numeric={column.numeric ? "true" : undefined}>
                    {column.render(row)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
