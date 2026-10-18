import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/components/ui/app-text";
import { Colors, FontFamily, Radius } from "@/constants/theme";

type ToastTone = "info" | "success" | "error";
type ToastState = { id: number; message: string; tone: ToastTone } | null;
type ToastContextValue = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const DURATION_MS = 2400;

const TONE_BORDER: Record<ToastTone, string> = {
  info: "rgba(255,255,255,0.15)",
  success: "rgba(50,205,50,0.45)",
  error: "rgba(255,85,85,0.55)",
};

/**
 * App-wide toast (prototype Toast). Use for short confirmations ("Saved!") and
 * non-blocking errors. Messages are announced to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={[styles.host, { bottom: insets.bottom + 96 }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.toast, { borderColor: TONE_BORDER[toast.tone] }]}
          >
            <AppText style={styles.text} align="center">
              {toast.message}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "none" },
  toast: {
    maxWidth: 320,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.elevated,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20 },
});
