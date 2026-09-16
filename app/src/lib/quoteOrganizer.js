function cleanLine(value) {
  return String(value || "")
    .replace(/^\s*[-*•]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function moneyValue(value) {
  const match = String(value || "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function fieldValue(lines, labels) {
  const lowered = labels.map((label) => label.toLowerCase());
  for (const source of lines) {
    const line = cleanLine(source);
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const label = line.slice(0, separator).trim().toLowerCase();
    if (lowered.includes(label)) return line.slice(separator + 1).trim();
  }
  return "";
}

function sectionLines(lines, headingNames) {
  const headings = new Set(headingNames.map((heading) => heading.toLowerCase()));
  const allKnownHeadings = new Set([
    "quote summary",
    "project scope",
    "scope of work",
    "process",
    "project process",
    "schedule",
    "specifications",
    "included services",
    "exclusions",
    "customer responsibilities",
    "assumptions",
    "notes",
    "terms",
  ]);
  let collecting = false;
  const found = [];
  for (const source of lines) {
    const line = cleanLine(source);
    const normalized = line.replace(/:$/, "").toLowerCase();
    if (headings.has(normalized)) {
      collecting = true;
      continue;
    }
    if (collecting && allKnownHeadings.has(normalized)) break;
    if (collecting && line) found.push(line);
  }
  return found;
}

function inferPrimaryItem(itemText, rateText) {
  const quantityMatch = itemText.match(/([\d,.]+)\s*(?:total\s*)?(?:linear\s*)?(feet|foot|ft)\b/i);
  const quantity = quantityMatch ? Number(quantityMatch[1].replace(/,/g, "")) : 1;
  const unit = quantityMatch ? "Linear Foot" : "Each";
  const title = itemText
    .replace(quantityMatch?.[0] || "", "")
    .replace(/^\s*(?:of\s+)?/i, "")
    .trim() || "Quoted Work";
  const parenthetical = rateText.match(/\(([^)]+)\)/)?.[1] || "";
  return {
    item_type: "Service",
    title,
    description: parenthetical,
    quantity,
    unit,
    unit_price: moneyValue(rateText),
  };
}

export function emptyOrganizedQuote() {
  return {
    customer_name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    quote_title: "",
    items: [],
    scope_of_work: "",
    specifications: "",
    included_services: "",
    exclusions: "",
    project_schedule: "",
    down_payment_terms: "",
    payment_terms: "",
    price_notes: "",
    tax_rate: 0.07,
  };
}

export function organizeQuoteText(sourceText) {
  const lines = String(sourceText || "").split(/\r?\n/);
  const result = emptyOrganizedQuote();

  result.customer_name = fieldValue(lines, ["Customer", "Customer Name", "Company", "Client"]);
  result.contact_phone = fieldValue(lines, ["Phone", "Contact Phone"]);
  result.contact_email = fieldValue(lines, ["Email", "Contact Email"]);
  result.address = fieldValue(lines, ["Address", "Project Address", "Job-Site Address", "Job Site Address"]);
  result.quote_title = fieldValue(lines, ["Quote Title", "Project Name", "Project"]);

  const itemText = fieldValue(lines, ["Item", "Primary Item"]);
  const rateText = fieldValue(lines, ["Rate", "Price Per Foot", "Unit Rate"]);
  if (itemText || rateText) {
    result.items.push(inferPrimaryItem(itemText || "Quoted Work", rateText));
  }

  lines.forEach((source) => {
    const line = cleanLine(source);
    const separator = line.indexOf(":");
    if (separator < 0) return;
    const label = line.slice(0, separator).trim();
    if (!/(materials?|allowance|fee|charge|delivery|freight)/i.test(label)) return;
    if (/rate|total|tax/i.test(label)) return;
    const detail = line.slice(separator + 1).trim();
    const price = moneyValue(detail);
    if (!price) return;
    result.items.push({
      item_type: "Material",
      title: label,
      description: detail.replace(/\$\s*[\d,]+(?:\.\d{1,2})?/, "").replace(/^\s*[-–—:]?\s*/, ""),
      quantity: 1,
      unit: "Each",
      unit_price: price,
    });
  });

  const scope = sectionLines(lines, ["Project Scope", "Scope of Work"]);
  result.scope_of_work = scope.join("\n");

  const process = sectionLines(lines, ["Process", "Project Process", "Schedule"]);
  result.project_schedule = process.join("\n");

  const specifications = sectionLines(lines, ["Specifications"]);
  result.specifications = specifications.join("\n");

  const included = sectionLines(lines, ["Included Services"]);
  const rateIncluded = rateText.match(/\(([^)]+)\)/)?.[1] || "";
  result.included_services = included.join("\n") || rateIncluded;

  result.exclusions = sectionLines(lines, ["Exclusions"]).join("\n");
  result.down_payment_terms = fieldValue(lines, ["Down Payment", "Deposit", "Deposit Required"]);
  result.payment_terms = fieldValue(lines, ["Payment Terms"]);

  const totalLine = lines.map(cleanLine).find((line) => /^total\s*:/i.test(line));
  result.price_notes = totalLine || "";
  if (/tax[- ]?exempt|no\s+sales\s+tax/i.test(sourceText)) result.tax_rate = 0;

  if (!result.quote_title) {
    result.quote_title = result.items[0]?.title || "Imported Quote";
  }

  return result;
}

