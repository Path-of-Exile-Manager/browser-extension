import { useMemo, useState, type DragEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookmarkPlus,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Ellipsis,
  ExternalLink,
  FileDown,
  FileUp,
  FolderPlus,
  ListCollapse,
  Pencil,
  RefreshCw,
  SquareCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { Button, cx, EmptyState, IconButton, Menu, SearchInput, toast, type MenuEntry } from "@/design-system";
import {
  addFolder,
  deleteFolder,
  deleteTrade,
  moveFolder,
  moveTrade,
  mutateBookmarks,
  newFolder,
  toggleFolderArchive,
  toggleTradeCompletion,
  updateFolder,
  updateTrade,
} from "@/shared/bookmarks";
import { plural } from "@/shared/format";
import { gameLabel, isConcreteSearch, sameSearch, toBookmarkLocation, tradeTypeLabel } from "@/shared/location";
import { KEYS, updateSettings } from "@/shared/storage";
import type { BookmarkFolder, BookmarkTrade } from "@/shared/types";
import { useTrade } from "../bridge";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { FolderDialog } from "../dialogs/FolderDialog";
import { TradeDialog } from "../dialogs/TradeDialog";
import { ExportDialog, ImportDialog } from "../dialogs/TransferDialogs";
import { FOLDER_ICON_COMPONENTS } from "../folder-icons";
import { useGameVersion, useStored } from "../hooks";
import { openBookmark, tradeUrlFor, wantsNewTab } from "../navigation";
import { openSaveDialog } from "../save-trade";

const DRAG_FOLDER = "application/x-poe-manager-folder";
const DRAG_TRADE = "application/x-poe-manager-trade";

type DropTarget = { kind: "folder" | "trade"; id: string } | null;

export function BookmarksPage() {
  const { value: data, loaded } = useStored(KEYS.bookmarks);
  const { value: settings } = useStored(KEYS.settings);
  const version = useGameVersion();
  const location = useTrade((s) => s.location);
  const recommendedTitle = useTrade((s) => s.recommendedTitle);

  const [query, setQuery] = useState("");
  const [folderDialog, setFolderDialog] = useState<{ folder: BookmarkFolder | null } | null>(null);
  const [editTrade, setEditTrade] = useState<BookmarkTrade | null>(null);
  const [deleting, setDeleting] = useState<{ folder: BookmarkFolder } | { trade: BookmarkTrade } | null>(null);
  const [exporting, setExporting] = useState<BookmarkFolder | null>(null);
  const [importing, setImporting] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const showArchived = settings.showArchived;
  const ofVersion = data.folders.filter((f) => f.version === version);
  const archivedCount = ofVersion.filter((f) => f.archivedAt).length;
  const otherVersionCount = data.folders.length - ofVersion.length;
  const listed = ofVersion.filter((f) => Boolean(f.archivedAt) === showArchived);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return listed.map((folder) => ({ folder, trades: folder.trades }));
    return listed
      .map((folder) => ({
        folder,
        trades: folder.title.toLowerCase().includes(needle) ? folder.trades : folder.trades.filter((t) => t.title.toLowerCase().includes(needle)),
      }))
      .filter((v) => v.trades.length > 0 || v.folder.title.toLowerCase().includes(needle));
  }, [listed, needle]);

  const currentSearch = location && isConcreteSearch(location) ? toBookmarkLocation(location) : null;
  const expanded = new Set(settings.expandedFolderIds);
  const toggleExpanded = (id: string) =>
    void updateSettings({
      expandedFolderIds: expanded.has(id) ? settings.expandedFolderIds.filter((x) => x !== id) : [...settings.expandedFolderIds, id],
    });

  // ---------- перетаскивание ----------
  const onDragOver = (event: DragEvent, target: NonNullable<DropTarget>) => {
    const types = event.dataTransfer.types;
    const ok = types.includes(DRAG_TRADE) || (target.kind === "folder" && types.includes(DRAG_FOLDER));
    if (!ok) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTarget?.id !== target.id) setDropTarget(target);
  };
  const onDrop = (event: DragEvent, target: NonNullable<DropTarget>, folderId: string) => {
    event.preventDefault();
    setDropTarget(null);
    const folderDrag = event.dataTransfer.getData(DRAG_FOLDER);
    const tradeDrag = event.dataTransfer.getData(DRAG_TRADE);
    if (folderDrag && target.kind === "folder") void mutateBookmarks((d) => moveFolder(d, folderDrag, target.id));
    else if (tradeDrag) void mutateBookmarks((d) => moveTrade(d, tradeDrag, folderId, target.kind === "trade" ? target.id : null));
  };

  // ---------- действия ----------
  const folderMenu = (folder: BookmarkFolder): MenuEntry[] => [
    { label: "Изменить…", icon: Pencil, onSelect: () => setFolderDialog({ folder }) },
    { label: "Экспорт…", icon: FileUp, onSelect: () => setExporting(folder) },
    folder.archivedAt
      ? { label: "Вернуть из архива", icon: ArchiveRestore, onSelect: () => void mutateBookmarks((d) => toggleFolderArchive(d, folder.id)) }
      : { label: "В архив", icon: Archive, onSelect: () => void mutateBookmarks((d) => toggleFolderArchive(d, folder.id)) },
    { type: "separator" },
    { label: "Удалить…", icon: Trash2, onSelect: () => setDeleting({ folder }) },
  ];

  const tradeMenu = (trade: BookmarkTrade): MenuEntry[] => {
    const canReplace = currentSearch && currentSearch.version === trade.location.version && !sameSearch(currentSearch, trade.location);
    return [
      { label: "Открыть в новой вкладке", icon: ExternalLink, onSelect: () => void openBookmark(trade.location, { newTab: true }) },
      {
        label: "Копировать ссылку",
        icon: Copy,
        onSelect: async () => {
          try {
            await navigator.clipboard.writeText(await tradeUrlFor(trade.location));
            toast({ status: "success", title: "Ссылка скопирована" });
          } catch {
            toast({ status: "danger", title: "Не удалось скопировать ссылку" });
          }
        },
      },
      ...(canReplace
        ? [
            {
              label: "Заменить текущим поиском",
              icon: RefreshCw,
              onSelect: () => {
                void mutateBookmarks((d) => updateTrade(d, trade.id, { location: currentSearch }));
                toast({ status: "success", title: "Закладка обновлена", description: `«${trade.title}» теперь ведёт на открытый поиск` });
              },
            } satisfies MenuEntry,
          ]
        : []),
      {
        label: trade.completedAt ? "Снять отметку «выполнено»" : "Отметить выполненной",
        icon: SquareCheck,
        onSelect: () => void mutateBookmarks((d) => toggleTradeCompletion(d, trade.id)),
      },
      { label: "Переименовать…", icon: Pencil, onSelect: () => setEditTrade(trade) },
      { type: "separator" },
      { label: "Удалить…", icon: Trash2, onSelect: () => setDeleting({ trade }) },
    ];
  };

  const toolbarMenu: MenuEntry[] = [
    { label: "Импорт папки по коду…", icon: FileDown, onSelect: () => setImporting(true) },
    { label: "Свернуть все папки", icon: ListCollapse, onSelect: () => void updateSettings({ expandedFolderIds: [] }) },
    { type: "separator" },
    showArchived
      ? { label: "К активным папкам", icon: ArrowLeft, onSelect: () => void updateSettings({ showArchived: false }) }
      : { label: `Архив (${archivedCount})`, icon: Archive, disabled: archivedCount === 0, onSelect: () => void updateSettings({ showArchived: true }) },
  ];

  if (!loaded) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-3 pt-3 pb-2">
        <SearchInput value={query} onValueChange={setQuery} label="Искать в закладках" placeholder="Искать в закладках" />
        <IconButton icon={FolderPlus} label="Новая папка" onClick={() => setFolderDialog({ folder: null })} />
        <Menu trigger={<IconButton icon={Ellipsis} label="Ещё" tooltip={false} />} items={toolbarMenu} align="end" />
      </div>

      {showArchived && (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
          <Button variant="ghost" icon={ArrowLeft} className="-ml-2" onClick={() => void updateSettings({ showArchived: false })}>
            Активные папки
          </Button>
          <span className="ml-auto text-label text-text-secondary">Архив · {archivedCount}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" onDragLeave={(e) => e.currentTarget === e.target && setDropTarget(null)}>
        {visible.length === 0 ? (
          needle ? (
            <EmptyState icon={Bookmark} title="Ничего не найдено">
              Нет папок и закладок с «{query.trim()}».
            </EmptyState>
          ) : showArchived ? (
            <EmptyState icon={Archive} title="Архив пуст" />
          ) : (
            <EmptyState
              icon={Bookmark}
              title={`Закладок ${gameLabel(version)} пока нет`}
              action={
                // Основная кнопка «Сохранить поиск» — в шапке панели; здесь только вторичное действие.
                <Button icon={FolderPlus} onClick={() => setFolderDialog({ folder: null })}>
                  Новая папка
                </Button>
              }
            >
              {currentSearch ? "Нажмите «Сохранить поиск» вверху" : "Откройте поиск на сайте и сохраните его в папку"}. Закладки из Better
              Trading переносятся через «Настройки → Резервная копия».
            </EmptyState>
          )
        ) : (
          <ul className="flex flex-col gap-0.5" aria-label="Папки закладок">
            {visible.map(({ folder, trades }) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                trades={trades}
                expanded={Boolean(needle) || expanded.has(folder.id)}
                onToggle={() => toggleExpanded(folder.id)}
                menu={folderMenu(folder)}
                tradeMenu={tradeMenu}
                canSaveCurrent={Boolean(currentSearch && currentSearch.version === folder.version && !folder.archivedAt)}
                onSaveCurrent={() => currentSearch && openSaveDialog({ location: currentSearch, title: recommendedTitle, folderId: folder.id })}
                isCurrent={(t) => Boolean(location && sameSearch(t.location, location))}
                isCurrentLive={(t) => Boolean(location?.isLive && sameSearch(t.location, location))}
                dropTarget={dropTarget}
                onDragOver={onDragOver}
                onDrop={onDrop}
                draggable={!needle}
              />
            ))}
          </ul>
        )}

        {!showArchived && otherVersionCount > 0 && !needle && (
          <p className="px-2 pt-4 text-label text-text-secondary">
            Ещё {otherVersionCount} {plural(otherVersionCount, "папка", "папки", "папок")} для {gameLabel(version === "1" ? "2" : "1")} — видны на
            сайте торговли той игры.
          </p>
        )}
      </div>

      <FolderDialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
        folder={folderDialog?.folder ?? null}
        defaultVersion={version}
        onSave={(draft) => {
          const editing = folderDialog?.folder;
          if (editing) void mutateBookmarks((d) => updateFolder(d, editing.id, { title: draft.title, icon: draft.icon }));
          else {
            const folder = newFolder(draft);
            void mutateBookmarks((d) => addFolder(d, folder));
            void updateSettings({ expandedFolderIds: [...settings.expandedFolderIds, folder.id] });
          }
        }}
      />

      <TradeDialog
        open={editTrade !== null}
        onOpenChange={(open) => !open && setEditTrade(null)}
        mode="edit"
        location={editTrade?.location ?? null}
        initialTitle={editTrade?.title ?? ""}
        folders={EMPTY}
        onSave={({ title }) => editTrade && void mutateBookmarks((d) => updateTrade(d, editTrade.id, { title }))}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting && "folder" in deleting ? "Удалить папку?" : "Удалить закладку?"}
        confirmLabel="Удалить"
        onConfirm={() => {
          if (!deleting) return;
          if ("folder" in deleting) void mutateBookmarks((d) => deleteFolder(d, deleting.folder.id));
          else void mutateBookmarks((d) => deleteTrade(d, deleting.trade.id));
        }}
      >
        {deleting && "folder" in deleting ? (
          <p>
            Папка «{deleting.folder.title}»
            {deleting.folder.trades.length > 0 &&
              ` и ${deleting.folder.trades.length} ${plural(deleting.folder.trades.length, "закладка", "закладки", "закладок")} в ней`}{" "}
            будут удалены. Чтобы сохранить копию, сначала сделайте экспорт.
          </p>
        ) : deleting ? (
          <p>Закладка «{deleting.trade.title}» будет удалена.</p>
        ) : null}
      </ConfirmDialog>

      <ExportDialog folder={exporting} onOpenChange={(open) => !open && setExporting(null)} />
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onImport={(folder) => {
          void mutateBookmarks((d) => addFolder(d, folder));
          void updateSettings({ showArchived: false });
          toast({
            status: "success",
            title: "Папка импортирована",
            description:
              folder.version === version
                ? `«${folder.title}»`
                : `«${folder.title}» — папка ${gameLabel(folder.version)}, она видна на сайте торговли той игры.`,
          });
        }}
      />
    </div>
  );
}

