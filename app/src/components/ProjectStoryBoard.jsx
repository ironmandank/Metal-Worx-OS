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
import { IconArrowRight, IconCamera, IconDownload, IconEye, IconFlag, IconPhoto, IconStar, IconUpload } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { downloadStoryBoardPdf } from "../services/storyBoardPdfExportService";

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
  { id: "ssu-9336", file_name: "IMG_9336.jpeg", story_stage: "Concept & Scope", description: "Connex Arrival - The 40-foot container arrives at Metal Worx in its original exterior condition, ready for the planned interior steel conversion.", example_url: "/storyboard-examples/ssu/IMG_9336.svg", is_cover_photo: true },
  { id: "ssu-9337", file_name: "IMG_9337.jpeg", story_stage: "Concept & Scope", description: "Original Interior Condition - The empty container is documented before fabrication begins, establishing the starting condition and available working space.", example_url: "/storyboard-examples/ssu/IMG_9337.svg" },
  { id: "ssu-9268", file_name: "IMG_9268.jpeg", story_stage: "Fabrication", description: "Building the Structural Foundation — Our fabrication team welds the interior floor structure, creating a strong foundation for the steel-lined container.", example_url: "/storyboard-examples/ssu/IMG_9268.svg" },
  { id: "ssu-9338", file_name: "IMG_9338.jpeg", story_stage: "Fabrication", description: "Overhead Steel Installation - The team fits and welds the upper steel structure while maintaining alignment with the wall-support system.", example_url: "/storyboard-examples/ssu/IMG_9338.svg" },
  { id: "ssu-9315", file_name: "IMG_9315.jpeg", story_stage: "Fabrication", description: "Positioning the Steel Floor — Steel floor sections are positioned and aligned throughout the container before final welding.", example_url: "/storyboard-examples/ssu/IMG_9315.svg" },
  { id: "ssu-9316", file_name: "IMG_9316.jpeg", story_stage: "Test Fit", description: "Checking Fit and Alignment — Each section is checked for fit, spacing, and accessibility before the installation is finalized.", example_url: "/storyboard-examples/ssu/IMG_9316.svg" },
  { id: "ssu-9320", file_name: "IMG_9320.jpeg", story_stage: "Fabrication", description: "Reinforcing the Upper Structure — Custom steel framing is installed around the upper opening to strengthen the enclosure and support the interior lining.", example_url: "/storyboard-examples/ssu/IMG_9320.svg" },
  { id: "ssu-9321", file_name: "IMG_9321.jpeg", story_stage: "Installation", description: "Creating a Continuous Steel Floor — The fitted floor panels create a durable working surface from the entrance to the rear wall.", example_url: "/storyboard-examples/ssu/IMG_9321.svg" },
  { id: "ssu-9330", file_name: "IMG_9330.jpeg", story_stage: "Fabrication", description: "Installing Wall Support Rails — Horizontal steel supports are welded along the container walls to provide secure mounting points for future equipment and components.", example_url: "/storyboard-examples/ssu/IMG_9330.svg" },
  { id: "ssu-9331", file_name: "IMG_9331.jpeg", story_stage: "Fabrication", description: "Full-Length Wall Reinforcement — The wall-support system is aligned and welded throughout the full length of the container.", example_url: "/storyboard-examples/ssu/IMG_9331.svg" },
  { id: "ssu-9334", file_name: "IMG_9334.jpeg", story_stage: "Installation", description: "Enclosing the End Wall — Custom-cut steel panels are fitted to the end wall and secured around the reinforced structure.", example_url: "/storyboard-examples/ssu/IMG_9334.svg" },
  { id: "ssu-9335", file_name: "IMG_9335.jpeg", story_stage: "Installation", description: "Completing the Interior Steel Lining — Final wall sections and attachment points create a strong and functional interior enclosure.", example_url: "/storyboard-examples/ssu/IMG_9335.svg" },
];

const SSU_OVERVIEW = "Metal Worx transformed two 40-foot shipping containers with custom-fabricated interior steel lining. The work included fitting and welding the steel floor, installing full-length wall supports, reinforcing the upper structure, and enclosing the end walls to create a durable interior ready for the project's next phase.";

const PRESENTATION_TEMPLATES = [
  { value: "industrial", label: "Industrial Story - Dark" },
  { value: "portfolio", label: "Executive Portfolio - Light" },
  { value: "field", label: "Field Progress - Technical" },
  { value: "blueprint", label: "Blueprint Build Record" },
  { value: "collage", label: "Fabrication Photo Collage" },
  { value: "photojournal", label: "Full-Photo Project Journal" },
];

