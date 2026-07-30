import {
  Alert,
  Box,
  Button,
  FileButton,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCamera,
  IconCheck,
  IconPhoto,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import metalWorxLogo from "../../assets/metal-worx-official-transparent.png";

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 1200;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          "The selected image could not be opened."
        )
      );
    };

    image.src = source;
  });
}

function canvasToBlob(
  canvas,
  type = "image/jpeg",
  quality = 0.92
) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(
          new Error(
            "The processed inventory image could not be created."
          )
        );
      },
      type,
      quality
    );
  });
}

function drawRoundedRectangle(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  const safeRadius = Math.min(
    radius,
    width / 2,
    height / 2
  );

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(
    x + width - safeRadius,
    y
  );
  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  );
  context.lineTo(
    x + width,
    y + height - safeRadius
  );
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(
    x + safeRadius,
    y + height
  );
  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - safeRadius
  );
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  );
  context.closePath();
}

function getOutputFileName(fileName) {
  const sourceName = String(
    fileName || "inventory-image"
  )
    .replace(/\.[^/.]+$/, "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${
    sourceName || "inventory-image"
  }-metal-worx.jpg`;
}

async function createBrandedInventoryImage(
  file
) {
  const sourceUrl =
    URL.createObjectURL(file);

  try {
    const [sourceImage, logoImage] =
      await Promise.all([
        loadImage(sourceUrl),
        loadImage(metalWorxLogo),
      ]);

    const canvas =
      document.createElement("canvas");

    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Your browser could not prepare the inventory image."
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const outerBorder = 22;
    const contentX = outerBorder;
    const contentY = outerBorder;
    const contentWidth =
      OUTPUT_WIDTH - outerBorder * 2;
    const contentHeight =
      OUTPUT_HEIGHT - outerBorder * 2;

    context.fillStyle = "#111418";

    context.fillRect(
      0,
      0,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT
    );

    context.fillStyle = "#f2f3f4";

    context.fillRect(
      contentX,
      contentY,
      contentWidth,
      contentHeight
    );

    const sourceRatio =
      sourceImage.width /
      sourceImage.height;

    const destinationRatio =
      contentWidth /
      contentHeight;

    let drawWidth = contentWidth;
    let drawHeight = contentHeight;

    if (
      sourceRatio > destinationRatio
    ) {
      drawHeight =
        contentWidth / sourceRatio;
    } else {
      drawWidth =
        contentHeight * sourceRatio;
    }

    const drawX =
      contentX +
      (contentWidth - drawWidth) / 2;

    const drawY =
      contentY +
      (contentHeight - drawHeight) / 2;

    context.drawImage(
      sourceImage,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );

    const redAccentHeight = 9;

    context.fillStyle = "#c90018";

    context.fillRect(
      contentX,
      OUTPUT_HEIGHT -
        outerBorder -
        redAccentHeight,
      contentWidth,
      redAccentHeight
    );

    const logoMaximumWidth = 320;
    const logoMaximumHeight = 108;

    const logoRatio =
      logoImage.width /
      logoImage.height;

    let logoWidth = logoMaximumWidth;
    let logoHeight =
      logoWidth / logoRatio;

    if (
      logoHeight > logoMaximumHeight
    ) {
      logoHeight = logoMaximumHeight;
      logoWidth =
        logoHeight * logoRatio;
    }

    const logoX =
      OUTPUT_WIDTH -
      outerBorder -
      logoWidth -
      38;

    const logoY =
      OUTPUT_HEIGHT -
      outerBorder -
      redAccentHeight -
      logoHeight -
      34;

    context.save();
    context.globalCompositeOperation =
      "multiply";
    context.globalAlpha = 0.46;

    context.drawImage(
      logoImage,
      logoX,
      logoY,
      logoWidth,
      logoHeight
    );

    context.restore();
    const blob = await canvasToBlob(
      canvas,
      "image/jpeg",
      0.92
    );

    return new File(
      [blob],
      getOutputFileName(file.name),
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      }
    );
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function InventoryImageCapture({
  value,
  onChange,
  label = "Inventory Image",
  description = "Upload an image or take a photo.",
  disabled = false,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileResetRef = useRef(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [
    cameraOpen,
    setCameraOpen,
  ] = useState(false);

  const [
    cameraLoading,
    setCameraLoading,
  ] = useState(false);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!value) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl =
      URL.createObjectURL(value);

    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(
        nextPreviewUrl
      );
    };
  }, [value]);

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [cameraOpen]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }
  }

  async function processSelectedFile(
    file
  ) {
    if (!file) {
      return;
    }

    setError("");

    if (
      !file.type.startsWith("image/")
    ) {
      setError(
        "Select a JPG, PNG, WEBP, or another supported image."
      );

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "The image is larger than 15 MB. Select a smaller image."
      );

      return;
    }

    setProcessing(true);

    try {
      const brandedFile =
        await createBrandedInventoryImage(
          file
        );

      if (
        typeof onChange === "function"
      ) {
        onChange(brandedFile);
      }
    } catch (processingError) {
      console.error(
        "Inventory image processing error:",
        processingError
      );

      setError(
        processingError?.message ||
          "The inventory image could not be prepared."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function openCamera() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .getUserMedia
    ) {
      setError(
        "Camera access is not supported by this browser. Use Upload Image instead."
      );

      return;
    }

    setError("");
    setCameraOpen(true);
    setCameraLoading(true);

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            },
            audio: false,
          }
        );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }
    } catch (cameraError) {
      console.error(
        "Inventory camera error:",
        cameraError
      );

      setError(
        "Camera access was denied or no camera was found. You can still upload an image."
      );

      setCameraOpen(false);
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;

    if (
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setError(
        "The camera is not ready. Wait a moment and try again."
      );

      return;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      setError(
        "The camera image could not be captured."
      );

      return;
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    try {
      const blob =
        await canvasToBlob(
          canvas,
          "image/jpeg",
          0.94
        );

      const capturedFile =
        new File(
          [blob],
          `inventory-camera-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
            lastModified: Date.now(),
          }
        );

      setCameraOpen(false);
      stopCamera();

      await processSelectedFile(
        capturedFile
      );
    } catch (captureError) {
      console.error(
        "Inventory camera capture error:",
        captureError
      );

      setError(
        captureError?.message ||
          "The camera photo could not be prepared."
      );
    }
  }

  function removeImage() {
    setError("");

    if (
      typeof onChange === "function"
    ) {
      onChange(null);
    }

    if (fileResetRef.current) {
      fileResetRef.current();
    }
  }

  return (
    <>
      <Stack gap="md">
        <Box>
          <Text
            fw={800}
            size="sm"
            c="gray.1"
          >
            {label}
          </Text>

          {description && (
            <Text
              size="xs"
              c="gray.5"
              mt={3}
              style={{
                lineHeight: 1.45,
              }}
            >
              {description}
            </Text>
          )}
        </Box>

        {error && (
          <Alert
            color="red"
            variant="light"
            icon={
              <IconAlertTriangle
                size={18}
              />
            }
            title="Image Could Not Be Added"
            withCloseButton
            onClose={() =>
              setError("")
            }
          >
            {error}
          </Alert>
        )}

        <Box
          style={{
            position: "relative",
            overflow: "hidden",
            width: "100%",
            aspectRatio: "4 / 3",
            minHeight: 280,
            borderRadius: 14,
            border:
              "1px solid rgba(255,255,255,0.11)",
            background: "#0d1013",
            boxShadow:
              "0 14px 32px rgba(0,0,0,0.24)",
          }}
        >
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt="Metal Worx inventory preview"
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: "contain",
              }}
            />
          ) : (
            <Stack
              align="center"
              justify="center"
              gap="md"
              h="100%"
              px="xl"
              ta="center"
            >
              <ThemeIcon
                size={68}
                radius="xl"
                color="red"
                variant="light"
              >
                <IconPhoto
                  size={31}
                  stroke={1.7}
                />
              </ThemeIcon>

              <Box>
                <Text
                  fw={900}
                  size="lg"
                  c="gray.1"
                >
                  Add Inventory Photo
                </Text>

                <Text
                  size="sm"
                  c="gray.5"
                  mt={5}
                >
                  Upload an existing
                  image or take a new
                  photo.
                </Text>
              </Box>
            </Stack>
          )}

          {processing && (
            <Stack
              align="center"
              justify="center"
              gap="sm"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "rgba(5,6,7,0.9)",
                backdropFilter:
                  "blur(4px)",
              }}
            >
              <Loader
                color="red"
                size="lg"
              />

              <Text
                fw={800}
                c="gray.1"
              >
                Preparing image...
              </Text>
            </Stack>
          )}
        </Box>

        {value && !processing && (
          <Group
            gap="xs"
            align="center"
          >
            <ThemeIcon
              size={27}
              radius="xl"
              color="green"
              variant="light"
            >
              <IconCheck
                size={15}
                stroke={2.5}
              />
            </ThemeIcon>

            <Box style={{ minWidth: 0 }}>
              <Text
                size="sm"
                fw={800}
                c="gray.2"
              >
                Image ready
              </Text>

              <Text
                size="xs"
                c="gray.6"
                truncate
              >
                {value.name}
              </Text>
            </Box>
          </Group>
        )}

        <Group
          gap="sm"
          grow
          align="stretch"
        >
          <FileButton
            onChange={
              processSelectedFile
            }
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            resetRef={fileResetRef}
          >
            {(fileButtonProps) => (
              <Button
                {...fileButtonProps}
                leftSection={
                  value ? (
                    <IconRefresh
                      size={18}
                    />
                  ) : (
                    <IconUpload
                      size={18}
                    />
                  )
                }
                color="red"
                disabled={
                  disabled ||
                  processing
                }
                styles={{
                  root: {
                    minHeight: 44,
                  },
                }}
              >
                {value
                  ? "Replace Image"
                  : "Upload Image"}
              </Button>
            )}
          </FileButton>

          <Button
            leftSection={
              <IconCamera
                size={18}
              />
            }
            variant="light"
            color="gray"
            onClick={openCamera}
            disabled={
              disabled ||
              processing
            }
            styles={{
              root: {
                minHeight: 44,
              },
            }}
          >
            Take Photo
          </Button>
        </Group>

        {value && (
          <Button
            leftSection={
              <IconTrash size={17} />
            }
            variant="subtle"
            color="red"
            size="sm"
            onClick={removeImage}
            disabled={
              disabled ||
              processing
            }
          >
            Remove Image
          </Button>
        )}

        <Text
          size="xs"
          c="gray.6"
          ta="center"
        >
          JPG, PNG, WEBP, HEIC, or
          HEIF Â· Maximum 15 MB
        </Text>
      </Stack>

      <Modal
        opened={cameraOpen}
        onClose={() => {
          setCameraOpen(false);
          stopCamera();
        }}
        title="Take Inventory Photo"
        centered
        size="lg"
        overlayProps={{
          backgroundOpacity: 0.78,
          blur: 5,
        }}
        styles={{
          header: {
            background: "#111418",
            borderBottom:
              "1px solid rgba(255,255,255,0.08)",
          },
          content: {
            background: "#0b0d0f",
            border:
              "1px solid rgba(255,255,255,0.12)",
          },
          title: {
            fontWeight: 900,
          },
        }}
      >
        <Stack gap="md">
          <Box
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              overflow: "hidden",
              borderRadius: 12,
              background: "#030405",
              border:
                "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Box
              component="video"
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />

            {cameraLoading && (
              <Stack
                align="center"
                justify="center"
                gap="sm"
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "rgba(3,4,5,0.88)",
                }}
              >
                <Loader color="red" />

                <Text
                  fw={700}
                  c="gray.2"
                >
                  Starting camera...
                </Text>
              </Stack>
            )}
          </Box>

          <Alert
            color="blue"
            variant="light"
            icon={
              <IconCamera
                size={18}
              />
            }
          >
            Center the entire item and
            leave a small amount of
            space around it.
          </Alert>

          <Group
            justify="flex-end"
            gap="sm"
          >
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setCameraOpen(false);
                stopCamera();
              }}
            >
              Cancel
            </Button>

            <Button
              color="red"
              leftSection={
                <IconCamera
                  size={18}
                />
              }
              onClick={capturePhoto}
              disabled={
                cameraLoading
              }
            >
              Capture Photo
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default InventoryImageCapture;
