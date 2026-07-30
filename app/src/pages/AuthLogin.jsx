import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconAt,
  IconClock,
  IconLock,
  IconLogout,
  IconShieldCheck,
} from "@tabler/icons-react";

import {
  clearMetalWorxSession,
  startMetalWorxSession,
  supabase,
} from "../lib/supabase";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";
import loginBackground from "../assets/metal-worx-login-background.png";

const INPUT_STYLES = {
  label: {
    color: "#d8dde4",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    color: "#ffffff",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  section: {
    color: "#929aa5",
  },
};

function AuthLogin({
  session,
  errorMessage = "",
  onSignOut,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setLoginError("Enter your Metal Worx email and password.");
      return;
    }

    setSubmitting(true);
    setLoginError("");

    try {
      /*
       * Establish the Metal Worx session mode before Supabase emits SIGNED_IN.
       * The application gate can then validate the new session immediately.
       */
      startMetalWorxSession(keepSignedIn);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;
      if (!data?.session) {
        throw new Error("Supabase did not create a login session.");
      }
    } catch (error) {
      clearMetalWorxSession();
      console.error("Metal Worx sign-in error:", error);
      setLoginError(
        error?.message ||
          "Sign in failed. Check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const dateText = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const timeText = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  return (
    <Box
      mih="100dvh"
      px={{ base: 16, sm: 28 }}
      py={{ base: 18, sm: 28 }}
      style={{
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflowX: "hidden",
        backgroundColor: "#030405",
        backgroundImage: `linear-gradient(rgba(1,3,5,0.22), rgba(1,3,5,0.45)), url(${loginBackground})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <Box
        pos="absolute"
        inset={0}
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at center, rgba(4,6,8,0.1) 0%, rgba(2,3,4,0.24) 45%, rgba(0,0,0,0.62) 100%)",
        }}
      />

      <Paper
        component="form"
        onSubmit={handleSubmit}
        w="100%"
        maw={500}
        radius={24}
        p={{ base: 22, sm: 30 }}
        pos="relative"
        style={{
          zIndex: 1,
          overflow: "hidden",
          background:
            "linear-gradient(155deg, rgba(16,21,26,0.96), rgba(7,10,13,0.98))",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow:
            "0 32px 110px rgba(0,0,0,0.82), 0 0 55px rgba(155,0,18,0.15)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Box
          pos="absolute"
          top={0}
          left={0}
          right={0}
          h={4}
          style={{
            background:
              "linear-gradient(90deg, transparent, #ff1731 20%, #ff1731 80%, transparent)",
            boxShadow: "0 0 18px rgba(255,23,49,0.75)",
          }}
        />

        <Stack gap="lg">
          <Stack align="center" gap={7}>
            <Box
              component="img"
              src={metalWorxLogo}
              alt="Metal Worx Inc."
              h={{ base: 66, sm: 76 }}
              maw="78%"
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 8px 22px rgba(0,0,0,0.72))",
              }}
            />

            <Text
              size="xs"
              fw={900}
              c="#ff243d"
              ta="center"
              style={{ letterSpacing: "0.22em" }}
            >
              OPERATIONS CONTROL SYSTEM
            </Text>
          </Stack>

          <Box pos="relative">
            <Stack align="center" gap={8}>
              <ThemeIcon
                size={46}
                radius={13}
                color="red"
                variant="light"
                style={{
                  flexShrink: 0,
                  border: "1px solid rgba(255,35,60,0.28)",
                }}
              >
                <IconShieldCheck size={24} />
              </ThemeIcon>

              <Text
                size="xs"
                fw={900}
                c="red.4"
                ta="center"
                style={{ letterSpacing: "0.15em" }}
              >
                EMPLOYEE ACCESS
              </Text>

              <Title
                order={1}
                c="white"
                ta="center"
                fz={{ base: 26, sm: 31 }}
                style={{ lineHeight: 1.08 }}
              >
                Metal Worx OS
              </Title>
            </Stack>

            <Box
              visibleFrom="sm"
              pos="absolute"
              top="50%"
              right={0}
              px={11}
              py={7}
              style={{
                transform: "translateY(-50%)",
                flexShrink: 0,
                borderRadius: 10,
                background: "rgba(42,190,78,0.09)",
                border: "1px solid rgba(58,215,94,0.25)",
              }}
            >
              <Group gap={7} wrap="nowrap">
                <Box
                  w={8}
                  h={8}
                  style={{
                    borderRadius: "50%",
                    background: "#3bd760",
                    boxShadow: "0 0 10px rgba(59,215,96,0.9)",
                  }}
                />
                <Text size="xs" fw={900} c="#6feb8a">
                  ONLINE
                </Text>
              </Group>
            </Box>
          </Box>

          <Group
            justify="space-between"
            px={14}
            py={10}
            style={{
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Text size="xs" fw={800} c="gray.5">
              {dateText}
            </Text>
            <Text size="sm" fw={900} c="white">
              {timeText}
            </Text>
          </Group>

          {(loginError || errorMessage) && (
            <Alert
              color="red"
              radius="md"
              icon={<IconAlertTriangle size={18} />}
              title={session ? "Employee Access Required" : "Sign In Failed"}
            >
              {loginError || errorMessage}
            </Alert>
          )}

          {session && errorMessage ? (
            <Button
              type="button"
              color="red"
              variant="light"
              size="md"
              leftSection={<IconLogout size={18} />}
              onClick={onSignOut}
            >
              Sign Out and Try Another Account
            </Button>
          ) : (
            <Stack gap="md">
              <TextInput
                label="Email Address"
                placeholder="name@metalworxinc.net"
                leftSection={<IconAt size={18} />}
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                autoComplete="email"
                autoFocus
                required
                styles={INPUT_STYLES}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                leftSection={<IconLock size={18} />}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="current-password"
                required
                styles={INPUT_STYLES}
              />

              <Box
                px={14}
                py={11}
                style={{
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <Checkbox
                  checked={keepSignedIn}
                  onChange={(event) =>
                    setKeepSignedIn(event.currentTarget.checked)
                  }
                  color="red"
                  label={
                    <Box>
                      <Text fw={800} c="gray.2" size="sm">
                        Keep me signed in for 24 hours
                      </Text>
                      <Text size="xs" c="gray.6">
                        Turn this off on shared computers.
                      </Text>
                    </Box>
                  }
                />
              </Box>

              <Button
                type="submit"
                color="red"
                size="lg"
                radius="md"
                loading={submitting}
                leftSection={<IconLock size={18} />}
                styles={{
                  root: {
                    minHeight: 51,
                    fontWeight: 900,
                    background:
                      "linear-gradient(90deg, #920011, #d0001a)",
                    boxShadow: "0 12px 28px rgba(190,0,23,0.3)",
                  },
                }}
              >
                Sign In to Metal Worx OS
              </Button>
            </Stack>
          )}

          <Group justify="center" gap={7}>
            <IconClock size={13} color="#707985" />
            <Text size="xs" fw={700} c="gray.6" ta="center">
              Authorized employees only • 24-hour session limit
            </Text>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}

export default AuthLogin;
