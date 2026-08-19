import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { GoldButton } from "@/src/ui";

const HERO = "https://images.unsplash.com/photo-1773236376162-14b9c09b28f4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMDNkJTIwZ2xhc3MlMjBmaW5hbmNlJTIwYmFja2dyb3VuZCUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgwfDA&ixlib=rb-4.1.0&q=85";

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ImageBackground source={{ uri: HERO }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <LinearGradient
          colors={["rgba(18,18,21,0.3)", "rgba(18,18,21,0.85)", "rgba(18,18,21,1)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PROP · SHARE</Text>
          </View>
          <Text style={styles.title}>Own a piece of prime real estate.</Text>
          <Text style={styles.subtitle}>
            Fractional property investing. Buy shares, earn monthly returns.
          </Text>
        </View>

        <View style={styles.bottom}>
          <GoldButton
            testID="welcome-signin-btn"
            title="Sign in"
            onPress={() => router.push("/(auth)/login")}
          />
          <TouchableOpacity
            testID="welcome-signup-btn"
            onPress={() => router.push("/(auth)/signup")}
            style={styles.altBtn}
          >
            <Text style={styles.altText}>Create an account</Text>
          </TouchableOpacity>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo credentials</Text>
            <Text style={styles.demoLine}>Admin · admin@propshare.com / Admin@123</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  top: { marginTop: spacing["3xl"] },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    marginBottom: spacing.xl,
  },
  badgeText: { color: colors.brand, fontSize: 11, letterSpacing: 3, fontFamily: fonts.text },
  title: {
    color: colors.onSurface,
    fontSize: 40,
    fontFamily: fonts.display,
    lineHeight: 46,
    marginBottom: spacing.lg,
  },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 22 },
  bottom: { marginBottom: spacing.lg, gap: spacing.md },
  altBtn: { alignItems: "center", padding: spacing.md },
  altText: { color: colors.onSurfaceSecondary, fontSize: 15 },
  demoBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(28,28,33,0.6)",
  },
  demoTitle: { color: colors.brand, fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  demoLine: { color: colors.onSurfaceTertiary, fontSize: 12 },
});
