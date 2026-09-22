import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Image,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera, IconEye, IconFlag, IconPhoto, IconStar, IconUpload } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const STORY_STAGES = [
  "Concept & Scope",
  "Measurements / Site Visit",
  "Design & Drawings",
  "Materials",
  "Fabrication",
  "Test Fit",
  "Paint / Powder Coat",
  "Installation",
  "Completed Project",
];

const SSU_EXAMPLE = [
  { id: "ssu-9268", file_name: "IMG_9268.jpeg", story_stage: "Fabrication", description: "Building the Structural Foundation — Our fabrication team welds the interior floor structure, creating a strong foundation for the steel-lined container.", example_url: "/storyboard-examples/ssu/IMG_9268.svg" },
  { id: "ssu-9315", file_name: "IMG_9315.jpeg", story_stage: "Fabrication", description: "Positioning the Steel Floor — Steel floor sections are positioned and aligned throughout the container before final welding.", example_url: "/storyboard-examples/ssu/IMG_9315.svg" },
  { id: "ssu-9316", file_name: "IMG_9316.jpeg", story_stage: "Test Fit", description: "Checking Fit and Alignment — Each section is checked for fit, spacing, and accessibility before the installation is finalized.", example_url: "/storyboard-examples/ssu/IMG_9316.svg" },
  { id: "ssu-9320", file_name: "IMG_9320.jpeg", story_stage: "Fabrication", description: "Reinforcing the Upper Structure — Custom steel framing is installed around the upper opening to strengthen the enclosure and support the interior lining.", example_url: "/storyboard-examples/ssu/IMG_9320.svg" },
  { id: "ssu-9321", file_name: "IMG_9321.jpeg", story_stage: "Installation", description: "Creating a Continuous Steel Floor — The fitted floor panels create a durable working surface from the entrance to the rear wall.", example_url: "/storyboard-examples/ssu/IMG_9321.svg" },
  { id: "ssu-9330", file_name: "IMG_9330.jpeg", story_stage: "Fabrication", description: "Installing Wall Support Rails — Horizontal steel supports are welded along the container walls to provide secure mounting points for future equipment and components.", example_url: "/storyboard-examples/ssu/IMG_9330.svg" },
  { id: "ssu-9331", file_name: "IMG_9331.jpeg", story_stage: "Fabrication", description: "Full-Length Wall Reinforcement — The wall-support system is aligned and welded throughout the full length of the container.", example_url: "/storyboard-examples/ssu/IMG_9331.svg" },
  { id: "ssu-9334", file_name: "IMG_9334.jpeg", story_stage: "Installation", description: "Enclosing the End Wall — Custom-cut steel panels are fitted to the end wall and secured around the reinforced structure.", example_url: "/storyboard-examples/ssu/IMG_9334.svg" },
  { id: "ssu-9335", file_name: "IMG_9335.jpeg", story_stage: "Installation", description: "Completing the Interior Steel Lining — Final wall sections and attachment points create a strong and functional interior enclosure.", example_url: "/storyboard-examples/ssu/IMG_9335.svg" },
  { id: "ssu-9336", file_name: "IMG_9336.jpeg", story_stage: "Completed Project", description: "Metal Fabrication Complete — The custom interior steel fabrication is complete and ready for the customer's next construction and equipment-installation phase.", example_url: "/storyboard-examples/ssu/IMG_9336.svg", is_cover_photo: true },
];

function safeFileName(value) {
  return String(value || "progress-photo")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

function isImage(file) {
  return String(file.file_type || "").startsWith("image/")
    || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.file_name || "");
}

