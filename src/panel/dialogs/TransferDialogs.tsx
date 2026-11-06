import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Banner, Button, cx, Dialog, Field, fieldClasses, toast } from "@/design-system";
import { gameLabel } from "@/shared/location";
import { plural } from "@/shared/format";
import { deserializeFolder, serializeFolder } from "@/shared/transfer";
import type { BookmarkFolder } from "@/shared/types";

const textareaClasses = cx(fieldClasses, "h-auto min-h-24 resize-none py-2 font-mono text-label break-all");

/** Экспорт папки: код, который можно отправить другу или вставить в Better Trading. */
export function ExportDialog({ folder, onOpenChange }: { folder: BookmarkFolder | null; onOpenChange: (open: boolean) => void }) {
  const code = useMemo(() => (folder ? serializeFolder(folder) : ""), [folder]);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [folder]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast({ status: "danger", title: "Не удалось скопировать", description: "Выделите код и скопируйте вручную (Ctrl+C)." });
    }
  };

  return (
    <Dialog
      open={folder !== null}
      onOpenChange={onOpenChange}
      title="Экспорт папки"
      description={folder ? `«${folder.title}» · ${folder.trades.length} ${plural(folder.trades.length, "закладка", "закладки", "закладок")}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button variant="primary" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? "Скопировано" : "Копировать код"}
          </Button>
        </>
      }
    >
      <Field label="Код папки" hint="Импортируется в poe-manager и в Better PathOfExile Trading.">
        {(p) => (
          <textarea
            id={p.id}
            aria-describedby={p.describedBy}
            readOnly
            value={code}
            rows={5}
            onFocus={(e) => e.currentTarget.select()}
            className={textareaClasses}
          />
        )}
      </Field>
    </Dialog>
  );
}

/** Импорт папки по коду (наш или Better Trading). */
export function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (folder: BookmarkFolder) => void;
}) {
  const [code, setCode] = useState("");
  useEffect(() => {
    if (open) setCode("");
  }, [open]);
  const folder = useMemo(() => deserializeFolder(code), [code]);
  const invalid = code.trim() !== "" && !folder;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Импорт папки"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!folder}
            onClick={() => {
              if (!folder) return;
              onImport(folder);
              onOpenChange(false);
            }}
          >
            Импортировать
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Код папки" error={invalid ? "Код не распознан: проверьте, что он скопирован целиком" : undefined}>
          {(p) => (
            <textarea
              id={p.id}
              aria-describedby={p.describedBy}
              aria-invalid={p.invalid || undefined}
              autoFocus
              rows={5}
              value={code}
              placeholder="3:eyJpY24iOi…"
              onChange={(e) => setCode(e.target.value)}
              className={textareaClasses}
            />
          )}
        </Field>
        {folder && (
          <Banner status="success" title={`«${folder.title}»`}>
            {gameLabel(folder.version)} · {folder.trades.length} {plural(folder.trades.length, "закладка", "закладки", "закладок")}
          </Banner>
        )}
      </div>
    </Dialog>
  );
}
