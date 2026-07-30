const ALL_ACCESS = "*";

const ROLE_PAGES = {
  Administrator: [ALL_ACCESS],
  Management: [ALL_ACCESS],

  Office: [
    "dashboard",
    "actionCenter",
    "callbacks",
    "internalChat",
    "reports",
    "quickTurnaround",
    "hotToday",
    "orderBuilder",
    "customerOrders",
    "customerOrderDetails",
    "customers",
    "customerDetails",
    "projects",
    "newProject",
    "editProject",
    "projectDetails",
    "fieldSchedule",
    "quoteBuilder",
    "quotePreview",
    "procurement",
    "designQueue",
    "productionJobs",
    "productionJobDetails",
    "inventoryDashboard",
    "inventoryItems",
    "inventoryItemDetails",
    "inventoryHistory",
    "materialRequestCart",
    "materialRequestQueue",
    "shopTV",
  ],

  Design: [
    "dashboard",
    "actionCenter",
    "internalChat",
    "quickTurnaround",
    "customerOrders",
    "customerOrderDetails",
    "customers",
    "customerDetails",
    "designQueue",
    "productionJobs",
    "productionJobDetails",
    "productionControl",
    "departmentQueue",
    "productTemplates",
    "newProductTemplate",
    "workflowTemplates",
    "inventoryDashboard",
    "inventoryItems",
    "inventoryItemDetails",
    "inventoryScanner",
    "materialRequestCart",
    "shopTV",
  ],

  Shop: [
    "dashboard",
    "actionCenter",
    "internalChat",
    "quickTurnaround",
    "productionJobs",
    "productionJobDetails",
    "productionControl",
    "departmentQueue",
    "inventoryDashboard",
    "inventoryItems",
    "inventoryItemDetails",
    "inventoryScanner",
    "inventoryAdjustment",
    "inventoryReceiving",
    "inventoryStorage",
    "inventoryCount",
    "inventoryHistory",
    "materialRequestCart",
    "shopTV",
  ],

  "Read Only": [
    "dashboard",
    "actionCenter",
    "reports",
    "quickTurnaround",
    "productionJobs",
    "productionJobDetails",
    "inventoryDashboard",
    "inventoryItems",
    "inventoryItemDetails",
    "inventoryHistory",
    "shopTV",
  ],
};

export function canAccessPage(accessLevel, pageName) {
  const allowedPages = ROLE_PAGES[accessLevel] || ROLE_PAGES["Read Only"];
  return allowedPages.includes(ALL_ACCESS) || allowedPages.includes(pageName);
}

export function getAllowedPages(accessLevel) {
  return ROLE_PAGES[accessLevel] || ROLE_PAGES["Read Only"];
}

export function isAdministrativeAccess(accessLevel) {
  return accessLevel === "Administrator" || accessLevel === "Management";
}

export { ROLE_PAGES };
