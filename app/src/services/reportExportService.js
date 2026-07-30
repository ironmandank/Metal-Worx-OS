import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import pptxgen from "pptxgenjs";

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currentDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function safeItems(items = []) {
  return Array.isArray(items) ? items : [];
}

/* =====================================================
   PDF EXPORT
===================================================== */

export function exportReportsToPDF(data) {
  if (!data) {
    throw new Error("No report data available to export.");
  }

  const summary = data.summary || {};

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  function addHeader() {
    doc.setFillColor(18, 24, 30);
    doc.rect(0, 0, pageWidth, 92, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("METAL WORX", 40, 38);

    doc.setTextColor(220, 40, 40);
    doc.setFontSize(15);
    doc.text("Reports & Analytics", 40, 62);

    doc.setTextColor(190, 195, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated ${currentDate()}`, 40, 78);
  }

  function addFooter() {
    const pageCount = doc.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);

      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setDrawColor(210, 210, 210);
      doc.line(40, pageHeight - 34, pageWidth - 40, pageHeight - 34);

      doc.setTextColor(120, 120, 120);
      doc.setFontSize(8);
      doc.text("Metal Worx Operations System", 40, pageHeight - 20);
      doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 90, pageHeight - 20);
    }
  }

  addHeader();

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Executive Operations Summary", 40, 125);

  autoTable(doc, {
    startY: 140,
    head: [["Metric", "Current Value"]],
    body: [
      ["Open Customer Orders", summary.openOrders || 0],
      ["Active Outside Projects", summary.openProjects || 0],
      ["Active Production Jobs", summary.activeProductionJobs || 0],
      ["Open Callbacks", summary.openCallbacks || 0],
      ["Overdue Work", summary.overdueWork || 0],
      ["Total Pipeline Value", money(summary.totalPipelineValue)],
      ["Total Outstanding Balance", money(summary.totalOutstandingBalance)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [139, 0, 0],
      textColor: [255, 255, 255],
    },
    styles: {
      fontSize: 10,
      cellPadding: 7,
    },
    columnStyles: {
      0: {
        cellWidth: 300,
      },
    },
  });

  let nextY = doc.lastAutoTable.finalY + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Financial Snapshot", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Financial Metric", "Amount"]],
    body: [
      ["Open Customer Order Value", money(summary.orderPipelineValue)],
      ["Open Outside Project Value", money(summary.projectPipelineValue)],
      ["Customer Order Balance", money(summary.openOrderBalance)],
      ["Outside Project Balance", money(summary.openProjectBalance)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
    },
    styles: {
      fontSize: 10,
      cellPadding: 7,
    },
  });

  doc.addPage();
  addHeader();

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Operational Workload", 40, 125);

  autoTable(doc, {
    startY: 140,
    head: [["Department", "Active Work"]],
    body: safeItems(data.departmentWorkload).map((item) => [item.label, item.value]),
    theme: "striped",
    headStyles: {
      fillColor: [139, 0, 0],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Order Owner Workload", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Owner", "Open Orders"]],
    body: safeItems(data.orderOwnerBreakdown).map((item) => [item.label, item.value]),
    theme: "striped",
    headStyles: {
      fillColor: [45, 45, 45],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Project Owner Workload", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Owner", "Active Projects"]],
    body: safeItems(data.projectOwnerBreakdown).map((item) => [item.label, item.value]),
    theme: "striped",
    headStyles: {
      fillColor: [45, 45, 45],
    },
  });

  doc.addPage();
  addHeader();

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Status Breakdown", 40, 125);

  autoTable(doc, {
    startY: 140,
    head: [["Customer Order Status", "Count"]],
    body: safeItems(data.orderStatusBreakdown).map((item) => [item.label, item.value]),
    theme: "grid",
    headStyles: {
      fillColor: [139, 0, 0],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Outside Project Status", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Project Status", "Count"]],
    body: safeItems(data.projectStatusBreakdown).map((item) => [item.label, item.value]),
    theme: "grid",
    headStyles: {
      fillColor: [45, 45, 45],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Production Status", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Production Status", "Count"]],
    body: safeItems(data.productionStatusBreakdown).map((item) => [item.label, item.value]),
    theme: "grid",
    headStyles: {
      fillColor: [45, 45, 45],
    },
  });

  doc.addPage();
  addHeader();

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Customer & Follow-Up Activity", 40, 125);

  autoTable(doc, {
    startY: 140,
    head: [["Top Customer", "Order Count"]],
    body: safeItems(data.topCustomers).map((item) => [item.label, item.value]),
    theme: "striped",
    headStyles: {
      fillColor: [139, 0, 0],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Callback Owner Workload", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Owner", "Open Callbacks"]],
    body: safeItems(data.callbackOwnerBreakdown).map((item) => [item.label, item.value]),
    theme: "striped",
    headStyles: {
      fillColor: [45, 45, 45],
    },
  });

  nextY = doc.lastAutoTable.finalY + 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Attention Summary", 40, nextY);

  autoTable(doc, {
    startY: nextY + 12,
    head: [["Attention Item", "Count"]],
    body: safeItems(data.attentionItems).map((item) => [item.label, item.value]),
    theme: "grid",
    headStyles: {
      fillColor: [139, 0, 0],
    },
  });

  addFooter();

  doc.save(
    `Metal-Worx-Operations-Report-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

/* =====================================================
   POWERPOINT HELPERS
===================================================== */

function addPptHeader(slide, title, subtitle = "") {
  slide.background = {
    color: "10161C",
  };

  slide.addShape(pptxgen.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.18,
    fill: {
      color: "C71920",
    },
    line: {
      color: "C71920",
    },
  });

  slide.addText("METAL WORX", {
    x: 0.55,
    y: 0.35,
    w: 3.2,
    h: 0.4,
    fontFace: "Arial",
    fontSize: 18,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  slide.addText(title, {
    x: 0.55,
    y: 0.95,
    w: 8.8,
    h: 0.6,
    fontFace: "Arial",
    fontSize: 28,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.55,
      y: 1.55,
      w: 10.8,
      h: 0.35,
      fontFace: "Arial",
      fontSize: 11,
      color: "AEB8C2",
      margin: 0,
    });
  }
}

function addMetricCard(slide, { x, y, w, h, label, value, subtext }) {
  slide.addShape(pptxgen.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: {
      color: "151D24",
    },
    line: {
      color: "34414D",
      width: 1,
    },
  });

  slide.addText(label.toUpperCase(), {
    x: x + 0.2,
    y: y + 0.18,
    w: w - 0.4,
    h: 0.25,
    fontFace: "Arial",
    fontSize: 9,
    bold: true,
    color: "AEB8C2",
    margin: 0,
  });

  slide.addText(String(value), {
    x: x + 0.2,
    y: y + 0.5,
    w: w - 0.4,
    h: 0.5,
    fontFace: "Arial",
    fontSize: 24,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  slide.addText(subtext, {
    x: x + 0.2,
    y: y + 1.08,
    w: w - 0.4,
    h: 0.42,
    fontFace: "Arial",
    fontSize: 9,
    color: "AEB8C2",
    margin: 0,
  });
}

function addBarChart(slide, title, items, x, y, w, h) {
  const safeData = safeItems(items);

  slide.addShape(pptxgen.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: {
      color: "252525",
    },
    line: {
      color: "3B3B3B",
      width: 1,
    },
  });

  slide.addText(title, {
    x: x + 0.25,
    y: y + 0.2,
    w: w - 0.5,
    h: 0.35,
    fontFace: "Arial",
    fontSize: 16,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  if (safeData.length === 0) {
    slide.addText("No data available", {
      x: x + 0.25,
      y: y + 0.8,
      w: w - 0.5,
      h: 0.4,
      fontFace: "Arial",
      fontSize: 11,
      color: "AEB8C2",
      margin: 0,
    });

    return;
  }

  const maxValue = Math.max(...safeData.map((item) => Number(item.value || 0)), 1);
  const visibleItems = safeData.slice(0, 6);
  const rowHeight = Math.min(0.62, (h - 0.8) / visibleItems.length);

  visibleItems.forEach((item, index) => {
    const rowY = y + 0.72 + index * rowHeight;
    const percent = Number(item.value || 0) / maxValue;

    slide.addText(item.label, {
      x: x + 0.25,
      y: rowY,
      w: w * 0.46,
      h: 0.2,
      fontFace: "Arial",
      fontSize: 9,
      bold: true,
      color: "FFFFFF",
      margin: 0,
    });

    slide.addText(String(item.value), {
      x: x + w - 0.65,
      y: rowY,
      w: 0.4,
      h: 0.2,
      fontFace: "Arial",
      fontSize: 9,
      color: "AEB8C2",
      align: "right",
      margin: 0,
    });

    slide.addShape(pptxgen.ShapeType.rect, {
      x: x + 0.25,
      y: rowY + 0.25,
      w: w - 0.5,
      h: 0.08,
      fill: {
        color: "11171D",
      },
      line: {
        color: "11171D",
      },
    });

    slide.addShape(pptxgen.ShapeType.rect, {
      x: x + 0.25,
      y: rowY + 0.25,
      w: Math.max((w - 0.5) * percent, 0.08),
      h: 0.08,
      fill: {
        color: "E11D2E",
      },
      line: {
        color: "E11D2E",
      },
    });
  });
}

/* =====================================================
   POWERPOINT EXPORT
===================================================== */

export async function exportReportsToPowerPoint(data) {
  if (!data) {
    throw new Error("No report data available to export.");
  }

  const summary = data.summary || {};

  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Metal Worx";
  pptx.company = "Metal Worx";
  pptx.subject = "Operations Report";
  pptx.title = "Metal Worx Reports & Analytics";
  pptx.lang = "en-US";

  let slide = pptx.addSlide();

  addPptHeader(
    slide,
    "Reports & Analytics",
    `Operational briefing generated ${currentDate()}`
  );

  const cards = [
    {
      label: "Open Orders",
      value: summary.openOrders || 0,
      subtext: "Active customer orders",
    },
    {
      label: "Outside Projects",
      value: summary.openProjects || 0,
      subtext: "Active outside fabrication",
    },
    {
      label: "Production Jobs",
      value: summary.activeProductionJobs || 0,
      subtext: "Active shop jobs",
    },
    {
      label: "Open Callbacks",
      value: summary.openCallbacks || 0,
      subtext: "Open customer follow-ups",
    },
    {
      label: "Overdue Work",
      value: summary.overdueWork || 0,
      subtext: "Past-due operational work",
    },
    {
      label: "Pipeline Value",
      value: money(summary.totalPipelineValue),
      subtext: "Open order + project value",
    },
    {
      label: "Outstanding Balance",
      value: money(summary.totalOutstandingBalance),
      subtext: "Estimated unpaid balance",
    },
    {
      label: "Report Health",
      value: "LIVE",
      subtext: "Current ERP data",
    },
  ];

  cards.forEach((card, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);

    addMetricCard(slide, {
      x: 0.55 + column * 3.15,
      y: 2.15 + row * 2.05,
      w: 2.85,
      h: 1.7,
      ...card,
    });
  });

  slide = pptx.addSlide();

  addPptHeader(
    slide,
    "Operational Status",
    "Current customer orders, outside projects, production, and department workload"
  );

  addBarChart(slide, "Customer Order Status", data.orderStatusBreakdown, 0.55, 2.05, 5.9, 2.25);
  addBarChart(slide, "Outside Project Status", data.projectStatusBreakdown, 6.85, 2.05, 5.9, 2.25);
  addBarChart(slide, "Production Status", data.productionStatusBreakdown, 0.55, 4.65, 5.9, 2.25);
  addBarChart(slide, "Department Workload", data.departmentWorkload, 6.85, 4.65, 5.9, 2.25);

  slide = pptx.addSlide();

  addPptHeader(
    slide,
    "Ownership & Workload",
    "Current assignment distribution across orders, projects, and callbacks"
  );

  addBarChart(slide, "Order Owner Workload", data.orderOwnerBreakdown, 0.55, 2.05, 3.9, 4.65);
  addBarChart(slide, "Project Owner Workload", data.projectOwnerBreakdown, 4.72, 2.05, 3.9, 4.65);
  addBarChart(slide, "Callback Owner Workload", data.callbackOwnerBreakdown, 8.9, 2.05, 3.9, 4.65);

  slide = pptx.addSlide();

  addPptHeader(
    slide,
    "Customers & Attention",
    "Customer activity and operational items requiring attention"
  );

  addBarChart(slide, "Top Customers by Orders", data.topCustomers, 0.55, 2.05, 5.9, 4.75);
  addBarChart(slide, "Attention Summary", data.attentionItems, 6.85, 2.05, 5.9, 4.75);

  slide = pptx.addSlide();

  addPptHeader(
    slide,
    "Financial Snapshot",
    "Open pipeline and outstanding balance overview"
  );

  addMetricCard(slide, {
    x: 0.75,
    y: 2.15,
    w: 5.7,
    h: 1.7,
    label: "Open Customer Order Value",
    value: money(summary.orderPipelineValue),
    subtext: "Value of currently open customer orders",
  });

  addMetricCard(slide, {
    x: 6.85,
    y: 2.15,
    w: 5.7,
    h: 1.7,
    label: "Open Outside Project Value",
    value: money(summary.projectPipelineValue),
    subtext: "Value of active outside fabrication projects",
  });

  addMetricCard(slide, {
    x: 0.75,
    y: 4.35,
    w: 5.7,
    h: 1.7,
    label: "Customer Order Balance",
    value: money(summary.openOrderBalance),
    subtext: "Estimated unpaid balance on customer orders",
  });

  addMetricCard(slide, {
    x: 6.85,
    y: 4.35,
    w: 5.7,
    h: 1.7,
    label: "Outside Project Balance",
    value: money(summary.openProjectBalance),
    subtext: "Estimated unpaid balance on outside projects",
  });

  await pptx.writeFile({
    fileName: `Metal-Worx-Operations-Report-${new Date()
      .toISOString()
      .slice(0, 10)}.pptx`,
  });
}