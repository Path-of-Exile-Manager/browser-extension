// «Сохранить поиск» вызывается из нескольких мест (шапка, папка, история), поэтому диалог один
// на всю панель, а открывают его через маленькое хранилище.
import { useMemo } from "react";
import { create } from "zustand";
import { toast } from "@/design-system";
import { addFolder, addTrade, mutateBookmarks, newFolder, newTrade } from "@/shared/bookmarks";
import { KEYS, update } from "@/shared/storage";
import type { BookmarkLocation } from "@/shared/types";
import { TradeDialog, type TradeDraft } from "./dialogs/TradeDialog";
import { useStored } from "./hooks";

type SaveRequest = { location: BookmarkLocation; title: string; folderId?: string | null };

export const useSaveDialog = create<{ request: SaveRequest | null }>(() => ({ request: null }));

export function openSaveDialog(request: SaveRequest) {
  useSaveDialog.setState({ request });
}

export function SaveTradeDialogHost() {
  const request = useSaveDialog((s) => s.request);
  const { value: bookmarks } = useStored(KEYS.bookmarks);
  const folders = useMemo(
    () => (request ? bookmarks.folders.filter((f) => f.version === request.location.version && !f.archivedAt) : []),
    [request, bookmarks],
  );

  const save = async ({ title, folderId, newFolderTitle }: TradeDraft) => {
    if (!request) return;
    let targetId = folderId;
    let folderTitle = folders.find((f) => f.id === folderId)?.title ?? "";
    await mutateBookmarks((data) => {
      let next = data;
      if (!targetId) {
        const folder = newFolder({ title: newFolderTitle, icon: "folder", version: request.location.version });
        targetId = folder.id;
        folderTitle = folder.title;
        next = addFolder(next, folder);
      }
      return addTrade(next, targetId, newTrade(title, request.location));
    });
    // Показать, куда сохранили.
    await update(KEYS.settings, (s) =>
      targetId && !s.expandedFolderIds.includes(targetId)
        ? { ...s, tab: "bookmarks", expandedFolderIds: [...s.expandedFolderIds, targetId] }
        : { ...s, tab: "bookmarks" },
    );
    toast({ status: "success", title: "Поиск сохранён", description: `«${title}» в папке «${folderTitle}»` });
  };

  return (
    <TradeDialog
      open={request !== null}
      onOpenChange={(open) => !open && useSaveDialog.setState({ request: null })}
      mode="create"
      location={request?.location ?? null}
      initialTitle={request?.title ?? ""}
      initialFolderId={request?.folderId}
      folders={folders}
      onSave={(draft) => void save(draft)}
    />
  );
}