const EMPTY: BookmarkFolder[] = [];

type FolderItemProps = {
  folder: BookmarkFolder;
  trades: BookmarkTrade[];
  expanded: boolean;
  onToggle: () => void;
  menu: MenuEntry[];
  tradeMenu: (trade: BookmarkTrade) => MenuEntry[];
  canSaveCurrent: boolean;
  onSaveCurrent: () => void;
  isCurrent: (t: BookmarkTrade) => boolean;
  isCurrentLive: (t: BookmarkTrade) => boolean;
  dropTarget: DropTarget;
  onDragOver: (event: DragEvent, target: NonNullable<DropTarget>) => void;
  onDrop: (event: DragEvent, target: NonNullable<DropTarget>, folderId: string) => void;
  draggable: boolean;
};

/** Линия «сюда упадёт» над элементом: акцент — интерактивное состояние. */
const dropLine = "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-accent-solid";

function FolderItem(p: FolderItemProps) {
  const { folder, trades, expanded } = p;
  const Icon = FOLDER_ICON_COMPONENTS[folder.icon]?.icon ?? FOLDER_ICON_COMPONENTS.folder.icon;
  const done = folder.trades.filter((t) => t.completedAt).length;
  const target = { kind: "folder" as const, id: folder.id };

  return (
    <li className="flex flex-col">
      <div
        draggable={p.draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_FOLDER, folder.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => p.onDragOver(e, target)}
        onDrop={(e) => p.onDrop(e, target, folder.id)}
        className={cx(
          "group relative flex h-row-height items-center gap-0.5 rounded-md pr-0.5 transition-colors hover:bg-bg-hover",
          p.dropTarget?.id === folder.id && dropLine,
        )}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={p.onToggle}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-1.5 text-left"
        >
          <ChevronRight aria-hidden size={14} className={cx("shrink-0 text-icon-default transition-transform", expanded && "rotate-90")} />
          <Icon aria-hidden size={16} className="shrink-0 text-icon-strong" />
          <span className="min-w-0 truncate text-body font-medium text-text-primary">{folder.title}</span>
          <span className="shrink-0 font-mono text-label text-text-secondary" title={`${folder.trades.length} закладок, выполнено ${done}`}>
            {done > 0 ? `${done}/${folder.trades.length}` : folder.trades.length}
          </span>
        </button>
        {p.canSaveCurrent && (
          <IconButton
            icon={BookmarkPlus}
            label="Сохранить открытый поиск в эту папку"
            className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            onClick={p.onSaveCurrent}
          />
        )}
        <Menu trigger={<IconButton icon={Ellipsis} label={`Действия с папкой «${folder.title}»`} tooltip={false} />} items={p.menu} align="end" />
      </div>

      {expanded && (
        <ul className="flex flex-col pb-1" aria-label={folder.title}>
          {trades.length === 0 ? (
            <li
              onDragOver={(e) => p.onDragOver(e, target)}
              onDrop={(e) => p.onDrop(e, target, folder.id)}
              className="py-1.5 pl-9 text-label text-text-secondary"
            >
              Пусто. Откройте поиск и нажмите <BookmarkPlus aria-label="«Сохранить»" size={14} className="inline align-text-bottom" />.
            </li>
          ) : (
            trades.map((trade) => (
              <TradeItem
                key={trade.id}
                trade={trade}
                folderId={folder.id}
                current={p.isCurrent(trade)}
                currentLive={p.isCurrentLive(trade)}
                menu={p.tradeMenu(trade)}
                dropActive={p.dropTarget?.id === trade.id}
                onDragOver={p.onDragOver}
                onDrop={p.onDrop}
                draggable={p.draggable}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

type TradeItemProps = {
  trade: BookmarkTrade;
  folderId: string;
  current: boolean;
  currentLive: boolean;
  menu: MenuEntry[];
  dropActive: boolean;
  onDragOver: FolderItemProps["onDragOver"];
  onDrop: FolderItemProps["onDrop"];
  draggable: boolean;
};

function TradeItem({ trade, folderId, current, currentLive, menu, dropActive, onDragOver, onDrop, draggable }: TradeItemProps) {
  const completed = Boolean(trade.completedAt);
  const target = { kind: "trade" as const, id: trade.id };
  const subtitle = trade.location.type !== "search" ? tradeTypeLabel(trade.location.type) : null;
  const open = (newTab: boolean) => void openBookmark(trade.location, { newTab });

  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TRADE, trade.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => onDragOver(e, target)}
      onDrop={(e) => onDrop(e, target, folderId)}
      className={cx(
        "group relative flex min-h-row-height items-center gap-0.5 rounded-md pr-0.5 transition-colors",
        current ? "bg-bg-selected" : "hover:bg-bg-hover",
        dropActive && dropLine,
      )}
    >
      <button
        type="button"
        aria-current={current ? "page" : undefined}
        title={trade.title}
        onClick={(e) => open(wantsNewTab(e))}
        onAuxClick={(e) => e.button === 1 && open(true)}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md py-1 pl-9 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span
            className={cx(
              "truncate text-body",
              completed ? "text-text-secondary line-through" : "text-text-primary",
              current && "font-semibold",
            )}
          >
            {trade.title || "Без названия"}
          </span>
          {subtitle && <span className="truncate text-label text-text-secondary">{subtitle}</span>}
        </span>
        {completed && <Check aria-label="выполнено" size={14} className="shrink-0 text-status-success-fg" />}
      </button>
      <IconButton
        icon={Zap}
        label={currentLive ? "Live-поиск открыт" : "Открыть live-поиск"}
        active={currentLive}
        className={cx(!currentLive && "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100")}
        onClick={(e) => void openBookmark(trade.location, { live: true, newTab: wantsNewTab(e) })}
      />
      <Menu trigger={<IconButton icon={Ellipsis} label={`Действия с закладкой «${trade.title}»`} tooltip={false} />} items={menu} align="end" />
    </li>
  );
}

