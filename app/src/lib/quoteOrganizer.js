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

function allMoneyValues(value) {
  return [...String(value || "").matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
    .map((match) => Number(match[1].replace(/,/g, "")));
}

function parseHourlyItem(lines) {
  const hourlyLine = lines.map(cleanLine).find((line) => /^hourly\s+(?:rate|labor)\s*:/i.test(line));
  if (!hourlyLine) return null;

  const detail = hourlyLine.slice(hourlyLine.indexOf(":") + 1).trim();
  const moneyValues = allMoneyValues(detail);
  const unitMatch = detail.match(/\$\s*([\d,]+(?:\.\d{1,2})?)\s*\/\s*(?:hr|hour)/i);
  const unitPrice = unitMatch ? Number(unitMatch[1].replace(/,/g, "")) : 0;
  const hours = [...detail.matchAll(/([\d.]+)\s*(?:hrs?|hours?)\b/gi)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const quantity = hours.reduce((sum, value) => sum + value, 0);
  const statedTotal = moneyValues.find((value) => !unitPrice || value !== unitPrice) || 0;

  return {
    item_type: "Service",
    title: "Labor — Fabrication & Installation",
    description: detail.replace(/^\$\s*[\d,]+(?:\.\d{1,2})?\s*/, "").trim(),
    quantity: quantity || 1,
    unit: quantity ? "Hour" : "Each",
    unit_price: unitPrice || statedTotal,
  };
}

function parseValidityDate(sourceText) {
  const duration = String(sourceText || "").match(/valid\s+for\s+(?:[a-z]+\s*)?\((\d+)\)|valid\s+for\s+(\d+)\s+(?:working|business)\s+days?/i);
  const start = String(sourceText || "").match(/beginning\s+(?:[a-z]+\s+)?(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?/i);
  if (!duration || !start) return "";

  const workingDays = Number(duration[1] || duration[2]);
  const year = Number(start[3] || new Date().getFullYear());
  const date = new Date(`${start[2]} ${start[1]}, ${year} 12:00:00`);
  if (!Number.isFinite(workingDays) || Number.isNaN(date.getTime())) return "";

  let remaining = Math.max(workingDays - 1, 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
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
    "next steps & process",
    "next steps and process",
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
    valid_until: "",
    tax_rate: 0.07,
    tax_treatment: "included",
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

  const hourlyItem = parseHourlyItem(lines);
  if (hourlyItem) result.items.push(hourlyItem);

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
  const summaryScope = fieldValue(lines, ["Scope of Work"]);
  result.scope_of_work = [summaryScope, ...scope]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join("\n");

  const process = sectionLines(lines, ["Process", "Project Process", "Next Steps & Process", "Next Steps and Process", "Schedule"]);
  result.project_schedule = process.join("\n");

  const specifications = sectionLines(lines, ["Specifications"]);
  result.specifications = specifications.join("\n");

  const included = sectionLines(lines, ["Included Services"]);
  const rateIncluded = rateText.match(/\(([^)]+)\)/)?.[1] || "";
  result.included_services = included.join("\n") || rateIncluded;

  result.exclusions = sectionLines(lines, ["Exclusions"]).join("\n");
  result.down_payment_terms = fieldValue(lines, ["Down Payment", "Deposit", "Deposit Required"]);
  result.payment_terms = fieldValue(lines, ["Payment Terms"]);

  const totalLine = lines.map(cleanLine).find((line) => /^(?:estimated\s+)?total\s*:/i.test(line));
  result.price_notes = totalLine || "";
  result.valid_until = parseValidityDate(sourceText);
  if (/tax[- ]?exempt|no\s+sales\s+tax/i.test(sourceText)) {
    result.tax_rate = 0;
    result.tax_treatment = "exempt";
  } else if (/excluding\s+(?:applicable\s+)?tax(?:es)?(?:\s+and\s+fees)?|plus\s+(?:applicable\s+)?tax(?:es)?(?:\s+and\s+fees)?/i.test(sourceText)) {
    result.tax_treatment = "plus";
  }

  if (!result.quote_title && result.items[0]?.title !== "Labor — Fabrication & Installation") {
    result.quote_title = result.items[0]?.title || "Imported Quote";
  }

  return result;
}
