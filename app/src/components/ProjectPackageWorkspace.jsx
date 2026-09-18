import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArchive,
  IconCamera,
  IconCircleCheck,
  IconClipboardCopy,
  IconDownload,
  IconFile,
  IconFileDescription,
  IconFileInvoice,
  IconPackage,
  IconPencil,
  IconRefresh,
  IconSettingsAutomation,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import JSZip from "jszip";

import { supabase } from "../lib/supabase";

const FILE_CATEGORIES = [
  "Estimate / Site Photo",
  "Customer File",
  "Drawing / Design",
  "Quote / Proposal",
  "Signed Approval / Contract",
  "Production File",
  "Material Document",
  "Completion Photo",
  "Completion Document",
  "Other Project File",
];

const FILE_SECTIONS = [
  {
    key: "estimate",
    title: "Estimate & Site Photos",
    description: "Customer reference images, job-site conditions, measurements, and estimate photos.",
    color: "blue",
    icon: IconCamera,
    categories: ["Estimate / Site Photo", "Site Photo"],
  },
  {
    key: "customer",
    title: "Customer Files",
    description: "Photos, sketches, specifications, and documents received from the customer.",
    color: "cyan",
    icon: IconFileDescription,
    categories: ["Customer File"],
  },
  {
    key: "design",
    title: "Drawings & Design",
    description: "Approved layouts, shop drawings, CAD exports, and design revisions.",
    color: "violet",
    icon: IconPencil,
    categories: ["Drawing / Design"],
  },
  {
    key: "commercial",
    title: "Quotes & Signed Approvals",
    description: "Proposals, contracts, signed approvals, and customer authorization records.",
    color: "green",
    icon: IconFileInvoice,
    categories: ["Quote / Proposal", "Signed Approval / Contract"],
  },
  {
    key: "production",
    title: "Production & Material Files",
    description: "Cut files, fabrication references, material documents, and in-process photos.",
    color: "orange",
    icon: IconSettingsAutomation,
    categories: ["Production File", "Material Document", "Fabrication Photo"],
  },
  {
    key: "completion",
    title: "Completion Photos & Records",
    description: "Installation photos, final inspection records, and completed-project documents.",
    color: "teal",
    icon: IconCircleCheck,
    categories: ["Completion Photo", "Completion Document", "Installation Photo"],
  },
  {
    key: "other",
    title: "Other Project Files",
    description: "General project records that do not belong in another section.",
    color: "gray",
    icon: IconFile,
    categories: ["Other Project File", "Project File"],
  },
];

function sectionForFile(file) {
  return FILE_SECTIONS.find((section) => section.categories.includes(file.category)) || FILE_SECTIONS[FILE_SECTIONS.length - 1];
}

