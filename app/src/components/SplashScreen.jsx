import { Box, Group, Stack, Text } from "@mantine/core";
import {
  IconCheck,
  IconDatabase,
  IconShieldCheck,
  IconTopologyStar3,
} from "@tabler/icons-react";

import metalWorxLogo from "../assets/metal-worx-official-transparent.png";

const SYSTEM_STEPS = [
  {
    label: "SECURE ACCESS",
    icon: IconShieldCheck,
    delay: "1.65s",
  },
  {
    label: "LIVE OPERATIONS",
    icon: IconDatabase,
    delay: "2.05s",
  },
  {
    label: "MISSION CONTROL",
    icon: IconTopologyStar3,
    delay: "2.45s",
  },
];

function SplashScreen() {
  return (
    <Box
      mih="100dvh"
      pos="relative"
      style={{
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 46%, rgba(132,0,17,0.18), transparent 31%), linear-gradient(145deg, #020304 0%, #090c0f 48%, #020304 100%)",
      }}
    >
      <style>{`
        @keyframes mw-grid-reveal {
          0% { opacity: 0; transform: scale(1.08); }
          22% { opacity: .28; }
          100% { opacity: .13; transform: scale(1); }
        }

        @keyframes mw-panel-left {
          0%, 11% { transform: translateX(0); }
          56%, 100% { transform: translateX(-101%); }
        }

        @keyframes mw-panel-right {
          0%, 11% { transform: translateX(0); }
          56%, 100% { transform: translateX(101%); }
        }

        @keyframes mw-seam {
          0% { opacity: 0; transform: scaleY(.1); }
          12% { opacity: 1; transform: scaleY(1); }
          42% { opacity: 1; }
          61%, 100% { opacity: 0; transform: scaleY(.78); }
        }

        @keyframes mw-logo-reveal {
          0%, 22% {
            opacity: 0;
            transform: translateY(18px) scale(.88);
            filter: blur(12px) brightness(.35);
          }
          52% {
            opacity: 1;
            transform: translateY(0) scale(1.025);
            filter: blur(0) brightness(1.2);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0) brightness(1);
          }
        }

        @keyframes mw-title-reveal {
          0%, 36% { opacity: 0; transform: translateY(10px); letter-spacing: .42em; }
          65%, 100% { opacity: 1; transform: translateY(0); letter-spacing: .24em; }
        }

        @keyframes mw-step-reveal {
          0% { opacity: 0; transform: translateY(9px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes mw-progress {
          0% { transform: scaleX(0); }
          14% { transform: scaleX(.06); }
          80% { transform: scaleX(.88); }
          100% { transform: scaleX(1); }
        }

        @keyframes mw-pulse {
          0%, 100% { opacity: .42; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mw-splash-animated {
            animation-duration: .01ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <Box
        className="mw-splash-animated"
        pos="absolute"
        inset={0}
        style={{
          opacity: 0,
          animation: "mw-grid-reveal 4.2s ease-out forwards",
          backgroundImage:
            "linear-gradient(rgba(133,154,171,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(133,154,171,.16) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(circle at center, black 0%, rgba(0,0,0,.8) 38%, transparent 78%)",
        }}
      />

      <Box
        pos="absolute"
        inset="8% 7%"
        style={{
          opacity: 0.18,
          border: "1px solid rgba(143,165,181,.32)",
          borderRadius: 6,
        }}
      >
        <Box
          pos="absolute"
          top="12%"
          left="6%"
          w="23%"
          h="32%"
          style={{
            border: "1px solid rgba(143,165,181,.28)",
            borderRadius: "50%",
          }}
        />
        <Box
          pos="absolute"
          top="19%"
          left="9%"
          w="17%"
          h="20%"
          style={{
            border: "1px dashed rgba(143,165,181,.3)",
            borderRadius: "50%",
          }}
        />
        <Box
          pos="absolute"
          right="7%"
          bottom="12%"
          w="27%"
          h="28%"
          style={{
            border: "1px solid rgba(143,165,181,.24)",
            background:
              "linear-gradient(45deg, transparent 48%, rgba(143,165,181,.18) 49%, rgba(143,165,181,.18) 51%, transparent 52%)",
          }}
        />
      </Box>

      <Box
        className="mw-splash-animated"
        pos="absolute"
        top={0}
        bottom={0}
        left={0}
        w="50.1%"
        style={{
          zIndex: 6,
          animation: "mw-panel-left 1.35s cubic-bezier(.77,0,.18,1) .2s forwards",
          background:
            "linear-gradient(90deg, #050607 0%, #111519 80%, #080a0c 100%)",
          borderRight: "1px solid rgba(255,255,255,.1)",
          boxShadow: "18px 0 60px rgba(0,0,0,.65)",
        }}
      />

      <Box
        className="mw-splash-animated"
        pos="absolute"
        top={0}
        bottom={0}
        right={0}
        w="50.1%"
        style={{
          zIndex: 6,
          animation: "mw-panel-right 1.35s cubic-bezier(.77,0,.18,1) .2s forwards",
          background:
            "linear-gradient(270deg, #050607 0%, #111519 80%, #080a0c 100%)",
          borderLeft: "1px solid rgba(255,255,255,.1)",
          boxShadow: "-18px 0 60px rgba(0,0,0,.65)",
        }}
      />

      <Box
        className="mw-splash-animated"
        pos="absolute"
        top="8%"
        bottom="8%"
        left="50%"
        w={3}
        ml={-1.5}
        style={{
          zIndex: 8,
          transformOrigin: "center",
          animation: "mw-seam 1.45s ease-in-out forwards",
          background:
            "linear-gradient(180deg, transparent, #ff1e38 18%, #ff1e38 82%, transparent)",
          boxShadow: "0 0 22px rgba(255,30,56,.9)",
        }}
      />

      <Stack
        align="center"
        gap={0}
        w="100%"
        maw={760}
        px="xl"
        pos="relative"
        style={{ zIndex: 3 }}
      >
        <Box
          className="mw-splash-animated"
          component="img"
          src={metalWorxLogo}
          alt="Metal Worx Inc."
          h={{ base: 105, sm: 145 }}
          maw="88%"
          style={{
            objectFit: "contain",
            opacity: 0,
            animation:
              "mw-logo-reveal 1.3s cubic-bezier(.18,.89,.32,1.18) .65s forwards",
            filter: "drop-shadow(0 18px 35px rgba(0,0,0,.75))",
          }}
        />

        <Text
          className="mw-splash-animated"
          mt={10}
          size={{ base: "xs", sm: "sm" }}
          fw={900}
          c="#ff263f"
          ta="center"
          style={{
            opacity: 0,
            animation: "mw-title-reveal 1s ease-out 1.05s forwards",
          }}
        >
          METAL WORX OPERATIONS SYSTEM
        </Text>

        <Box
          mt={{ base: 34, sm: 46 }}
          w="100%"
          maw={600}
          px={{ base: 10, sm: 24 }}
        >
          <Group justify="center" gap={{ base: 12, sm: 24 }} wrap="nowrap">
            {SYSTEM_STEPS.map((step) => {
              const StepIcon = step.icon;

              return (
                <Stack
                  key={step.label}
                  className="mw-splash-animated"
                  align="center"
                  gap={8}
                  style={{
                    flex: 1,
                    opacity: 0,
                    animation: `mw-step-reveal .5s ease-out ${step.delay} forwards`,
                  }}
                >
                  <Box
                    w={{ base: 38, sm: 44 }}
                    h={{ base: 38, sm: 44 }}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 12,
                      color: "#f4f6f8",
                      background: "rgba(154,0,19,.23)",
                      border: "1px solid rgba(255,38,63,.28)",
                    }}
                  >
                    <StepIcon size={20} stroke={1.8} />
                  </Box>

                  <Group gap={5} wrap="nowrap">
                    <IconCheck size={13} color="#43dc6a" stroke={3} />
                    <Text
                      size="10px"
                      fw={900}
                      c="gray.4"
                      ta="center"
                      style={{ letterSpacing: ".09em" }}
                    >
                      {step.label}
                    </Text>
                  </Group>
                </Stack>
              );
            })}
          </Group>

          <Box
            mt={{ base: 30, sm: 38 }}
            h={3}
            style={{
              overflow: "hidden",
              borderRadius: 999,
              background: "rgba(255,255,255,.08)",
            }}
          >
            <Box
              className="mw-splash-animated"
              h="100%"
              style={{
                transform: "scaleX(0)",
                transformOrigin: "left",
                animation: "mw-progress 3.2s ease-in-out .75s forwards",
                background:
                  "linear-gradient(90deg, #7d0010, #f00020 55%, #ff6175)",
                boxShadow: "0 0 16px rgba(240,0,32,.65)",
              }}
            />
          </Box>

          <Group justify="center" gap={8} mt={15}>
            <Box
              className="mw-splash-animated"
              w={7}
              h={7}
              style={{
                borderRadius: "50%",
                background: "#44dc6a",
                boxShadow: "0 0 12px rgba(68,220,106,.75)",
                animation: "mw-pulse 1.25s ease-in-out infinite",
              }}
            />
            <Text
              className="mw-splash-animated"
              size="xs"
              fw={800}
              c="gray.5"
              style={{
                opacity: 0,
                letterSpacing: ".12em",
                animation: "mw-step-reveal .5s ease-out 2.8s forwards",
              }}
            >
              SYSTEM READY
            </Text>
          </Group>
        </Box>
      </Stack>

      <Text
        pos="absolute"
        bottom={{ base: 20, sm: 28 }}
        size="10px"
        fw={800}
        c="gray.7"
        ta="center"
        style={{ letterSpacing: ".18em" }}
      >
        BUILT FOR THE WAY METAL WORX OPERATES
      </Text>
    </Box>
  );
}

export default SplashScreen;