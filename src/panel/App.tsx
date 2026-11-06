import { useEffect, useState } from "react";
import { ArrowLeft, BookmarkCheck, BookmarkPlus, ChevronsRight, Plug, Settings, Unplug, Zap } from "lucide-react";
import { AppLogo, Badge, Banner, Button, cx, IconButton, STATUS_CLASSES, Tabs } from "@/design-system";
import { describeBridge, useBridgeStatus } from "./bridge-status";
import { findTradeByLocation } from "@/shared/bookmarks";
import { gameLabel, isConcreteSearch, leagueName, realmName, toBookmarkLocation, tradeTypeLabel } from "@/shared/location";
import { KEYS, updateSettings } from "@/shared/storage";
import type { PanelTab } from "@/shared/types";
import { collapsePanel, useTrade } from "./bridge";
import { useStored } from "./hooks";
import { BookmarksPage } from "./pages/BookmarksPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PinsPage } from "./pages/PinsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { openSaveDialog, SaveTradeDialogHost } from "./save-trade";

export function App() {
  const [view, setView] = useState<"main" | "settings">("main");
  const { value: settings, loaded } = useStored(KEYS.settings);
  const { value: pins } = useStored(KEYS.pins);
  const { value: history } = useStored(KEYS.history);

  const tabs: { value: PanelTab; label: string }[] = [
    { value: "bookmarks", label: "Закладки" },
    { value: "history", label: history.length ? `История · ${history.length}` : "История" },
    { value: "pins", label: pins.length ? `Закреплённые · ${pins.length}` : "Закреплённые" },
  ];

  return (
    <div className="flex h-full flex-col bg-bg-surface text-text-primary">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border-subtle pr-1.5 pl-3">
        {view === "settings" ? (
          <>
            <IconButton icon={ArrowLeft} label="Назад" tooltip={false} className="-ml-1.5" onClick={() => setView("main")} />
            <h1 className="flex-1 text-body font-semibold">Настройки</h1>
          </>
        ) : (
          <>
            <AppLogo size={20} />
            <h1 className="ml-1.5 flex-1 text-body font-semibold">poe-manager</h1>
            <BridgeIndicator onClick={() => setView("settings")} />
            <IconButton icon={Settings} label="Настройки" onClick={() => setView("settings")} />
          </>
        )}
        <IconButton icon={ChevronsRight} label="Свернуть панель" tooltip="Свернуть панель — вернуть её можно ярлыком у правого края" onClick={collapsePanel} />
      </header>

      {view === "settings" ? (
        <SettingsPage />
      ) : (
        <>
          <ContextBar />
          {loaded && (
            <>
              <Tabs
                aria-label="Разделы"
                value={settings.tab}
                onValueChange={(tab) => void updateSettings({ tab: tab as PanelTab })}
                items={tabs}
                className="shrink-0 px-3"
              />
              {settings.tab === "bookmarks" && <BookmarksPage />}
              {settings.tab === "history" && <HistoryPage />}
              {settings.tab === "pins" && <PinsPage />}
            </>
          )}
        </>
      )}
      <SaveTradeDialogHost />
    </div>
  );
}

/**
 * Значок связи с приложением в шапке. Статус — значком и цветом статуса, текст — в подсказке и aria-label
 * (guide.md: статус всегда с иконкой). Клик ведёт в настройки, где статус расписан подробно.
 */
function BridgeIndicator({ onClick }: { onClick: () => void }) {
  const view = describeBridge(useBridgeStatus());
  const connected = view.status === "success";
  return (
    <IconButton
      icon={connected ? Plug : Unplug}
      label={view.label}
      tooltip={
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{view.label}</span>
          <span className="text-text-secondary">{view.hint}</span>
        </span>
      }
      className={cx(STATUS_CLASSES[view.status].fg, "enabled:hover:text-current")}
      onClick={onClick}
    />
  );
}

/** Где мы на сайте и кнопка «Сохранить поиск». */
function ContextBar() {
  const { connected, location, recommendedTitle } = useTrade();
  const { value: bookmarks } = useStored(KEYS.bookmarks);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!connected || !location) {
    if (!waited) return <div className="h-14 shrink-0 border-b border-border-subtle" />;
    return (
      <div className="shrink-0 border-b border-border-subtle p-3">
        <Banner status="info" title="Нет связи с сайтом торговли">
          Панель работает на pathofexile.com/trade. Обновите страницу сайта, если она уже открыта.
        </Banner>
      </div>
    );
  }

  const search = isConcreteSearch(location) ? toBookmarkLocation(location) : null;
  const saved = search ? findTradeByLocation(bookmarks, location) : null;
  const league = leagueName(location.league);
  const realm = realmName(location.league);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border-subtle px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-label text-text-secondary">
        <Badge tone="muted">{gameLabel(location.version)}</Badge>
        {realm && <Badge tone="muted">{realm}</Badge>}
        <span className="min-w-0 truncate">{[league ?? "Лига не выбрана", search ? tradeTypeLabel(location.type) : null].filter(Boolean).join(" · ")}</span>
        {location.isLive && (
          <Badge className="ml-auto border-accent-border text-text-accent">
            <Zap aria-hidden size={12} />
            live
          </Badge>
        )}
      </div>

      {!search ? (
        <p className="text-label text-text-secondary">Откройте поиск, чтобы сохранить его в закладки.</p>
      ) : saved ? (
        <div className="flex min-w-0 items-center gap-2">
          <BookmarkCheck aria-hidden size={16} className="shrink-0 text-icon-accent" />
          <span className="min-w-0 flex-1 truncate text-body" title={`${saved.folder.title} / ${saved.trade.title}`}>
            <span className="text-text-secondary">{saved.folder.title} / </span>
            <span className="font-semibold">{saved.trade.title}</span>
          </span>
          <IconButton
            icon={BookmarkPlus}
            label="Сохранить ещё и в другую папку"
            className="-my-1"
            onClick={() => openSaveDialog({ location: search, title: recommendedTitle })}
          />
        </div>
      ) : (
        <Button variant="primary" icon={BookmarkPlus} className="w-full" onClick={() => openSaveDialog({ location: search, title: recommendedTitle })}>
          Сохранить поиск
        </Button>
      )}
    </div>
  );
}
