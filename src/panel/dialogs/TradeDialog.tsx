import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Field, Input, Select } from "@/design-system";
import { gameLabel, tradeTypeLabel } from "@/shared/location";
import type { BookmarkFolder, BookmarkLocation } from "@/shared/types";

const NEW_FOLDER = "__new__";

export type TradeDraft = {
  title: string;
  /** Существующая папка или `null` — создать новую с именем `newFolderTitle`. */
  folderId: string | null;
  newFolderTitle: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  location: BookmarkLocation | null;
  initialTitle: string;
  /** Папки, куда можно сохранить (той же версии игры, не из архива). */
  folders: BookmarkFolder[];
  initialFolderId?: string | null;
  onSave: (draft: TradeDraft) => void;
};

export function TradeDialog({ open, onOpenChange, mode, location, initialTitle, folders, initialFolderId, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string>(NEW_FOLDER);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setFolderId(initialFolderId ?? folders[0]?.id ?? NEW_FOLDER);
    setNewFolderTitle(folders.length ? "" : "Закладки");
    setTouched(false);
  }, [open, initialTitle, initialFolderId, folders]);

  const options = useMemo(
    () => [...folders.map((f) => ({ value: f.id, label: f.title })), { value: NEW_FOLDER, label: "Новая папка…" }],
    [folders],
  );

  const titleError = touched && !title.trim() ? "Введите название" : undefined;
  const folderError = touched && folderId === NEW_FOLDER && !newFolderTitle.trim() ? "Введите название папки" : undefined;

  const submit = () => {
    setTouched(true);
    if (!title.trim() || (folderId === NEW_FOLDER && !newFolderTitle.trim())) return;
    onSave({ title: title.trim(), folderId: folderId === NEW_FOLDER ? null : folderId, newFolderTitle: newFolderTitle.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Сохранить поиск" : "Закладка"}
      description={location ? `${gameLabel(location.version)} · ${tradeTypeLabel(location.type)} · ${location.slug}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Название" error={titleError} hint={mode === "create" ? "Подставлено из формы поиска — можно изменить." : undefined}>
          {(p) => (
            <Input
              id={p.id}
              invalid={p.invalid}
              aria-describedby={p.describedBy}
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Кольцо на резисты"
            />
          )}
        </Field>
        {mode === "create" && (
          <>
            <Field label="Папка">
              {(p) => <Select id={p.id} value={folderId} onValueChange={setFolderId} options={options} />}
            </Field>
            {folderId === NEW_FOLDER && (
              <Field label="Название новой папки" error={folderError}>
                {(p) => (
                  <Input
                    id={p.id}
                    invalid={p.invalid}
                    aria-describedby={p.describedBy}
                    maxLength={80}
                    value={newFolderTitle}
                    onChange={(e) => setNewFolderTitle(e.target.value)}
                  />
                )}
              </Field>
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}
