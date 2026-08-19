import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, GoldButton, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

type Tab = "properties" | "companies" | "withdrawals" | "kyc";

export default function Approvals() {
  const [tab, setTab] = useState<Tab>("properties");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "properties") setItems(await api<any[]>("/properties?status=pending"));
      else if (tab === "companies") {
        const all = await api<any[]>("/companies");
        setItems(all.filter((c: any) => c.status === "pending"));
      } else if (tab === "withdrawals") {
        const all = await api<any[]>("/admin/withdrawals");
        setItems(all.filter((w: any) => w.status === "pending"));
      } else if (tab === "kyc") {
        setItems(await api<any[]>("/admin/kyc/pending"));
      }
    } catch (e) { console.warn(e); } finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const act = async (kind: "approve" | "reject", it: any) => {
    try {
      if (tab === "properties") {
        await api(`/properties/${it.id}`, { method: "PATCH", body: { status: kind === "approve" ? "approved" : "rejected" } });
      } else if (tab === "companies") {
        await api(`/admin/companies/${it.id}?status=${kind === "approve" ? "approved" : "rejected"}`, { method: "PATCH" });
      } else if (tab === "withdrawals") {
        await api(`/admin/withdrawals/${it.id}/${kind}`, { body: {} });
      } else if (tab === "kyc") {
        await api(`/admin/kyc/${it.id}/${kind === "approve" ? "verify" : "reject"}`, { body: {} });
      }
      setToast(`${kind === "approve" ? "Approved" : "Rejected"}`);
      load();
    } catch (e: any) { setToast(e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={{ padding: spacing.xl, paddingBottom: 0 }}><Text style={styles.title}>Approvals</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}>
          {(["properties", "companies", "withdrawals", "kyc"] as Tab[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]} testID={`approvals-tab-${t}`}>
              <Text style={[styles.tabText, tab === t && { color: colors.brand }]}>{t === "kyc" ? "KYC" : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {toast && (
          <View style={styles.toast}>
            <Text style={{ color: colors.brand }}>{toast}</Text>
            <TouchableOpacity onPress={() => setToast(null)}><Ionicons name="close" color={colors.onSurfaceTertiary} size={16} /></TouchableOpacity>
          </View>
        )}
        {loading && <ActivityIndicator color={colors.brand} />}
        {!loading && items.length === 0 && <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>Nothing pending here.</Text></Card>}
        {items.map((it) => (
          <View key={it.id} style={styles.card} testID={`approve-item-${it.id}`}>
            <View style={{ flex: 1 }}>
              {tab === "properties" && (
                <>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.meta}>{it.company_name} · {it.location}</Text>
                  <Text style={styles.meta}>{it.total_shares} shares · {fmtInr(it.share_price)}/share · {it.monthly_return_rate}% mo</Text>
                </>
              )}
              {tab === "companies" && (
                <>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.meta}>{it.description || "No description"}</Text>
                </>
              )}
              {tab === "withdrawals" && (
                <>
                  <Text style={styles.name}>Withdrawal · {fmtInr(it.amount)}</Text>
                  <Text style={styles.meta}>User {it.user_id}</Text>
                  <Text style={styles.meta}>{new Date(it.created_at).toLocaleString()}</Text>
                </>
              )}
              {tab === "kyc" && (
                <>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.meta}>{it.email} · {it.role}</Text>
                  <Text style={styles.meta}>Doc: {it.latest_doc?.doc_type || "—"} · {it.latest_doc ? new Date(it.latest_doc.created_at).toLocaleDateString() : ""}</Text>
                </>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TouchableOpacity onPress={() => act("reject", it)} style={[styles.action, { borderColor: colors.error }]} testID={`reject-${it.id}`}>
                <Text style={{ color: colors.error, fontWeight: "600" }}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => act("approve", it)} style={[styles.action, { borderColor: colors.success, backgroundColor: "rgba(42,157,143,0.15)" }]} testID={`approve-${it.id}`}>
                <Text style={{ color: colors.success, fontWeight: "600" }}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  tabActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  tabText: { color: colors.onSurfaceSecondary, fontSize: 13 },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  name: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display },
  meta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  action: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  toast: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
