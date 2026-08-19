import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, KPI, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

const HEADER_BG = "https://images.unsplash.com/photo-1728853696418-c2c2a7f998fb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwZ29sZCUyMGZpbmFuY2UlMjBjaGFydCUyMGRhcmslMjAzZHxlbnwwfHx8fDE3ODU1MDMwODV8MA&ixlib=rb-4.1.0&q=85";

export default function Portfolio() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/portfolio");
      setData(d);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.headerWrap}>
          <ImageBackground source={{ uri: HEADER_BG }} style={styles.header} imageStyle={{ borderRadius: radius.lg }}>
            <LinearGradient
              colors={["rgba(18,18,21,0.6)", "rgba(18,18,21,0.95)"]}
              style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }}
            />
            <View style={styles.headerInner}>
              <Text style={styles.headerLabel}>PORTFOLIO</Text>
              {loading ? <ActivityIndicator color={colors.brand} /> : (
                <>
                  <Text style={styles.headerValue}>{fmtInr(data?.total_current_value || 0)}</Text>
                  <Text style={[styles.pnl, { color: (data?.pnl || 0) >= 0 ? colors.success : colors.error }]}>
                    {(data?.pnl || 0) >= 0 ? "+" : ""}{fmtInr(data?.pnl || 0)} total P/L
                  </Text>
                </>
              )}
            </View>
          </ImageBackground>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <KPI label="Invested" value={fmtInr(data?.total_invested || 0)} testID="portfolio-kpi-invested" />
          <KPI label="Returns" value={fmtInr(data?.total_returns || 0)} testID="portfolio-kpi-returns" />
        </View>

        <Text style={styles.section}>Your holdings</Text>
        {(!data || data.holdings.length === 0) && !loading && (
          <Card><Text style={{ color: colors.onSurfaceSecondary, textAlign: "center" }}>You don&apos;t own any shares yet. Browse Explore to start.</Text></Card>
        )}
        {data?.holdings.map((h: any) => {
          const pnl = h.pnl;
          const posColor = pnl >= 0 ? colors.success : colors.error;
          return (
            <View key={h.property_id} style={styles.holding} testID={`holding-${h.property_id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holdName}>{h.property.name}</Text>
                <Text style={styles.holdMeta}>{h.shares} shares · {h.property.location}</Text>
                <Text style={styles.holdInv}>Invested {fmtInr(h.invested)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.holdVal}>{fmtInr(h.current_value)}</Text>
                <Text style={[styles.holdPnl, { color: posColor }]}>{pnl >= 0 ? "+" : ""}{fmtInr(pnl)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  header: { height: 180, borderRadius: radius.lg, overflow: "hidden" },
  headerInner: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  headerLabel: { color: colors.brand, fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  headerValue: { color: colors.onSurface, fontSize: 36, fontFamily: fonts.display },
  pnl: { fontSize: 14, marginTop: 6 },
  section: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: spacing.xl, marginBottom: spacing.md },
  holding: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  holdName: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display },
  holdMeta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  holdInv: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  holdVal: { color: colors.onSurface, fontSize: 16, fontFamily: fonts.display },
  holdPnl: { fontSize: 13, marginTop: 4 },
});
