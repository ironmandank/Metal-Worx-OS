import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, FileInput, Group, Loader, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBook2, IconDownload, IconFileTypePdf, IconSearch, IconUpload } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const CATEGORIES = ["Equipment", "Laser", "Welding", "Powder Coating", "Safety", "Software", "Vehicle", "General"];

function safeFileName(value) {
  return String(value || "manual.pdf").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 150);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ManualLibrary({ activeUser }) {
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Equipment");
  const [manufacturer, setManufacturer] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const requestedManual = sessionStorage.getItem("mwKnowledgeManualSearch");
    if (requestedManual) {
      setSearch(requestedManual);
      sessionStorage.removeItem("mwKnowledgeManualSearch");
    }
  }, []);

  async function loadManuals() {
    setLoading(true);
    const { data, error } = await supabase.from("knowledge_manuals").select("*").order("title");
    if (error) notifications.show({ title: "Manuals Could Not Load", message: error.message, color: "red" });
    else setManuals(data || []);
    setLoading(false);
  }

  useEffect(() => { loadManuals(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return manuals;
    return manuals.filter((manual) => [manual.title, manual.category, manual.manufacturer, manual.description, manual.file_name].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [manuals, search]);

  async function uploadManual() {
    if (!file || !title.trim()) {
      notifications.show({ title: "Manual Information Required", message: "Choose a file and enter its title.", color: "orange" });
      return;
    }
    setUploading(true);
    const storagePath = `manuals/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from("project-files").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      const { error: rowError } = await supabase.from("knowledge_manuals").insert({
        title: title.trim(), category, manufacturer: manufacturer.trim() || null,
        description: description.trim() || null, file_name: file.name, storage_path: storagePath,
        file_type: file.type || null, file_size: file.size, uploaded_by: activeUser || null,
      });
      if (rowError) {
        await supabase.storage.from("project-files").remove([storagePath]);
        throw rowError;
      }
      setFile(null); setTitle(""); setManufacturer(""); setDescription("");
      await loadManuals();
      notifications.show({ title: "Manual Uploaded", message: `${file.name} is now available in the Knowledge Center.`, color: "green" });
    } catch (error) {
      notifications.show({ title: "Manual Upload Failed", message: error.message, color: "red" });
    } finally { setUploading(false); }
  }

  async function openManual(manual) {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(manual.storage_path, 600);
    if (error) notifications.show({ title: "Manual Could Not Open", message: error.message, color: "red" });
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Card withBorder radius="lg" p="xl">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div><Title order={2} c="white">Manuals Library</Title><Text c="dimmed">Upload equipment, software, safety, and shop manuals for the team.</Text></div>
        <Badge color="blue" variant="light" size="lg">{manuals.length} Manual{manuals.length === 1 ? "" : "s"}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} mb="md">
        <TextInput label="Manual title" placeholder="Example: Miller Welder Manual" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        <Select label="Category" data={CATEGORIES} value={category} onChange={(value) => setCategory(value || "General")} allowDeselect={false} />
        <TextInput label="Manufacturer" placeholder="Optional" value={manufacturer} onChange={(event) => setManufacturer(event.currentTarget.value)} />
        <FileInput label="Manual file" placeholder="Choose PDF or document" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={file} onChange={setFile} clearable />
      </SimpleGrid>
      <Textarea label="Description or model number" placeholder="Optional notes to help employees find the correct manual" value={description} onChange={(event) => setDescription(event.currentTarget.value)} minRows={2} />
      <Group justify="flex-end" mt="md"><Button color="red" leftSection={<IconUpload size={18} />} loading={uploading} onClick={uploadManual}>Upload Manual</Button></Group>

      <TextInput mt="xl" mb="md" leftSection={<IconSearch size={18} />} placeholder="Search manuals, manufacturers, models, or categories" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
      {loading ? <Group justify="center" py="xl"><Loader color="red" /><Text>Loading manuals…</Text></Group> : filtered.length ? (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
          {filtered.map((manual) => (
            <Card key={manual.id} withBorder radius="md" p="lg">
              <Group align="flex-start" wrap="nowrap"><IconFileTypePdf size={28} color="var(--mantine-color-red-6)" /><div style={{ minWidth: 0 }}><Text fw={900} c="white">{manual.title}</Text><Text size="sm" c="dimmed">{[manual.manufacturer, manual.category].filter(Boolean).join(" · ")}</Text></div></Group>
              {manual.description && <Text size="sm" mt="sm">{manual.description}</Text>}
              <Group justify="space-between" mt="md"><Text size="xs" c="dimmed">{formatBytes(manual.file_size)}</Text><Button size="xs" variant="light" color="blue" leftSection={<IconDownload size={15} />} onClick={() => openManual(manual)}>Open Manual</Button></Group>
            </Card>
          ))}
        </SimpleGrid>
      ) : <Alert color="gray" icon={<IconBook2 size={18} />}>No manuals match this search. Upload the first manual above.</Alert>}
    </Card>
  );
}
