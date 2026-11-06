import type { ReactNode } from "react";
import { Button, Dialog } from "@/design-system";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
};

/** Подтверждение необратимого действия: кнопка подтверждения — danger-ghost, основная — «Отмена». */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button
            variant="danger-ghost"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" autoFocus onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
