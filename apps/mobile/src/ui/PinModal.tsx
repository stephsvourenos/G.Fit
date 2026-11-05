import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { C } from "./theme";

/** onSubmit resolves to an error message, or undefined when the PIN was accepted. */
export function PinModal({ visible, title, hint, onSubmit, onCancel }: {
  visible: boolean;
  title: string;
  hint?: string;
  onSubmit: (pin: string) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  // Digits are kept in a ref too, so fast taps never read a stale value.
  const digits = useRef("");
  const press = async (d: string) => {
    if (checking) return;
    const next = (digits.current + d).slice(0, 4);
    digits.current = next;
    setPin(next);
    setError(undefined);
    if (next.length === 4) {
      setChecking(true);
      const err = await onSubmit(next);
      setChecking(false);
      if (err) setError(err);
      digits.current = "";
      setPin("");
    }
  };
  const back = () => {
    digits.current = digits.current.slice(0, -1);
    setPin(digits.current);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>{checking ? "Checking…" : (hint ?? "Parent PIN")}</Text>
          <View style={s.dots}>{[0, 1, 2, 3].map((i) => <View key={i} style={[s.dot, i < pin.length && { backgroundColor: C.sun }]} />)}</View>
          {error && <Text style={s.err}>{error}</Text>}
          <View style={s.grid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
              <Pressable key={i} disabled={!k} accessibilityLabel={k === "⌫" ? "Delete" : k} onPress={() => (k === "⌫" ? back() : void press(k))} style={({ pressed }) => [s.key, !k && { opacity: 0 }, pressed && { opacity: 0.6 }]}>
                <Text style={s.keyText}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onCancel}><Text style={s.cancel}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 320, backgroundColor: C.ink2, borderRadius: 28, padding: 24 },
  title: { color: C.paper, fontSize: 20, fontWeight: "700", textAlign: "center" },
  sub: { color: C.muted, textAlign: "center", marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)" },
  err: { color: C.coral, textAlign: "center", marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 18, rowGap: 10 },
  key: { width: "31%", height: 56, borderRadius: 16, backgroundColor: C.ink3, alignItems: "center", justifyContent: "center" },
  keyText: { color: C.paper, fontSize: 22, fontWeight: "600" },
  cancel: { color: C.muted, textAlign: "center", marginTop: 16 },
});