function ProjectStoryBoard({ project, activeUser }) {
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [stage, setStage] = useState("Concept & Scope");
  const [caption, setCaption] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [view, setView] = useState("Internal Story Board");

  async function loadStory() {
    if (!project?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", project.id)
      .order("story_sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      notifications.show({ title: "Story Board Could Not Load", message: error.message, color: "red" });
      setLoading(false);
      return;
    }
    const images = (data || []).filter(isImage);
    const signed = await Promise.all(images.map(async (file) => {
      const result = await supabase.storage.from("project-files").createSignedUrl(file.storage_path, 3600);
      return [file.id, result.data?.signedUrl || null];
    }));
    setFiles(images);
    setUrls(Object.fromEntries(signed));
    setLoading(false);
  }

  useEffect(() => {
    loadStory();
  }, [project?.id]);

  const visibleFiles = useMemo(
    () => view === "SSU Example" ? SSU_EXAMPLE : view === "Customer Story" ? files.filter((file) => file.customer_visible) : files,
    [files, view],
  );

  const isExample = view === "SSU Example";

  const completedStages = useMemo(
    () => new Set(files.map((file) => file.story_stage).filter(Boolean)).size,
    [files],
  );
  const displayedStageCount = isExample
    ? new Set(SSU_EXAMPLE.map((file) => file.story_stage)).size
    : completedStages;

  async function uploadPhotos() {
    if (!selectedFiles.length) {
      notifications.show({ title: "Choose Progress Photos", message: "Select one or more images to add.", color: "orange" });
      return;
    }
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of selectedFiles) {
        const path = `${project.id}/story-${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const storageResult = await supabase.storage.from("project-files").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (storageResult.error) throw storageResult.error;
        uploaded.push(path);
        const rowResult = await supabase.from("project_files").insert({
          project_id: project.id,
          file_name: file.name,
          storage_path: path,
          file_type: file.type || null,
          file_size: file.size,
          category: stage === "Completed Project" ? "Completion Photo" : "Production File",
          description: caption.trim() || null,
          uploaded_by: activeUser || null,
          story_stage: stage,
          customer_visible: customerVisible,
          photo_taken_at: new Date().toISOString(),
        });
        if (rowResult.error) throw rowResult.error;
      }
      setSelectedFiles([]);
      setCaption("");
      await loadStory();
      notifications.show({ title: "Story Board Updated", message: `${uploaded.length} progress photo${uploaded.length === 1 ? "" : "s"} added to ${stage}.`, color: "green" });
    } catch (error) {
      if (uploaded.length) await supabase.storage.from("project-files").remove(uploaded);
      notifications.show({ title: "Photos Could Not Be Added", message: error.message, color: "red" });
    } finally {
      setUploading(false);
    }
  }

  async function updatePhoto(file, changes) {
    const { error } = await supabase.from("project_files").update(changes).eq("id", file.id);
    if (error) {
      notifications.show({ title: "Photo Could Not Be Updated", message: error.message, color: "red" });
      return;
    }
    if (changes.is_cover_photo) {
      await supabase.from("project_files").update({ is_cover_photo: false }).eq("project_id", project.id).neq("id", file.id);
    }
    await loadStory();
  }

  if (loading) return <Group justify="center" py="xl"><Loader color="red" /><Text>Loading project story…</Text></Group>;

  return (
    <Stack gap="lg">
      <Paper p="xl" radius="lg" withBorder style={{ background: "linear-gradient(135deg, rgba(210,0,32,.20), rgba(20,20,20,.98))" }}>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text size="xs" c="red.3" fw={900} tt="uppercase" lts={1.3}>Metal Worx Story Board</Text>
            <Title order={2}>{project.project_name || "Large Project"}</Title>
            <Text c="dimmed">{project.project_number} · Custom Metal. Built to Last.</Text>
          </div>
          <Badge color="red" variant="filled" size="lg">{displayedStageCount} / {STORY_STAGES.length} stages documented</Badge>
        </Group>
        <Progress mt="lg" value={(displayedStageCount / STORY_STAGES.length) * 100} color="red" size="lg" radius="xl" />
      </Paper>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" mb="md">
          <div><Text fw={900} size="lg">Add Progress Photos</Text><Text size="sm" c="dimmed">Photographs remain internal unless you deliberately mark them customer-visible.</Text></div>
          <IconCamera size={28} color="var(--mantine-color-red-6)" />
        </Group>
        <Stack>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Select label="Project stage" data={STORY_STAGES} value={stage} onChange={(value) => setStage(value || STORY_STAGES[0])} />
            <FileInput label="Progress photos" multiple accept="image/*" value={selectedFiles} onChange={setSelectedFiles} leftSection={<IconPhoto size={16} />} />
          </SimpleGrid>
          <Textarea label="Photo caption / progress note" value={caption} onChange={(event) => setCaption(event.currentTarget.value)} minRows={2} placeholder="Example: Divider wall frames welded and ready for test fit." />
          <Switch checked={customerVisible} onChange={(event) => setCustomerVisible(event.currentTarget.checked)} label="Customer-visible update" description="Only enable this for photos and notes suitable for the customer-facing story." />
          <Button color="red" loading={uploading} onClick={uploadPhotos} leftSection={<IconUpload size={17} />}>Add to Story Board</Button>
        </Stack>
      </Card>

      <Group justify="space-between" align="center" wrap="wrap">
        <div><Title order={3}>Project Story</Title><Text size="sm" c="dimmed">Follow the build from the original scope through installation.</Text></div>
        <SegmentedControl value={view} onChange={setView} data={["Internal Story Board", "Customer Story", "SSU Example"]} />
      </Group>

      {isExample && (
        <Alert color="red" icon={<IconStar size={18} />} title="Example: SSU Two-Container Project">
          <Text size="sm">Metal Worx transformed two 40-foot shipping containers with custom-fabricated interior steel lining. The work included fitting and welding the steel floor, installing full-length wall supports, reinforcing the upper structure, and enclosing the end walls to create a durable interior ready for the project's next phase.</Text>
          <Text size="sm" fw={900} mt="xs">Custom Metal. Built to Last. · Veteran Owned · American Made · Built Strong. Finished Right.</Text>
        </Alert>
      )}

      {view === "Customer Story" && !files.some((file) => file.customer_visible) && (
        <Alert color="blue" icon={<IconEye size={18} />}>No photographs have been approved for the customer story yet.</Alert>
      )}

      <Stack gap="md">
        {STORY_STAGES.map((storyStage, stageIndex) => {
          const stageFiles = visibleFiles.filter((file) => file.story_stage === storyStage);
          return (
            <Card key={storyStage} withBorder radius="lg" p="lg">
              <Group justify="space-between" mb={stageFiles.length ? "md" : 0}>
                <Group gap="sm"><Badge color={stageFiles.length ? "red" : "gray"} circle>{stageIndex + 1}</Badge><Text fw={900}>{storyStage}</Text></Group>
                <Badge color={stageFiles.length ? "green" : "gray"} variant="light">{stageFiles.length ? `${stageFiles.length} photo${stageFiles.length === 1 ? "" : "s"}` : "Not documented"}</Badge>
              </Group>
              {stageFiles.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
                  {stageFiles.map((file) => (
                    <Card key={file.id} withBorder radius="md" p="xs">
                      <Image src={file.example_url || urls[file.id]} alt={file.description || file.file_name} h={220} fit="cover" radius="sm" />
                      <Stack gap={6} mt="sm">
                        <Group justify="space-between" gap="xs" align="flex-start"><Text fw={800} size="sm" style={{ flex: 1 }}>{file.description || file.file_name}</Text>{file.is_cover_photo && <Badge color="yellow" leftSection={<IconStar size={12} />}>Cover</Badge>}</Group>
                        <Text size="xs" c="dimmed">{isExample ? "SSU Two-Container Project · Customer-facing example" : `${new Date(file.photo_taken_at || file.created_at).toLocaleString()} · ${file.uploaded_by || "Metal Worx"}`}</Text>
                        {view === "Internal Story Board" && <Group grow>
                          <Button size="xs" variant="light" color={file.customer_visible ? "green" : "gray"} onClick={() => updatePhoto(file, { customer_visible: !file.customer_visible })}>{file.customer_visible ? "Customer Visible" : "Internal Only"}</Button>
                          <Button size="xs" variant="light" color="yellow" leftSection={<IconFlag size={14} />} onClick={() => updatePhoto(file, { is_cover_photo: true })}>Set Cover</Button>
                        </Group>}
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}

export default ProjectStoryBoard;
