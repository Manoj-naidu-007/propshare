import { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { GoldButton } from "@/src/ui";
import { useAuth } from "@/src/auth";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const u = await signIn(email.trim().toLowerCase(), password);
      if (u.role === "Admin") router.replace("/(admin)/dashboard");
      else if (u.role === "Company") router.replace("/(company)/dashboard");
      else router.replace("/(investor)/home");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.replace("/(auth)/welcome")} style={styles.back} testID="login-back-btn">
            <Ionicons name="chevron-back" color={colors.onSurface} size={26} />
          </TouchableOpacity>

          <Text style={styles.title}>Welcome back.</Text>
          <Text style={styles.subtitle}>Log in to continue investing.</Text>

          <View style={{ height: spacing.xl }} />
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.info}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.info}
            style={styles.input}
            secureTextEntry
          />

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <View style={{ height: spacing.lg }} />
          <GoldButton testID="login-submit-btn" title="Sign in" onPress={submit} loading={loading} />

          <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={{ marginTop: spacing.lg, alignItems: "center" }} testID="login-goto-signup">
            <Text style={{ color: colors.onSurfaceTertiary }}>
              Don&apos;t have an account? <Text style={{ color: colors.brand }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8, marginBottom: spacing.lg },
  title: { color: colors.onSurface, fontSize: 34, fontFamily: fonts.display },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: 6, fontSize: 15 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, marginTop: spacing.lg, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontSize: 16,
  },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 13 },
});