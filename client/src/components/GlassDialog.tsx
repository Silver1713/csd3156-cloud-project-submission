import type { ReactNode } from "react";

type GlassDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  showCancel?: boolean;
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function GlassDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  showCancel = true,
  busy = false,
  children,
  onConfirm,
  onCancel,
}: GlassDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="glass-dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className={`glass-dialog glass-dialog--${tone}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="glass-dialog__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="glass-dialog__close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <p className="glass-dialog__message">{message}</p>
        {children ? <div className="glass-dialog__body">{children}</div> : null}

        <div className="glass-dialog__actions">
          {showCancel ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          ) : null}

          <button
            type="button"
            className={tone === "danger" ? "glass-dialog__danger-btn" : "primary-btn"}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
