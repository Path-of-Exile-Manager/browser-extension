import { useRef, type ReactNode } from "react";
import { FileDown, FileUp } from "lucide-react";
import { AppLogo, Banner, Button, groupLabelClasses, Switch, toast } from "@/design-system";
import { describeBridge, useBridgeStatus } from "../bridge-status";
import { mutateBookmarks } from "@/shared/bookmarks";
import { plural } from "@/shared/format";
import { KEYS, read, updateSettings } from "@/shared/storage";
import { generateBackup, restoreBackup } from "@/shared/transfer";
import { ENHANCERS, type EnhancerId } from "@/shared/types";
import { useStored } from "../hooks";

declare const __EXT_VERSION__: string;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle px-3 py-4 last:border-b-0">
      <h2 className={groupLabelClasses}>{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { value: settings } = useStored(KEYS.settings);
  const bridge = describeBridge(useBridgeStatus());
  const fileInput = useRef<HTMLInputElement>(null);

  const toggleEnhancer = (id: EnhancerId, enabled: boolean) => {
    const disabled = new Set(settings.disabledEnhancers);
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    void updateSettings({ disabledEnhancers: [...disabled] });
  };

  const saveBackup = async () => {
    const { folders } = await read(KEYS.bookmarks);
    const blob = new Blob([generateBackup(folders)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poe-manager-bookmarks-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restore = async (file: File) => {
    const text = await file.text();
    let summary = { added: 0, skipped: 0, invalid: 0 };
    await mutateBookmarks((data) => {
      const result = restoreBackup(data.folders, text);
      summary = result;
      return { folders: result.folders };
    });
    if (summary.added === 0 && summary.skipped === 0) {
      toast({ status: "danger", title: "Файл не распознан", description: "Нужен файл резервной копии poe-manager или Better PathOfExile Trading." });
      return;
    }
    toast({
      status: "success",
      title: summary.added ? `Восстановлено ${summary.added} ${plural(summary.added, "папка", "папки", "папок")}` : "Новых папок нет",
      description: [
        summary.skipped && `${summary.skipped} уже были — пропущены`,
        summary.invalid && `${summary.invalid} не распознаны`,
      ]
        .filter(Boolean)
        .join(", ") || undefined,
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Section title="Приложение poe-manager">
        <Banner status={bridge.status} title={bridge.label}>
          {bridge.hint}
        </Banner>
      </Section>

      <Section title="Улучшения результатов поиска">
        <div className="flex flex-col gap-3">
          {ENHANCERS.map((e) => (
            <div key={e.id} className="flex flex-col gap-0.5">
              <Switch
                checked={!settings.disabledEnhancers.includes(e.id)}
                onCheckedChange={(checked) => toggleEnhancer(e.id, checked)}
                label={e.label}
              />
              {e.hint && <p className="pl-9 text-label text-text-secondary">{e.hint}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Резервная копия закладок">
        <p className="text-label text-text-secondary">
          Файл совместим с Better PathOfExile Trading: сохраните копию там («Backup tools → Save file») и восстановите здесь — папки
          добавятся к существующим, повторы пропускаются.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button icon={FileDown} onClick={() => void saveBackup()}>
            Сохранить в файл
          </Button>
          <Button icon={FileUp} onClick={() => fileInput.current?.click()}>
            Восстановить из файла
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void restore(file);
            }}
          />
        </div>
      </Section>

      <Section title="О расширении">
        <div className="flex items-center gap-2.5">
          <AppLogo size={32} />
          <div className="flex flex-col">
            <span className="text-body font-semibold text-text-primary">poe-manager для сайта торговли</span>
            <span className="font-mono text-label text-text-secondary">версия {__EXT_VERSION__}</span>
          </div>
        </div>
        <p className="text-label text-text-secondary">
          Закладки, история и закреплённые лоты хранятся в этом браузере. Идеи функций — Better PathOfExile
          Trading (InfaMc, brosmike).
        </p>
        <p className="text-label text-text-secondary">Фанатский проект, не связан с Grinding Gear Games.</p>
      </Section>
    </div>
  );
}
