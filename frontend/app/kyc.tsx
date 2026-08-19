import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Kyc() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api("/kyc/mine");
      setState(s);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickImage = async () => {
    setErr(null);
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          setErr("Please enable photo access in Settings.");
        } else {
          setErr("Photo permission is required.");
        }
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const b64 = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
    setPicked(b64);
  };

  const upload = async () => {
    if (!picked) { setErr("Pick a document image first"); return; }
    setUploading(true); setErr(null);
    try {
      await api("/kyc/upload", { body: { document: picked, doc_type: user?.role === "Company" ? "company_kyc" : "id_proof" } });
      setPicked(null);
      setToast("KYC submitted — awaiting admin verification.");
      await refresh();
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const status = state?.kyc_status || user?.kyc_status || "pending";
  const statusColor = status === "verified" ? colors.success : status === "submitted" ? colors.warning : status === "rejected" ? colors.error : colors.onSurfaceTertiary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="kyc-back-btn">
            <Ionicons name="chevron-back" color={colors.onSurface} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>KYC Verification</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"], gap: spacing.md }}>
        {loading ? <ActivityIndicator color={colors.brand} /> : (
          <>
            <Card>
              <Text style={styles.miniLabel}>CURRENT STATUS</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{status.toUpperCase()}</Text>
              </View>
              <Text style={styles.desc}>
                {status === "verified" && "Your identity has been verified. You have full access to the platform."}
                {status === "submitted" && "We've received your document. Verification usually takes 24–48 hours."}
                {status === "pending" && "Complete your KYC to unlock large investments and withdrawals."}
                {status === "rejected" && "Your submission was rejected. Please upload a clearer document."}
              </Text>
            </Card>

            {status !== "verified" && (
              <Card>
                <Text style={styles.miniLabel}>UPLOAD DOCUMENT</Text>
                <Text style={styles.desc}>{user?.role === "Company" ? "Company registration / KYC document (PDF or clear photo)" : "Government-issued photo ID (Aadhaar, Passport, PAN, etc.)"}</Text>
                {picked ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: picked }} style={styles.preview} resizeMode="cover" />
                    <TouchableOpacity onPress={() => setPicked(null)} style={styles.removeBtn} testID="kyc-remove-image">
                      <Ionicons name="close-circle" size={26} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={pickImage} style={styles.picker} testID="kyc-pick-image">
                    <Ionicons name="cloud-upload-outline" color={colors.brand} size={32} />
                    <Text style={{ color: colors.brand, marginTop: 8, fontSize: 14 }}>Tap to select image</Text>
                  </TouchableOpacity>
                )}
                {err ? <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text> : null}
                {toast ? <Text style={{ color: colors.success, marginTop: 8 }}>{toast}</Text> : null}
                <View style={{ height: spacing.md }} />
                <GoldButton testID="kyc-submit-btn" title="Submit for verification" onPress={upload} loading={uploading} disabled={!picked} />
              </Card>
            )}

            {(state?.documents || []).length > 0 && (
              <Card>
                <Text style={styles.miniLabel}>SUBMISSION HISTORY</Text>
                {state.documents.map((d: any, i: number) => (
                  <View key={d.id || i} style={styles.docRow} testID={`kyc-doc-${i}`}>
                    <Ionicons name="document-text" color={colors.brand} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontSize: 13 }}>{d.doc_type.replace(/_/g, " ")}</Text>
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>{new Date(d.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, flex: 1, textAlign: "center" },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5 },
  statusText: { fontSize: 20, fontFamily: fonts.display, letterSpacing: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  desc: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: spacing.md, lineHeight: 20 },
  picker: { marginTop: spacing.md, height: 160, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  previewWrap: { marginTop: spacing.md, borderRadius: radius.md, overflow: "hidden", height: 200, backgroundColor: colors.surface },
  preview: { width: "100%", height: "100%" },
  removeBtn: { position: "absolute", top: 8, right: 8, backgroundColor: colors.surface, borderRadius: 14 },
  docRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.md },
});
