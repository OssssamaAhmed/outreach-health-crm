import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  request_decided: "bg-emerald-500",
  new_pending_request: "bg-amber-500",
  account_status_changed: "bg-sky-500",
};

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const listQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: open,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const unread = unreadQuery.data ?? 0;
  const items = (listQuery.data ?? []).slice(0, 8);

  const handleItemClick = (id: number, link: string | null, isUnread: boolean) => {
    if (isUnread) markRead.mutate({ id });
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn("relative h-7 w-7 text-text-secondary hover:text-text-primary flex-shrink-0", className)}
          title="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <p className="text-[13px] font-medium text-text-primary">Notifications</p>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="px-3 py-6 text-center text-[12px] text-text-muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-text-muted">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const isUnread = n.readAt == null;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n.id, n.link, isUnread)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                        isUnread && "bg-brand-primary-soft/30",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0",
                            isUnread ? TYPE_DOT[n.type] ?? "bg-text-muted" : "bg-transparent",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-[12.5px] truncate",
                            isUnread ? "font-medium text-text-primary" : "text-text-secondary",
                          )}>
                            {n.title}
                          </p>
                          {n.message && (
                            <p className="text-[11.5px] text-text-muted line-clamp-2 mt-0.5">
                              {n.message}
                            </p>
                          )}
                          <p className="text-[10.5px] text-text-muted mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-3 py-2">
          <Link href="/notifications">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[12px] text-brand-primary"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
