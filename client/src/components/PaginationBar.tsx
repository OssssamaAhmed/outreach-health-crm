import { Button } from "@/components/ui/button";

/**
 * Build the page-number sequence for desktop pagination, with
 * ellipses for large totals. Always shows first + last + a window
 * around the current page.
 */
function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  const out: (number | "...")[] = [1];
  if (current > 3) out.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    out.push(i);
  }
  if (current < total - 2) out.push("...");
  out.push(total);
  return out;
}

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional label for "Showing 1 to 20 of 596 X". Defaults to "results". */
  resourceName?: string;
}

export function PaginationBar({ page, pageSize, total, onPageChange, resourceName = "results" }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageList = buildPageList(page, totalPages);

  return (
    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
      <div className="text-[12px] text-text-secondary">
        Showing {start} to {end} of {total} {resourceName}
      </div>

      {/* Mobile controls */}
      <div className="flex items-center gap-2 sm:hidden">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-[12px] text-text-secondary px-1">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>

      {/* Desktop controls */}
      <div className="hidden sm:flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {pageList.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-text-muted text-xs select-none">…</span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === page ? "default" : "outline"}
              className="h-8 min-w-[2rem] px-2"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Button>
          )
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Reads `?page=N` from the current URL, validating bounds. Used by list
 * pages to initialize page state from the URL.
 */
export function readPageParam(): number {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("page");
  const n = raw ? parseInt(raw, 10) : 1;
  return isNaN(n) || n < 1 ? 1 : n;
}

export const PAGINATION_PAGE_SIZE = 20;
