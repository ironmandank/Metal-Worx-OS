import { Fragment, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowsShuffle,
  IconBell,
  IconBook2,
  IconBolt,
  IconBox,
  IconBriefcase,
  IconBuildingFactory2,
  IconCalendarEvent,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconColumns,
  IconFileSpreadsheet,
  IconFlame,
  IconHistory,
  IconFileVector,
  IconLayoutDashboard,
  IconLogout,
  IconMapPin,
  IconMenu2,
  IconMessage,
  IconPackage,
  IconPalette,
  IconPhone,
  IconPrinter,
  IconScan,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconShoppingCart,
  IconTemplate,
  IconTestPipe,
  IconTool,
  IconTruckDelivery,
  IconUserShield,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { supabase } from "../../lib/supabase";
import {
  getUnreadNotificationsForName,
  markAllNotificationsReadForName,
  markNotificationRead,
} from "../../services/notificationService";
import AnimatedWalkthrough from "../AnimatedWalkthrough";

const GLOBAL_STATUS_STYLES = `
  .mw-global-shop-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
    padding: 0 11px;
    border: 1px solid #31543a;
    border-radius: 9px;
    color: #baf19b;
    background: linear-gradient(180deg, rgba(20, 54, 29, 0.72), rgba(12, 31, 18, 0.78));
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.025em;
    white-space: nowrap;
  }

  .mw-global-shop-status i {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: #72dc38;
    box-shadow: 0 0 10px rgba(114, 220, 56, 0.9);
  }

  .mw-global-shop-status small {
    color: #72dc38;
    font-size: inherit;
    font-weight: inherit;
    text-transform: uppercase;
  }

  @media (max-width: 760px) {
    .mw-global-shop-status span {
      display: none;
    }

    .mw-global-shop-status {
      min-width: 38px;
      padding: 0;
      justify-content: center;
    }
  }
`;

const PRIMARY_NAV = [
  {
    page: "dashboard",
    label: "Command",
    fullLabel: "Operations Command Center",
    icon: IconLayoutDashboard,
  },
  {
    page: "actionCenter",
    label: "Actions",
    fullLabel: "Action Center",
    icon: IconAlertTriangle,
  },
  {
    page: "quickTurnaround",
    label: "Artwork",
    fullLabel: "Hot Artwork",
    icon: IconBolt,
  },
  {
    page: "hotToday",
    label: "Today",
    fullLabel: "Today's Priorities",
    icon: IconFlame,
  },
];

const NAV_GROUPS = [
  {
    id: "office",
    label: "Office",
    description: "Calendar, follow-ups, communication, and reporting",
    icon: IconBriefcase,
    items: [
      {
        page: "companyCalendar",
        label: "Company Events & Availability",
        section: "Daily Office Work",
        icon: IconCalendarEvent,
      },
      {
        page: "callbacks",
        label: "Notes & Follow-Ups",
        icon: IconPhone,
      },
      {
        page: "internalChat",
        label: "Internal Chat",
        icon: IconMessage,
      },
      {
        page: "reports",
        label: "Reports & Analytics",
        section: "Leadership",
        icon: IconChartBar,
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    description: "Customers, orders, and new work",
    icon: IconUsers,
    items: [
      {
        page: "orderBuilder",
        label: "New Order",
        writeRestricted: true,
        icon: IconShoppingCart,
      },
      {
        page: "customerOrders",
        label: "Customer Orders",
        icon: IconClipboardList,
      },
      {
        page: "customers",
        label: "Customers",
        icon: IconUsers,
      },
    ],
  },
  {
    id: "outside",
    label: "Outside",
    description: "Estimate → approve → prepare → complete field work",
    icon: IconTool,
    items: [
      {
        page: "projects",
        label: "Outside Command Center",
        description: "All outside jobs organized by current stage",
        step: "OVERVIEW",
        icon: IconLayoutDashboard,
      },
      {
        page: "quoteCenter",
        label: "Estimates & Approvals",
        description: "Site visits, quotes, customer approval, and signed records",
        step: "01",
        icon: IconFileSpreadsheet,
      },
      {
        page: "procurement",
        label: "Materials & Procurement",
        description: "Pricing, purchasing, receiving, and material readiness",
        step: "02",
        icon: IconPackage,
      },
      {
        page: "fieldSchedule",
        label: "Field Schedule & Installs",
        description: "Site visits, test fits, installation dates, and crews",
        step: "03",
        icon: IconCalendarEvent,
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock, receiving, requests, and inventory tools",
    icon: IconBox,
    items: [
      {
        page: "inventoryDashboard",
        label: "Inventory Overview",
        section: "Daily Inventory Work",
        icon: IconLayoutDashboard,
      },
      {
        page: "inventoryItems",
        label: "Inventory Items",
        icon: IconBox,
      },
      {
        page: "inventoryReceiving",
        label: "Receiving",
        writeRestricted: true,
        icon: IconTruckDelivery,
      },
      {
        page: "showSales",
        label: "Shows & Mobile Sales",
        writeRestricted: true,
        icon: IconShoppingCart,
      },
      {
        page: "materialRequestCart",
        label: "Request Materials",
        section: "Material Requests",
        writeRestricted: true,
        icon: IconShoppingCart,
      },
      {
        page: "materialRequestQueue",
        label: "Review Material Requests",
        icon: IconClipboardList,
      },
      {
        page: "inventoryStorage",
        label: "Storage Positions",
        section: "Inventory Tools",
        icon: IconMapPin,
      },
      {
        page: "inventoryScanner",
        label: "Scan QR Code",
        icon: IconScan,
      },
      {
        page: "inventoryCount",
        label: "Inventory Count Mode",
        writeRestricted: true,
        icon: IconShieldCheck,
      },
      {
        page: "inventoryLabels",
        label: "Print Inventory Labels",
        icon: IconPrinter,
      },
      {
        page: "inventoryHistory",
        label: "Inventory History",
        icon: IconHistory,
      },
      {
        page: "inventoryImport",
        label: "Excel Import Wizard",
        adminOnly: true,
        icon: IconFileSpreadsheet,
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Manage jobs, scheduling, and design work",
    icon: IconBuildingFactory2,
    items: [
      {
        page: "productionControl",
        label: "Production Control",
        section: "Production Management",
        icon: IconColumns,
      },
      {
        page: "productionJobs",
        label: "Production Jobs",
        icon: IconBuildingFactory2,
      },
    ],
  },
  {
    id: "stations",
    label: "Stations",
    description: "Open the live queue for each shop station",
    icon: IconColumns,
    items: [
      {
        page: "designQueue",
        label: "Design Intake & Queue",
        icon: IconPalette,
      },
      {
        page: "imageToDxf",
        label: "Image to Laser DXF",
        icon: IconFileVector,
      },
      {
        department: "Laser",
        label: "Laser Queue",
        icon: IconFlame,
      },
      {
        department: "Welding",
        label: "Welding Queue",
        icon: IconTool,
      },
      {
        department: "Prep",
        label: "Prep Queue",
        icon: IconTool,
      },
      {
        department: "Paint/Powder",
        label: "Paint / Powder",
        icon: IconPalette,
      },
      {
        department: "Assembly",
        label: "Assembly Queue",
        icon: IconPackage,
      },
      {
        department: "Final QC / Showroom",
        label: "Final QC / Showroom",
        icon: IconShieldCheck,
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    description: "Templates, employee access, training, and support",
    icon: IconSettings,
    items: [
      {
        page: "productTemplates",
        label: "Product Templates",
        section: "System Setup",
        writeRestricted: true,
        icon: IconTemplate,
      },
      {
        page: "workflowTemplates",
        label: "Workflow Templates",
        writeRestricted: true,
        icon: IconArrowsShuffle,
      },
      {
        page: "employeeLogins",
        label: "Employee Logins",
        adminOnly: true,
        icon: IconUserShield,
      },
      {
        page: "knowledgeCenter",
        label: "Help & Training",
        section: "Help & Support",
        icon: IconBook2,
      },
      {
        page: "pilotFeedback",
        label: "Report a Problem or Idea",
        icon: IconTestPipe,
      },
    ],
  },
];

// Option 3 Metal Worx OS application shell and navigation rail.
function AppLayout({
  children,
  page,
  currentPage,
  activeUser,
  authenticatedProfile,
  onSignOut,
  setPage,
  setSelectedDepartment,
  openCallback,
}) {
  const activePage = page || currentPage || "dashboard";
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeDepartment, setActiveDepartment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [openGroup, setOpenGroup] = useState("");

  const safeActiveUser =
    activeUser || authenticatedProfile?.display_name || "Employee";

  const isAdministrator = String(
    authenticatedProfile?.access_level || "",
  ).toLowerCase().includes("admin");
  const isReadOnly = String(
    authenticatedProfile?.access_level || "",
  ).toLowerCase().includes("read only");

  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (!item.adminOnly || isAdministrator) &&
            (!item.writeRestricted || !isReadOnly),
        ),
      })),
    [isAdministrator, isReadOnly],
  );

  const activeGroup = useMemo(
    () =>
      visibleNavGroups.find((group) =>
        group.items.some(
          (item) =>
            item.page === activePage ||
            (activePage === "departmentQueue" &&
              item.department === activeDepartment),
        ),
      )?.id || "",
    [activePage, activeDepartment, visibleNavGroups],
  );

  useEffect(() => {
    loadNotifications();

    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [activeUser]);

  useEffect(() => {
    if (!activeUser) return undefined;

    const channel = supabase
      .channel(`mw-notifications-${activeUser}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        loadNotifications,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUser]);

  useEffect(() => {
    function closeFlyout(event) {
      if (!event.target.closest(".mw-rail-navigation")) {
        setOpenGroup("");
      }
    }

    document.addEventListener("pointerdown", closeFlyout);
    return () => document.removeEventListener("pointerdown", closeFlyout);
  }, []);

  async function loadNotifications() {
    try {
      const result = await getUnreadNotificationsForName(activeUser);
      setNotifications(result.notifications || []);
    } catch (error) {
      console.error("Notifications load error:", error);
    }
  }

  async function openNotification(notification) {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
    } catch (error) {
      console.error("Notification read error:", error);
    }

    setShowNotifications(false);

    if (
      notification.source_type === "callback" &&
      notification.source_id &&
      openCallback
    ) {
      openCallback(notification.source_id);
      return;
    }

    if (notification.target_page) {
      navigate(notification.target_page);
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsReadForName(activeUser);
      setNotifications([]);
      setShowNotifications(false);
    } catch (error) {
      console.error("Mark all read error:", error);
    }
  }

  function navigate(pageName) {
    setActiveDepartment("");
    setOpenGroup("");
    setShowNotifications(false);
    if (window.matchMedia("(max-width: 650px)").matches) setExpanded(false);
    if (pageName === "callbacks") {
      setPage("dashboard");
      window.setTimeout(() => {
        document.getElementById("personal-followups")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return;
    }
    setPage(pageName);
  }

  function openDepartmentQueue(department) {
    setActiveDepartment(department);
    setSelectedDepartment(department);
    setOpenGroup("");
    setShowNotifications(false);
    if (window.matchMedia("(max-width: 650px)").matches) setExpanded(false);
    setPage("departmentQueue");
  }

  function isItemActive(item) {
    if (item.department) {
      return (
        activePage === "departmentQueue" && activeDepartment === item.department
      );
    }

    return activePage === item.page;
  }

  function selectGroup(groupId) {
    setOpenGroup((current) => (current === groupId ? "" : groupId));
  }

  const selectedGroup = visibleNavGroups.find((group) => group.id === openGroup);

  return (
    <div
      className={`mw-app-shell mw-icon-shell ${
        expanded ? "mw-rail-expanded" : "mw-rail-compact"
      }`}
    >
      <style>{GLOBAL_STATUS_STYLES}</style>

      {expanded && (
        <button
          type="button"
          className="mw-mobile-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => {
            setExpanded(false);
            setOpenGroup("");
          }}
        />
      )}

      <aside className="mw-sidebar mw-icon-rail">
        <div className="mw-rail-brand">
          <IconBuildingFactory2 className="mw-rail-system-mark" />

          {expanded && (
            <div className="mw-rail-brand-copy">
              <strong>METAL WORX OS</strong>
              <span>OPERATIONS SYSTEM</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="mw-rail-toggle"
          onClick={() => {
            setExpanded((current) => !current);
            setOpenGroup("");
          }}
          title={expanded ? "Collapse navigation" : "Expand navigation"}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        >
          {expanded ? <IconChevronLeft /> : <IconChevronRight />}
        </button>

        <nav className="mw-rail-navigation">
          <div className="mw-rail-primary">
            {PRIMARY_NAV.map((item) => {
              const ItemIcon = item.icon;
              const active = activePage === item.page;

              return (
                <button
                  key={item.page}
                  type="button"
                  className={`mw-rail-item ${active ? "mw-nav-active" : ""}`}
                  onClick={() => navigate(item.page)}
                  title={!expanded ? item.fullLabel : undefined}
                >
                  <ItemIcon />
                  <span>{expanded ? item.fullLabel : item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mw-rail-divider" />

          <div className="mw-rail-groups">
            {visibleNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = activeGroup === group.id || openGroup === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  className={`mw-rail-item mw-rail-group-button ${
                    active ? "mw-group-active" : ""
                  }`}
                  onClick={() => selectGroup(group.id)}
                  title={!expanded ? group.label : undefined}
                  aria-expanded={openGroup === group.id}
                >
                  <GroupIcon />
                  <span>{group.label}</span>
                  {expanded && (
                    <IconChevronRight className="mw-rail-group-arrow" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedGroup && (
            <div className="mw-rail-flyout">
              <div className="mw-flyout-header">
                <div>
                  <strong>{selectedGroup.label}</strong>
                  <span>{selectedGroup.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenGroup("")}
                  aria-label="Close navigation menu"
                >
                  <IconX />
                </button>
              </div>

              <div className="mw-flyout-items">
                {selectedGroup.items.map((item, index) => {
                  const ItemIcon = item.icon;
                  const active = isItemActive(item);
                  const showSection = item.section && selectedGroup.items[index - 1]?.section !== item.section;

                  return (
                    <Fragment key={item.page || item.department}>
                      {showSection && <div className="mw-flyout-section-label">{item.section}</div>}
                      <button
                        type="button"
                        title={item.description || item.label}
                        className={active ? "mw-nav-active" : ""}
                        onClick={() =>
                          item.department
                            ? openDepartmentQueue(item.department)
                            : navigate(item.page)
                        }
                      >
                        <ItemIcon />
                        <span className="mw-flyout-item-copy">
                          <strong>{item.label}</strong>
                        </span>
                        <IconChevronRight />
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="mw-rail-footer">
          <div className="mw-rail-user-avatar">
            {safeActiveUser.charAt(0).toUpperCase()}
          </div>

          {expanded && (
            <div className="mw-rail-user-copy">
              <strong>{safeActiveUser}</strong>
              <span>{authenticatedProfile?.access_level || "Employee"}</span>
            </div>
          )}

          <button
            type="button"
            className="mw-rail-signout"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      <main className="mw-main">
        <header className="mw-topbar mw-compact-topbar">
          <button
            type="button"
          className="mw-mobile-menu-button"
          data-tour="nav-menu"
            onClick={() => {
              setExpanded(true);
              setOpenGroup("");
            }}
            aria-label="Open navigation"
          >
            <IconMenu2 />
            <span>Menu</span>
          </button>
          <div className="mw-topbar-search" data-tour="global-search">
            <IconSearch />
            <input placeholder="Search orders, customers, jobs, projects, inventory..." />
          </div>

          <div className="mw-topbar-actions">
            {isReadOnly && <div className="mw-readonly-indicator">View Only</div>}
            <div
              className="mw-global-shop-status"
              data-tour="shop-status"
              title="Metal Worx shop systems are online"
              aria-label="Shop status live"
            >
              <i />
              <span>Shop Status:</span>
              <small>Live</small>
            </div>

            <div className="mw-notification-wrap" data-tour="notifications">
              <button
                type="button"
                className="mw-notification-button"
                onClick={() => setShowNotifications((current) => !current)}
                aria-label="Notifications"
              >
                <IconBell />

                {notifications.length > 0 && (
                  <span className="mw-notification-badge">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="mw-notification-menu">
                  <div className="mw-notification-menu-header">
                    <div>
                      <strong>Notifications</strong>
                      <small>{safeActiveUser}</small>
                    </div>

                    {notifications.length > 0 && (
                      <button type="button" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="mw-notification-empty">
                      No unread notifications.
                    </div>
                  ) : (
                    <div className="mw-notification-list">
                      {notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className="mw-notification-item"
                          onClick={() => openNotification(notification)}
                        >
                          <div className="mw-notification-item-top">
                            <strong>{notification.title}</strong>
                            <em>{notification.priority}</em>
                          </div>
                          <span>
                            {notification.message || "New notification"}
                          </span>
                          <small>
                            {new Date(notification.created_at).toLocaleString()}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <AnimatedWalkthrough currentPage={activePage} navigate={navigate} />

            <div className="mw-topbar-user">
              <div className="mw-topbar-avatar">
                {safeActiveUser.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{safeActiveUser}</strong>
                <span>{authenticatedProfile?.access_level || "Employee"}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="mw-content" data-tour="page-content">{children}</section>
      </main>
    </div>
  );
}

export default AppLayout;
