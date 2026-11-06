import { useState } from "react";
import { BookmarkPlus, History, Search, Trash2, Zap } from "lucide-react";
import { Button, cx, EmptyState, IconButton } from "@/design-system";
import { formatRelative } from "@/shared/format";
import { MAX_HISTORY } from "@/shared/history";
import { buildTradeUrl, gameLabel, leagueName, realmName, sameSearch, tradeTypeLabel } from "@/shared/location";
import { KEYS, write } from "@/shared/storage";
import type { HistoryEntry } from "@/shared/types";
import { openTradeUrl, useTrade } from "../bridge";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { useStored } from "../hooks";
import { wantsNewTab } from "../navigation";
import { openSaveDialog } from "../save-trade";

export function HistoryPage() {
  const { value: history, loaded } = useStored(KEYS.history);
  const { value: bookmarks } = useStored(KEYS.bookmarks);
  const location = useTrade((s) => s.location);
  const [clearing, setClearing] = useState(false);

  if (!loaded) return null;

  const bookmarked = (h: HistoryEntry) => bookmarks.folders.some((f) => f.trades.some((t) => sameSearch(t.location, h)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <p className="flex-1 text-label text-text-secondary">
          Последние поиски · <span className="font-mono">{history.length}</span> из {MAX_HISTORY}
        </p>
        <Button variant="danger-ghost" icon={Trash2} disabled={!history.length} onClick={() => setClearing(true)}>
          Очистить
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {history.length === 0 ? (
          <EmptyState icon={History} title="История пуста">
            Здесь появятся поиски, которые вы открывали на сайте торговли.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-0.5" aria-label="История поисков">
            {history.map((h) => {
              const current = Boolean(location && sameSearch(h, location) && location.league === h.league);
              const realm = realmName(h.league);
              const open = (newTab: boolean) => openTradeUrl(buildTradeUrl(h, h.league, { live: h.isLive }), newTab);
              return (
                <li
                  key={h.id}
                  className={cx(
                    "group flex items-center gap-0.5 rounded-md pr-0.5 transition-colors",
                    current ? "bg-bg-selected" : "hover:bg-bg-hover",
                  )}
                >
                  <button
                    type="button"
                    aria-current={current ? "page" : undefined}
                    onClick={(e) => open(wantsNewTab(e))}
                    onAuxClick={(e) => e.button === 1 && open(true)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md py-1.5 pl-2 text-left"
                  >
                    {h.isLive ? (
                      <Zap aria-label="live" size={16} className="mt-0.5 shrink-0 text-icon-accent" />
                    ) : (
                      <Search aria-hidden size={16} className="mt-0.5 shrink-0 text-icon-default" />
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className={cx("truncate text-body text-text-primary", current && "font-semibold")}>
                        {h.title || <span className="text-text-secondary">Без названия · {h.slug}</span>}
                      </span>
                      <span className="truncate text-label text-text-secondary">
                        {[gameLabel(h.version), realm, leagueName(h.league), h.type !== "search" ? tradeTypeLabel(h.type) : null, formatRelative(h.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {!bookmarked(h) && (
                    <IconButton
                      icon={BookmarkPlus}
                      label="Сохранить в закладки"
                      className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                      onClick={() => openSaveDialog({ location: { version: h.version, type: h.type, slug: h.slug }, title: h.title })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog open={clearing} onOpenChange={setClearing} title="Очистить историю?" confirmLabel="Очистить" onConfirm={() => void write(KEYS.history, [])}>
        <p>Список последних поисков будет удалён. Закладки останутся.</p>
      </ConfirmDialog>
    </div>
  );
}
