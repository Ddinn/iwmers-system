import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

interface ToastNotificationProps {
  show: boolean;
  onClose: () => void;
  message?: string;
  sub?: string;
}

export function ToastNotification({ show, onClose, message, sub }: ToastNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let enterTimer: NodeJS.Timeout;
    let closeTimer: NodeJS.Timeout;
    let exitTimer: NodeJS.Timeout;

    if (show) {
      // 1. Enter animation tick
      enterTimer = setTimeout(() => setVisible(true), 10);

      // 2. Auto-hide after 4 seconds
      closeTimer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 400); 
      }, 4000);
    } else {
      // FIXED: Asynchronous exit tick to satisfy the Next.js linter
      exitTimer = setTimeout(() => setVisible(false), 10);
    }

    // Cleanup all timers if the component unmounts
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(closeTimer);
      clearTimeout(exitTimer);
    };
  }, [show, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
        minWidth: 340,
      }}
    >
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: 16,
          padding: "16px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 36, height: 36, background: "#DCFCE7", marginTop: 1 }}
        >
          <CheckCircle2 size={20} color="#10B981" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <span style={{ color: "#0F172A", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>
            {message ?? "TARGET LOCKED: Alor Gajah"}
          </span>
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 400 }}>
            {sub ?? "Successfully synced 36 records."}
          </span>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 400); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}