function safeFileName(value) {
  return String(value || "project-file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectPackageWorkspace({ project, activeUser }) {
  const [files, setFiles] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [category, setCategory] = useState("Estimate / Site Photo");
  const [description, setDescription] = useState("");
  const [targetProjectId, setTargetProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [isAdministrator, setIsAdministrator] = useState(false);

  async function loadPackage() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [fileResult, checklistResult, projectResult, sessionResult] = await Promise.all([
        supabase.from("project_files").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
        supabase.from("project_checklist_items").select("*").eq("project_id", project.id).order("sort_order", { ascending: true }).order("id", { ascending: true }),
        supabase.from("projects").select("id, project_number, project_name, assigned_to").eq("is_active", true).neq("id", project.id).order("created_at", { ascending: false }),
        supabase.auth.getSession(),
      ]);
      if (fileResult.error) throw fileResult.error;
      if (checklistResult.error) throw checklistResult.error;
      if (projectResult.error) throw projectResult.error;
      setFiles(fileResult.data || []);
      setChecklist(checklistResult.data || []);
      setTargets(projectResult.data || []);

      const userId = sessionResult.data?.session?.user?.id;
      if (userId) {
        const { data } = await supabase.from("employee_profiles").select("access_level").eq("auth_user_id", userId).maybeSingle();
        setIsAdministrator(data?.access_level === "Administrator");
      }
    } catch (error) {
      notifications.show({ title: "Project Package Could Not Load", message: error.message, color: "red" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackage();
  }, [project?.id]);

  const completedChecklist = useMemo(
    () => checklist.filter((item) => item.status === "Complete").length,
    [checklist],
  );

  const filesBySection = useMemo(() => {
    const grouped = Object.fromEntries(FILE_SECTIONS.map((section) => [section.key, []]));
    files.forEach((file) => grouped[sectionForFile(file).key].push(file));
    return grouped;
  }, [files]);

  async function uploadFiles() {
    if (!selectedFiles.length) return;
    setUploading(true);
    const uploadedPaths = [];
    try {
      for (const file of selectedFiles) {
        const path = `${project.id}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { error: rowError } = await supabase.from("project_files").insert({
          project_id: project.id,
          file_name: file.name,
          storage_path: path,
          file_type: file.type || null,
          file_size: file.size,
          category,
          description: description.trim() || null,
          uploaded_by: activeUser || null,
        });
        if (rowError) throw rowError;
      }
      setSelectedFiles([]);
      setDescription("");
      await loadPackage();
      notifications.show({ title: "Project Files Saved", message: `${uploadedPaths.length} file${uploadedPaths.length === 1 ? "" : "s"} added to the package.`, color: "green" });
    } catch (error) {
      for (const path of uploadedPaths) await supabase.storage.from("project-files").remove([path]);
      notifications.show({ title: "Upload Failed", message: error.message, color: "red" });
    } finally {
      setUploading(false);
    }
  }

  async function getSignedUrl(file) {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(file.storage_path, 300);
    if (error) throw error;
    return data.signedUrl;
  }

  async function downloadFile(file) {
    try {
      const url = await getSignedUrl(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.file_name;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } catch (error) {
      notifications.show({ title: "Download Failed", message: error.message, color: "red" });
    }
  }

  async function downloadAllFiles() {
    if (!files.length) return;
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (const file of files) {
        const response = await fetch(await getSignedUrl(file));
        if (!response.ok) throw new Error(`Could not download ${file.file_name}.`);
        const section = sectionForFile(file);
        zip.folder(section.title).file(`${file.id}-${safeFileName(file.file_name)}`, await response.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileName(project.project_number || project.project_name)}-project-package.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({ title: "Package Download Failed", message: error.message, color: "red" });
    } finally {
      setDownloadingAll(false);
    }
  }

  async function deleteFile(file) {
    if (!window.confirm(`Permanently remove ${file.file_name} from this project package?`)) return;
    try {
      const { error: storageError } = await supabase.storage.from("project-files").remove([file.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("project_files").delete().eq("id", file.id);
      if (error) throw error;
      await loadPackage();
    } catch (error) {
      notifications.show({ title: "File Could Not Be Removed", message: error.message, color: "red" });
    }
  }

  async function copyChecklist() {
    if (!targetProjectId) {
      notifications.show({ title: "Choose a Project", message: "Select the new project that should receive this checklist.", color: "orange" });
      return;
    }
    if (!checklist.length) {
      notifications.show({ title: "No Checklist to Copy", message: "This project package has no checklist items.", color: "orange" });
      return;
    }
    if (!window.confirm(`Copy ${checklist.length} checklist items as new, incomplete tasks?`)) return;
    setCopying(true);
    try {
      const target = targets.find((item) => String(item.id) === String(targetProjectId));
      const rows = checklist.map((item, index) => ({
        project_id: Number(targetProjectId),
        phase: item.phase || null,
        task_title: item.task_title,
        task_description: item.task_description || null,
        sort_order: index + 1,
        assigned_to: target?.assigned_to || null,
        priority: item.priority || "Normal",
        status: "Not Started",
        target_date: null,
        blocker: null,
        notes: null,
        completed_at: null,
      }));
      const { error } = await supabase.from("project_checklist_items").insert(rows);
      if (error) throw error;
      notifications.show({ title: "Checklist Copied", message: `${rows.length} blank checklist items were added to ${target?.project_number || "the selected project"}.`, color: "green" });
      setTargetProjectId(null);
    } catch (error) {
      notifications.show({ title: "Checklist Could Not Be Copied", message: error.message, color: "red" });
    } finally {
      setCopying(false);
    }
  }

  if (loading) return <Group justify="center" py="xl"><Loader color="red" /><Text>Loading project package…</Text></Group>;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="lg" p="lg"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Package Status</Text><Title order={3}>{project.status === "Completed" ? "Completed" : "In Progress"}</Title></Card>
        <Card withBorder radius="lg" p="lg"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Saved Files</Text><Title order={3}>{files.length}</Title></Card>
        <Card withBorder radius="lg" p="lg"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Checklist</Text><Title order={3}>{completedChecklist}/{checklist.length}</Title></Card>
      </SimpleGrid>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="md"><div><Group gap="xs"><IconPackage size={22} /><Title order={3}>Project Files & Photos</Title></Group><Text size="sm" c="dimmed">Upload each item into the section that tells the team when and how it should be used.</Text></div><Button variant="light" color="gray" leftSection={<IconRefresh size={16} />} onClick={loadPackage}>Refresh</Button></Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <FileInput multiple clearable label="Choose Photos or Documents" placeholder="Select one or more files" value={selectedFiles} onChange={(value) => setSelectedFiles(value || [])} leftSection={<IconFile size={17} />} />
          <Select label="Save In" data={FILE_CATEGORIES} value={category} onChange={(value) => setCategory(value || "Other Project File")} />
          <Textarea label="File Notes" placeholder="Example: Customer sketch received by email, final railing layout, or completed north-side installation." value={description} onChange={(event) => setDescription(event.currentTarget.value)} minRows={2} />
          <Group align="end"><Button color="red" leftSection={<IconUpload size={17} />} loading={uploading} disabled={!selectedFiles.length} onClick={uploadFiles}>Add to Project Package</Button><Button variant="light" color="blue" leftSection={<IconArchive size={17} />} loading={downloadingAll} disabled={!files.length} onClick={downloadAllFiles}>Download All Files</Button></Group>
        </SimpleGrid>

        <Stack gap="md" mt="lg">
          {files.length === 0 ? <Alert color="gray" icon={<IconFile size={18} />}>No project photos or documents have been uploaded yet. Use the form above to add customer images, drawings, approvals, production files, or completion photos.</Alert> : FILE_SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const sectionFiles = filesBySection[section.key];
            return (
              <Card key={section.key} withBorder radius="lg" p="md">
                <Group justify="space-between" align="flex-start" mb={sectionFiles.length ? "md" : 0} wrap="wrap">
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <SectionIcon size={21} color={`var(--mantine-color-${section.color}-5)`} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <Text fw={900}>{section.title}</Text>
                      <Text size="xs" c="dimmed">{section.description}</Text>
                    </div>
                  </Group>
                  <Badge color={section.color} variant="light">{sectionFiles.length} {sectionFiles.length === 1 ? "file" : "files"}</Badge>
                </Group>
                {sectionFiles.length > 0 && (
                  <Stack gap="xs">
                    {sectionFiles.map((file) => (
                      <Card key={file.id} withBorder radius="md" p="sm">
                        <Group justify="space-between" align="flex-start" wrap="wrap">
                          <div style={{ minWidth: 0, flex: "1 1 320px" }}><Text fw={800} style={{ overflowWrap: "anywhere" }}>{file.file_name}</Text><Group gap="xs" mt={5} wrap="wrap"><Badge color={section.color} variant="light">{file.category || "Project File"}</Badge><Text size="xs" c="dimmed">{formatBytes(file.file_size)} · {new Date(file.created_at).toLocaleDateString()} · {file.uploaded_by || "Metal Worx"}</Text></Group>{file.description && <Text size="sm" mt="xs" style={{ whiteSpace: "pre-wrap" }}>{file.description}</Text>}</div>
                          <Group gap="xs" wrap="wrap"><Button size="xs" variant="light" leftSection={<IconDownload size={15} />} onClick={() => downloadFile(file)}>Download</Button>{isAdministrator && <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={15} />} onClick={() => deleteFile(file)}>Delete</Button>}</Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Card>
            );
          })}
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Group gap="xs"><IconClipboardCopy size={22} /><Title order={3}>Reuse This Checklist</Title></Group>
        <Text size="sm" c="dimmed" mt={4} mb="md">Copy this package’s checklist to another active project. Every copied item starts blank, incomplete, and without old dates, blockers, or notes.</Text>
        {!checklist.length ? <Alert color="gray">This project does not have a checklist to reuse.</Alert> : !targets.length ? <Alert color="orange" icon={<IconAlertTriangle size={18} />}>Create the new project first, then return here to copy this checklist into it.</Alert> : <Group align="end"><Select searchable label="New / Active Project" placeholder="Choose destination project" data={targets.map((item) => ({ value: String(item.id), label: `${item.project_number || "Project"} — ${item.project_name || "Unnamed"}` }))} value={targetProjectId} onChange={setTargetProjectId} style={{ flex: 1, minWidth: 260 }} /><Button color="red" leftSection={<IconClipboardCopy size={17} />} loading={copying} onClick={copyChecklist}>Copy Blank Checklist</Button></Group>}
      </Card>
    </Stack>
  );
}

export default ProjectPackageWorkspace;
