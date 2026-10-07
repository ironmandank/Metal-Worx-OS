import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import {
  IconBook2,
  IconBox,
  IconBriefcase,
  IconClipboardList,
  IconFileDollar,
  IconSearch,
  IconTool,
  IconUser,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const RESULT_CONFIG = {
  customer: { label: "Customer", color: "blue", icon: IconUser },
  order: { label: "Customer Order", color: "red", icon: IconClipboardList },
  project: { label: "Outside Project", color: "orange", icon: IconBriefcase },
  quote: { label: "Quote / Invoice", color: "green", icon: IconFileDollar },
  productionJob: { label: "Production Job", color: "violet", icon: IconTool },
  inventory: { label: "Inventory Item", color: "cyan", icon: IconBox },
  crate: { label: "Crate / Location", color: "teal", icon: IconBox },
  manual: { label: "Manual", color: "gray", icon: IconBook2 },
};

function safeTerm(value) {
  return String(value || "")
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function includesTerm(values, term) {
  return values.filter(Boolean).join(" ").toLowerCase().includes(term.toLowerCase());
}

async function loadGlobalResults(rawTerm) {
  const term = safeTerm(rawTerm);
  if (term.length < 2) return [];
  const pattern = `%${term}%`;

  const [customers, orders, projects, quotes, jobs, inventory, bins, manuals] = await Promise.all([
    supabase.from("customers").select("id,customer_number,first_name,last_name,company_name,phone,email,is_active").or(`customer_number.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},company_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`).limit(8),
    supabase.from("customer_orders").select("id,order_number,status,due_date,artwork_customer_name,order_owner").or(`order_number.ilike.${pattern},artwork_customer_name.ilike.${pattern},order_owner.ilike.${pattern},notes.ilike.${pattern}`).limit(8),
    supabase.from("projects").select("id,project_number,project_name,status,assigned_to,contact_name,work_location,is_active").or(`project_number.ilike.${pattern},project_name.ilike.${pattern},contact_name.ilike.${pattern},work_location.ilike.${pattern}`).limit(8),
    supabase.from("project_quotes").select("id,quote_number,quote_title,customer_name,project_name,status,total_amount,document_type,quote_type,is_active").or(`quote_number.ilike.${pattern},quote_title.ilike.${pattern},customer_name.ilike.${pattern},project_name.ilike.${pattern}`).limit(8),
    supabase.from("production_jobs").select("id,production_job_number,status,current_department,due_date,is_active").or(`production_job_number.ilike.${pattern},current_department.ilike.${pattern},notes.ilike.${pattern}`).limit(8),
    supabase.from("inventory_items").select("id,item_number,sku,name,description,manufacturer_part_number,is_active,primary_image_url").or(`item_number.ilike.${pattern},sku.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern},manufacturer_part_number.ilike.${pattern}`).limit(8),
    supabase.from("inventory_bins").select("id,name,code,zone,description,is_active").or(`name.ilike.${pattern},code.ilike.${pattern},zone.ilike.${pattern},description.ilike.${pattern}`).limit(8),
    supabase.from("knowledge_manuals").select("id,title,category,manufacturer,description,file_name").or(`title.ilike.${pattern},category.ilike.${pattern},manufacturer.ilike.${pattern},description.ilike.${pattern},file_name.ilike.${pattern}`).limit(8),
  ]);

  const firstError = [customers, orders, projects, quotes, jobs, inventory, bins, manuals].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  return [
    ...(customers.data || []).map((row) => ({ type: "customer", record: row, title: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.company_name || "Customer", subtitle: [row.company_name, row.customer_number, row.phone].filter(Boolean).join(" · "), active: row.is_active !== false })),
    ...(orders.data || []).map((row) => ({ type: "order", record: row, title: row.artwork_customer_name || row.order_number || "Customer order", subtitle: [row.order_number, row.status, row.order_owner].filter(Boolean).join(" · "), active: !["Completed", "Closed", "Cancelled", "Canceled"].includes(row.status) })),
    ...(projects.data || []).map((row) => ({ type: "project", record: row, title: row.project_name || row.project_number || "Outside project", subtitle: [row.project_number, row.status, row.assigned_to].filter(Boolean).join(" · "), active: row.is_active !== false })),
    ...(quotes.data || []).map((row) => ({ type: "quote", record: row, title: row.quote_title || row.project_name || row.quote_number || "Quote", subtitle: [row.quote_number, row.customer_name, row.document_type || row.quote_type, row.status].filter(Boolean).join(" · "), active: row.is_active !== false })),
    ...(jobs.data || []).map((row) => ({ type: "productionJob", record: row, title: row.production_job_number || "Production job", subtitle: [row.current_department, row.status].filter(Boolean).join(" · "), active: row.is_active !== false })),
    ...(inventory.data || []).map((row) => ({ type: "inventory", record: row, title: row.name || row.item_number || "Inventory item", subtitle: [row.item_number, row.sku, row.manufacturer_part_number].filter(Boolean).join(" · "), active: row.is_active !== false })),
    ...(bins.data || []).map((row) => ({ type: "crate", record: row, title: row.code || row.name || "Storage location", subtitle: [row.name, row.zone, row.description].filter((value, index, values) => value && values.indexOf(value) === index).join(" · "), active: row.is_active !== false })),
    ...(manuals.data || []).map((row) => ({ type: "manual", record: row, title: row.title || row.file_name || "Manual", subtitle: [row.category, row.manufacturer, row.file_name].filter(Boolean).join(" · "), active: true })),
  ].filter((result) => includesTerm([result.title, result.subtitle], term));
}

export default function SearchBar({ onOpenResult }) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!opened) return undefined;
    const term = safeTerm(query);
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const nextResults = await loadGlobalResults(term);
        if (requestId.current === currentRequest) {
          setResults(nextResults);
          setError("");
        }
      } catch (loadError) {
        if (requestId.current === currentRequest) {
          setError(loadError?.message || "Search could not be completed.");
          setResults([]);
        }
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [opened, query]);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpened(true);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const grouped = useMemo(() => results.reduce((groups, result) => {
    groups[result.type] = groups[result.type] || [];
    groups[result.type].push(result);
    return groups;
  }, {}), [results]);

  function openResult(result) {
    setOpened(false);
    setQuery("");
    onOpenResult?.(result);
  }

  return <>
    <button type="button" className="mw-topbar-search" data-tour="global-search" onClick={() => setOpened(true)} aria-label="Search Metal Worx OS">
      <IconSearch />
      <span>Search orders, customers, jobs, projects, inventory...</span>
      <kbd>Ctrl K</kbd>
    </button>
    <Modal opened={opened} onClose={() => setOpened(false)} title="Search Metal Worx OS" size="xl" centered>
      <Stack gap="md">
        <TextInput autoFocus size="lg" leftSection={<IconSearch size={20}/>} rightSection={loading ? <Loader size="sm"/> : null} placeholder="Enter a name, number, item, crate, quote, or manual..." value={query} onChange={(event) => setQuery(event.currentTarget.value)}/>
        {error && <Text c="red" size="sm">{error}</Text>}
        {query.trim().length < 2 ? <Text c="dimmed" ta="center" py="xl">Type at least two characters to search the entire app.</Text> : !loading && results.length === 0 ? <Text c="dimmed" ta="center" py="xl">No matching records were found.</Text> : <Stack gap="lg">
          {Object.entries(grouped).map(([type, items]) => {
            const config = RESULT_CONFIG[type];
            const ResultIcon = config.icon;
            return <Box key={type}>
              <Group gap="xs" mb="xs"><ThemeIcon color={config.color} variant="light"><ResultIcon size={18}/></ThemeIcon><Text fw={900}>{config.label}s</Text><Badge variant="light" color={config.color}>{items.length}</Badge></Group>
              <Stack gap={6}>{items.map((result) => <Paper key={`${type}-${result.record.id}`} component="button" type="button" withBorder radius="md" p="sm" onClick={() => openResult(result)} style={{ cursor: "pointer", textAlign: "left", color: "inherit", background: "rgba(255,255,255,.025)" }}>
                <Group justify="space-between" wrap="nowrap"><Box style={{ minWidth: 0 }}><Text fw={800} truncate>{result.title}</Text><Text size="sm" c="dimmed" truncate>{result.subtitle || config.label}</Text></Box>{!result.active && <Badge color="gray" variant="light">Archived</Badge>}</Group>
              </Paper>)}</Stack>
            </Box>;
          })}
        </Stack>}
      </Stack>
    </Modal>
  </>;
}
