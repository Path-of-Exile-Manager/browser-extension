import { useState } from "react";
import { Crosshair, ExternalLink, Pin, PinOff, Trash2 } from "lucide-react";
import { Button, Card, CardSection, EmptyState, IconButton, ItemHeader, ItemIcon, ItemStateBadge, ModLine } from "@/design-system";
import { formatNumber, formatRelative, plural } from "@/shared/format";
import { buildTradeUrl, isConcreteSearch, leagueName } from "@/shared/location";
import { KEYS, update, write } from "@/shared/storage";
import type { PinnedItem } from "@/shared/types";
import { openTradeUrl, revealItem, useTrade } from "../bridge";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { useStored } from "../hooks";

export function PinsPage() {
  const { value: pins, loaded } = useStored(KEYS.pins);
  const visibleIds = useTrade((s) => s.visibleItemIds);
  const [clearing, setClearing] = useState(false);

  if (!loaded) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <p className="flex-1 text-label text-text-secondary">
          {pins.length ? `${pins.length} ${plural(pins.length, "лот", "лота", "лотов")} для сравнения` : "Лоты для сравнения"}
        </p>
        <Button variant="danger-ghost" icon={Trash2} disabled={!pins.length} onClick={() => setClearing(true)}>
          Открепить все
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {pins.length === 0 ? (
          <EmptyState icon={Pin} title="Нет закреплённых лотов">
            Нажмите «Закрепить» у лота в результатах поиска — он появится здесь и останется после перезагрузки страницы.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Закреплённые лоты">
            {pins.map((pin) => (
              <li key={pin.id}>
                <PinCard pin={pin} visible={visibleIds.includes(pin.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog open={clearing} onOpenChange={setClearing} title="Открепить все лоты?" confirmLabel="Открепить все" onConfirm={() => void write(KEYS.pins, [])}>
        <p>Список закреплённых лотов будет очищен.</p>
      </ConfirmDialog>
    </div>
  );
}

function PinCard({ pin, visible }: { pin: PinnedItem; visible: boolean }) {
  const { item, price, seller, location } = pin;
  const unpin = () => void update(KEYS.pins, (all) => all.filter((p) => p.id !== pin.id));
  const searchUrl = isConcreteSearch(location) ? buildTradeUrl(location, location.league) : null;

  return (
    <Card>
      <CardSection className="flex flex-col gap-2.5">
        <div className="flex gap-3">
          <ItemIcon variant="thumb" size={item.size ?? [2, 4]} src={item.iconUrl} alt={item.name ?? item.baseType} />
          <ItemHeader item={item} aside={formatRelative(pin.pinnedAt)} className="flex-1" />
        </div>

        {item.mods.length > 0 && (
          <div className="flex flex-col gap-1">
            {item.mods.map((mod, i) => (
              <ModLine key={i} mod={mod} size="sm" showTier={false} />
            ))}
          </div>
        )}

        {item.states?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {item.states.map((s) => (
              <ItemStateBadge key={s} state={s} />
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border-subtle pt-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            {price ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-body font-semibold text-text-primary">{formatNumber(price.amount)}</span>
                {price.iconUrl && <img src={price.iconUrl} alt="" width={16} height={16} className="shrink-0" />}
                <span className="truncate text-body text-text-secondary">{price.currency}</span>
              </span>
            ) : (
              <span className="text-label text-text-secondary">Цена не указана</span>
            )}
            <span className="truncate text-label text-text-secondary" title={pin.searchTitle}>
              {[seller?.character && `IGN ${seller.character}`, pin.searchTitle || leagueName(location.league)].filter(Boolean).join(" · ")}
            </span>
          </div>
          {visible && <IconButton icon={Crosshair} label="Показать в результатах" onClick={() => revealItem(pin.id)} />}
          {searchUrl && (
            <IconButton icon={ExternalLink} label="Открыть поиск, где закреплён лот" onClick={(e) => openTradeUrl(searchUrl, e.ctrlKey || e.metaKey)} />
          )}
          <IconButton icon={PinOff} label="Открепить" onClick={unpin} />
        </div>
      </CardSection>
    </Card>
  );
}
