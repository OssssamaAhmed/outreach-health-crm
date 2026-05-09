import AppLayout from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  request_decided: "bg-emerald-500",
  new_pending_request: "bg-amber-500",
  account_status_changed: "bg-sky-500",
};

const TYPE_LABEL: Record<string, string> = {
  request_decided: "Request decision",
  new_pending_request: "New approval request",
  account_status_changed: "Account status",
};

export default function Notifications() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notifications.list.useQuery();

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

  const items = data ?? [];
  const unreadCount = items.filter((n) => n.readAt == null).length;

  const handleClick = (id: number, link: string | null, isUnread: boolean) => {
    if (isUnread) markRead.mutate({ id });
    if (link) navigate(link);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="Notifications"
          description={
            unreadCount > 0
              ? `${unreadCount} unread of ${items.length}`
              : `${items.length} total`
          }
          action={
            unreadCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            ) : undefined
          }
        />

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">Loading…</CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-10 w-10 text-text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No notifications yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const isUnread = n.readAt == null;
              return (
                <Card
                  key={n.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/30",
                    isUnread && "bg-brand-primary-soft/30",
                  )}
                  onClick={() => handleClick(n.id, n.link, isUnread)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                          isUnread ? TYPE_DOT[n.type] ?? "bg-text-muted" : "bg-transparent",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn(
                            "text-[14px]",
                            isUnread ? "font-medium text-text-primary" : "text-text-secondary",
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[11px] text-text-muted px-1.5 py-0.5 rounded bg-muted">
                            {TYPE_LABEL[n.type] ?? n.type}
                          </span>
                        </div>
                        {n.message && (
                          <p className="text-[13px] text-text-secondary mt-1">{n.message}</p>
                        )}
                        <p className="text-[11.5px] text-text-muted mt-1.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })} · {format(new Date(n.createdAt), "dd MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
