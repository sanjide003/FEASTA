import React, { useMemo, useState } from 'react';
import { PaginationBar } from './PaginationBar';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface CompactDataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
  paginate?: boolean;
}

export function CompactDataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  emptyAction,
  defaultPageSize = 25,
  pageSizeOptions = [25, 50, 100],
  itemLabel = 'rows',
  paginate = true,
}: CompactDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const visibleRows = useMemo(() => {
    if (!paginate) return rows;
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, paginate, safePage, pageSize]);

  const handleSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-4 py-3">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3.5 w-1/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              <div className="ml-auto h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">{emptyTitle}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{emptyDescription}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3.5 py-2.5 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleRows.map((row, idx) => (
              <tr
                key={rowKey(row)}
                className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3.5 py-2 align-middle ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.render(row, paginate ? (safePage - 1) * pageSize + idx : idx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate && rows.length > Math.min(...pageSizeOptions) && (
        <PaginationBar
          page={safePage}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={setPage}
          onPageSizeChange={handleSizeChange}
          pageSizeOptions={pageSizeOptions}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