const TEMPLATE_DESCRIPTIONS = {
  industrial: "Black and red feature pages with bold fabrication photography.",
  portfolio: "Clean white executive pages for leadership and customer review.",
  field: "Structured progress pages for milestones, notes, and field records.",
  blueprint: "Technical drawing-inspired pages for measurements and build details.",
  collage: "Mixed large-and-small photo arrangements for busy fabrication phases.",
  photojournal: "Full-width photography with concise milestone storytelling.",
};

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
  const [view, setView] = useState("Internal Project Story");
  const [presentationTemplate, setPresentationTemplate] = useState("industrial");
  const [exporting, setExporting] = useState(null);

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
    () => view === "SSU Connex Project Story" ? SSU_EXAMPLE : view === "Customer Presentation" ? files.filter((file) => file.customer_visible) : files,
    [files, view],
  );

  const isExample = view === "SSU Connex Project Story";
  const coverFile = visibleFiles.find((file) => file.is_cover_photo) || visibleFiles[0];
  const coverUrl = coverFile ? (coverFile.example_url || urls[coverFile.id]) : null;
  const coverBackground = presentationTemplate === "portfolio"
    ? "linear-gradient(135deg, rgba(248,248,248,.98), rgba(218,218,218,.92))"
    : presentationTemplate === "field"
      ? "linear-gradient(135deg, rgba(27,31,36,.97), rgba(65,70,76,.92))"
      : "linear-gradient(135deg, rgba(130,0,15,.96), rgba(14,14,15,.97))";
  const coverTextColor = presentationTemplate === "portfolio" ? "dark" : "white";

  const completedStages = useMemo(
    () => new Set(files.map((file) => file.story_stage).filter(Boolean)).size,
    [files],
  );
  const displayedStageCount = isExample
    ? new Set(SSU_EXAMPLE.map((file) => file.story_stage)).size
    : completedStages;
  const storyOverview = isExample
    ? SSU_OVERVIEW
    : project.project_description || project.description || project.scope_of_work || "Project progress will be documented from the original scope through final completion.";
  const documentedStages = STORY_STAGES.filter((storyStage) => visibleFiles.some((file) => file.story_stage === storyStage));
  const currentStage = documentedStages.at(-1) || "Planning";
  const nextStage = STORY_STAGES[STORY_STAGES.indexOf(currentStage) + 1] || "Final review and closeout";
  const storyCompletion = Math.min(100, Math.round((displayedStageCount / STORY_STAGES.length) * 100));

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

  async function exportPdf(mode) {
    setExporting(mode);
    try {
      const exportFiles = isExample
        ? SSU_EXAMPLE
        : mode === "customer"
          ? files.filter((file) => file.customer_visible)
          : files;
      if (!exportFiles.length) {
        notifications.show({ title: "No Photos to Export", message: mode === "customer" ? "Mark at least one photo customer-visible before exporting." : "Add a project photo before exporting.", color: "orange" });
        return;
      }
      await downloadStoryBoardPdf({
        project: isExample ? { ...project, project_name: "SSU Two-Container Project", contact_name: "SSU" } : project,
        files: exportFiles,
        imageUrls: urls,
        mode,
        template: presentationTemplate,
        overview: storyOverview,
      });
    } catch (error) {
      notifications.show({ title: "PDF Could Not Be Exported", message: error.message, color: "red" });
    } finally {
      setExporting(null);
    }
  }

  if (loading) return <Group justify="center" py="xl"><Loader color="red" /><Text>Loading project story…</Text></Group>;

  return (
    <Stack gap="lg">
      <Paper p={0} radius="lg" withBorder style={{ overflow: "hidden" }}>
        <SimpleGrid cols={{ base: 1, md: coverUrl ? 2 : 1 }} spacing={0}>
          <Stack justify="space-between" p={32} mih={coverUrl ? 340 : 240} style={{ background: coverBackground }}>
            <div>
              <Text size="xs" c={presentationTemplate === "portfolio" ? "red.8" : "red.2"} fw={900} tt="uppercase" lts={1.8}>Metal Worx · Project Story</Text>
              <Title order={1} c={coverTextColor} mt="sm">{isExample ? "SSU Connex Project" : project.project_name || "Large Project"}</Title>
              <Text c={presentationTemplate === "portfolio" ? "dimmed" : "gray.3"} mt="xs">{isExample ? "Two-Container Interior Steel Conversion" : project.project_number}</Text>
            </div>
            <div>
              <Text c={coverTextColor} size="lg" fw={700}>Custom Metal. Built to Last.</Text>
              <Text c={presentationTemplate === "portfolio" ? "dimmed" : "gray.4"} size="sm">Veteran Owned · American Made · Built Strong. Finished Right.</Text>
            </div>
          </Stack>
          {coverUrl && <Image src={coverUrl} alt="Project cover" h={340} fit="cover" />}
        </SimpleGrid>
        <Stack p="lg" gap="xs">
          <Group justify="space-between"><Text fw={900}>Project documentation</Text><Badge color="red" variant="filled">{displayedStageCount} / {STORY_STAGES.length} stages</Badge></Group>
          <Progress value={(displayedStageCount / STORY_STAGES.length) * 100} color="red" size="md" radius="xl" />
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="xl" style={{ borderTop: "5px solid var(--mantine-color-red-8)" }}>
        <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
          <div>
            <Text size="xs" c="red.7" fw={900} tt="uppercase" lts={1.6}>Executive Summary</Text>
            <Title order={2} mt={4}>{isExample ? "SSU Connex Project" : project.project_name || "Project Overview"}</Title>
          </div>
          <Badge size="lg" color="red" variant="light">{storyCompletion}% documented</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="sm">
            <Text size="sm" lh={1.65}>{storyOverview}</Text>
            <Group gap="xs" wrap="wrap">
              <Badge color="dark" variant="filled">{displayedStageCount} documented phases</Badge>
              <Badge color="gray" variant="light">{visibleFiles.length} progress photos</Badge>
            </Group>
          </Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Paper p="md" radius="md" bg="dark.8">
              <Text size="xs" c="red.3" fw={900} tt="uppercase">Current phase</Text>
              <Text c="white" fw={900} mt={5}>{currentStage}</Text>
            </Paper>
            <Paper p="md" radius="md" bg="dark.8">
              <Text size="xs" c="red.3" fw={900} tt="uppercase">Next milestone</Text>
              <Text c="white" fw={900} mt={5}>{nextStage}</Text>
            </Paper>
          </SimpleGrid>
        </SimpleGrid>
      </Paper>

      {documentedStages.length > 1 && (
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="lg">
            <div><Text fw={900} size="lg">How It Came Together</Text><Text size="sm" c="dimmed">The PDF presents these milestones from left to right.</Text></div>
            <Badge color="red" variant="filled">Build progression</Badge>
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 8 }}>
            {documentedStages.map((storyStage, index) => (
              <Group key={storyStage} gap="xs" wrap="nowrap" style={{ flex: "0 0 auto" }}>
                <Paper px="md" py="sm" radius="xl" bg="red.9" c="white">
                  <Text size="sm" fw={900}>{String(index + 1).padStart(2, "0")} · {storyStage}</Text>
                </Paper>
                {index < documentedStages.length - 1 && <IconArrowRight size={18} color="var(--mantine-color-red-7)" />}
              </Group>
            ))}
          </Group>
        </Card>
      )}

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
          <Button color="red" loading={uploading} onClick={uploadPhotos} leftSection={<IconUpload size={17} />}>Add to Project Story</Button>
        </Stack>
      </Card>

      <Group justify="space-between" align="center" wrap="wrap">
        <div><Title order={3}>Project Story</Title><Text size="sm" c="dimmed">Build a professional visual presentation from the original scope through installation.</Text></div>
        <Group gap="xs">
          <Select w={245} label="PDF presentation style" aria-label="Presentation template" data={PRESENTATION_TEMPLATES} value={presentationTemplate} onChange={(value) => setPresentationTemplate(value || "industrial")} allowDeselect={false} />
          <Button variant="light" color="red" leftSection={<IconDownload size={16} />} loading={exporting === "internal"} onClick={() => exportPdf("internal")}>Internal Project Record</Button>
          <Button variant="light" color="gray" leftSection={<IconDownload size={16} />} loading={exporting === "customer"} onClick={() => exportPdf("customer")}>Customer Presentation</Button>
          <SegmentedControl value={view} onChange={setView} data={["Internal Project Story", "Customer Presentation", "SSU Connex Project Story"]} />
        </Group>
      </Group>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="md" align="flex-start">
          <div><Text fw={900} size="lg">Project Story Template Library</Text><Text size="sm" c="dimmed">Choose a design family for the export. Photo layouts expand automatically as the project grows.</Text></div>
          <Badge color="red" variant="light">6 design families</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
          {PRESENTATION_TEMPLATES.map((item) => (
            <Paper
              key={item.value}
              withBorder
              radius="md"
              p="md"
              role="button"
              tabIndex={0}
              onClick={() => setPresentationTemplate(item.value)}
              onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) setPresentationTemplate(item.value); }}
              style={{ cursor: "pointer", borderColor: presentationTemplate === item.value ? "var(--mantine-color-red-7)" : undefined, borderWidth: presentationTemplate === item.value ? 2 : 1 }}
            >
              <Group justify="space-between" gap="xs"><Text fw={900} size="sm">{item.label}</Text>{presentationTemplate === item.value && <Badge size="xs" color="red">Selected</Badge>}</Group>
              <Text size="xs" c="dimmed" mt={6}>{TEMPLATE_DESCRIPTIONS[item.value]}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Card>

      {isExample && (
        <Alert color="red" icon={<IconStar size={18} />} title="SSU Connex Story Board - Two-Container Project">
          <Text size="sm">{SSU_OVERVIEW}</Text>
          <Text size="sm" fw={900} mt="xs">Custom Metal. Built to Last. · Veteran Owned · American Made · Built Strong. Finished Right.</Text>
        </Alert>
      )}

      {view === "Customer Presentation" && !files.some((file) => file.customer_visible) && (
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
                        {view === "Internal Project Story" && <Group grow>
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
