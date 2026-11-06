import { useEffect, useState } from "react";
import { Button, cx, Dialog, Field, IconButton, Input, SegmentedControl } from "@/design-system";
import { FOLDER_ICONS, type BookmarkFolder, type FolderIcon, type GameVersion } from "@/shared/types";
import { FOLDER_ICON_COMPONENTS } from "../folder-icons";

export type FolderDraft = { title: string; icon: FolderIcon; version: GameVersion };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Редактируемая папка; без неё — создание. */
  folder?: BookmarkFolder | null;
  defaultVersion: GameVersion;
  onSave: (draft: FolderDraft) => void;
};

export function FolderDialog({ open, onOpenChange, folder, defaultVersion, onSave }: Props) {
  const [draft, setDraft] = useState<FolderDraft>({ title: "", icon: "folder", version: defaultVersion });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(folder ? { title: folder.title, icon: folder.icon, version: folder.version } : { title: "", icon: "folder", version: defaultVersion });
    setTouched(false);
  }, [open, folder, defaultVersion]);

  const error = touched && !draft.title.trim() ? "Введите название папки" : undefined;
  const submit = () => {
    setTouched(true);
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={folder ? "Папка закладок" : "Новая папка"}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit}>
            {folder ? "Сохранить" : "Создать"}
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
        <Field label="Название" error={error}>
          {(p) => (
            <Input
              id={p.id}
              invalid={p.invalid}
              aria-describedby={p.describedBy}
              autoFocus
              maxLength={80}
              placeholder="Например: Билд на молнии"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Значок</span>
          <div role="radiogroup" aria-label="Значок папки" className="grid grid-cols-10 gap-0.5">
            {FOLDER_ICONS.map((id) => {
              const { icon, label } = FOLDER_ICON_COMPONENTS[id];
              const selected = draft.icon === id;
              return (
                <IconButton
                  key={id}
                  icon={icon}
                  label={label}
                  role="radio"
                  aria-checked={selected}
                  active={selected}
                  className={cx(selected && "bg-bg-selected")}
                  onClick={() => setDraft({ ...draft, icon: id })}
                />
              );
            })}
          </div>
        </div>

        {!folder && (
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Игра</span>
            <SegmentedControl
              aria-label="Версия игры"
              value={draft.version}
              onValueChange={(version) => setDraft({ ...draft, version })}
              options={[
                { value: "1", label: "Path of Exile" },
                { value: "2", label: "Path of Exile 2" },
              ]}
              className="self-start"
            />
            <p className="text-label text-text-secondary">Папка видна на сайте торговли своей игры.</p>
          </div>
        )}
      </form>
    </Dialog>
  );
}
