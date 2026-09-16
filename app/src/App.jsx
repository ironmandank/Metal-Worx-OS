import { Component, lazy, Suspense, useEffect, useState } from "react";

import AppLayout from "./components/layout/AppLayout";
import SplashScreen from "./components/SplashScreen";
import AuthLogin from "./pages/AuthLogin";
import {
  clearMetalWorxSession,
  getMetalWorxSessionStatus,
  isMetalWorxSessionValid,
  supabase,
} from "./lib/supabase";

const pageModules = import.meta.glob(["./pages/*.jsx", "!./pages/AuthLogin.jsx"]);
const page = (name) => lazy(pageModules[`./pages/${name}.jsx`]);
const Dashboard = page("Dashboard");
const MorningHuddleTV = page("MorningHuddleTV");
const ActionCenter = page("ActionCenter");
const Callbacks = page("Callbacks");
const InternalChat = page("InternalChat");
const Reports = page("Reports");
const Procurement = page("Procurement");
const InventoryDashboard = page("InventoryDashboard");
const InventoryItems = page("InventoryItems");
const NewInventoryItem = page("NewInventoryItem");
const InventoryScanner = page("InventoryScanner");
const InventoryItemDetails = page("InventoryItemDetails");
const InventoryQuantityAdjustment = page("InventoryQuantityAdjustment");
const InventoryReceiving = page("InventoryReceiving");
const InventoryStorageLocations = page("InventoryStorageLocations");
const InventoryLabelPrinting = page("InventoryLabelPrinting");
const InventoryHistory = page("InventoryHistory");
const InventoryCountMode = page("InventoryCountMode");
const InventoryImportWizard = page("InventoryImportWizard");
const ShowSales = page("ShowSales");
const QuickTurnaroundDashboard = page("QuickTurnaroundDashboard");
const NewJob = page("NewJob");
const JobQueue = page("JobQueue");
const ProductionBoard = page("ProductionBoard");
const ProductionControlCenter = page("ProductionControlCenter");
const ProductionJobs = page("ProductionJobs");
const ProductionJobDetails = page("ProductionJobDetails");
const DepartmentQueue = page("DepartmentQueue");
const JobDetails = page("JobDetails");
const ProductTemplates = page("ProductTemplates");
const NewProductTemplate = page("NewProductTemplate");
const WorkflowTemplates = page("WorkflowTemplates");
const Customers = page("Customers");
const CustomerOrders = page("CustomerOrders");
const OrderBuilder = page("OrderBuilder");
const CustomerDetails = page("CustomerDetails");
const CustomerOrderDetails = page("CustomerOrderDetails");
const DesignQueue = page("DesignQueue");
const Projects = page("Projects");
const NewProject = page("NewProject");
const ProjectDetails = page("ProjectDetails");
const EditProject = page("EditProject");
const FieldSchedule = page("FieldSchedule");
const QuoteBuilder = page("QuoteBuilder");
const QuotePreview = page("QuotePreview");
const QuoteCenter = page("QuoteCenter");
const PilotFeedback = page("PilotFeedback");
const KnowledgeCenter = page("KnowledgeCenter");
const EmployeeLoginManagement = page("EmployeeLoginManagement");
const CustomerQuoteApproval = page("CustomerQuoteApproval");

import "./App.css";

function PageLoading() {
  return (
    <div style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#b8c0c5", fontWeight: 800 }}>
      Loading Metal Worx workspace...
    </div>
  );
}

class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error("Metal Worx workspace failed to render", error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ margin: 24, padding: 28, border: "1px solid #8f2631", borderRadius: 14, background: "#171013", color: "#fff", textAlign: "center" }}>
        <h2 style={{ marginTop: 0 }}>This workspace could not be displayed.</h2>
        <p>Your information has not been cleared. Reload the page and try again.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: "#d20a20", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reload Metal Worx OS</button>
      </div>
    );
  }
}

function App() {
  const isCustomerApprovalPage =
    typeof window !== "undefined" && window.location.pathname === "/approve";
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState(null);
  const [authenticatedProfile, setAuthenticatedProfile] = useState(null);
  const [authError, setAuthError] = useState("");

  const [showSplash, setShowSplash] = useState(() => {
    return sessionStorage.getItem("mwSplashPlayed") !== "true";
  });

  const [page, setPage] = useState("dashboard");

  const [activeUser, setActiveUser] = useState("");

  const [actionCenterFilter, setActionCenterFilter] = useState("All");

  const [selectedJob, setSelectedJob] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [selectedCustomerOrder, setSelectedCustomerOrder] = useState(null);

  const [selectedProductionJob, setSelectedProductionJob] = useState(null);

  const [selectedDepartment, setSelectedDepartment] = useState("Design");

  const [selectedProject, setSelectedProject] = useState(null);

  const [selectedQuote, setSelectedQuote] = useState(null);

  const [selectedCallbackId, setSelectedCallbackId] = useState(null);

  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  const [selectedInventoryBin, setSelectedInventoryBin] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function applyAuthenticatedSession(nextSession, allowSignInGrace = false) {
      if (!mounted) return;

      if (!nextSession?.user) {
        setAuthSession(null);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError("");
        setAuthLoading(false);
        return;
      }

      if (allowSignInGrace && !isMetalWorxSessionValid()) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }

      const sessionStatus = getMetalWorxSessionStatus();
      if (!sessionStatus.valid) {
        clearMetalWorxSession();
        await supabase.auth.signOut({ scope: "local" });

        if (!mounted) return;
        setAuthSession(null);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          sessionStatus.mode === "expired"
            ? "Your 24-hour Metal Worx session expired. Sign in again."
            : "",
        );
        setAuthLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("employee_profiles")
        .select(
          "id,display_name,profile_type,role_title,department,is_active,auth_user_id,email,access_level",
        )
        .eq("auth_user_id", nextSession.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(profileError.message);
        setAuthLoading(false);
        return;
      }

      if (!profile) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          "This login is not linked to a Metal Worx employee profile.",
        );
        setAuthLoading(false);
        return;
      }

      if (!profile.is_active) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          "This Metal Worx employee login has been deactivated.",
        );
        setAuthLoading(false);
        return;
      }

      setAuthSession(nextSession);
      setAuthenticatedProfile({
        ...profile,
        access_level: "Employee",
      });
      setActiveUser(profile.display_name);
      setAuthError("");
      setAuthLoading(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      applyAuthenticatedSession(data?.session || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        applyAuthenticatedSession(nextSession, event === "SIGNED_IN");
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return undefined;

    async function enforceSessionExpiration() {
      if (isMetalWorxSessionValid()) return;

      clearMetalWorxSession();
      await supabase.auth.signOut({ scope: "local" });
      setAuthSession(null);
      setAuthenticatedProfile(null);
      setActiveUser("");
      setAuthError("Your Metal Worx session expired. Sign in again.");
      setPage("dashboard");
      sessionStorage.removeItem("mwSplashPlayed");
      setShowSplash(true);
    }

    const timer = window.setInterval(enforceSessionExpiration, 60000);

    function checkWhenVisible() {
      if (document.visibilityState === "visible") {
        enforceSessionExpiration();
      }
    }

    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [authSession]);

  async function handleSignOut() {
    clearMetalWorxSession();
    sessionStorage.removeItem("mwSplashPlayed");

    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      setAuthSession(null);
      setAuthenticatedProfile(null);
      setActiveUser("");
      setAuthError("");
      setPage("dashboard");
      setShowSplash(true);
    }
  }

  useEffect(() => {
    if (!showSplash || !authSession || !authenticatedProfile) {
      return;
    }

    const timer = window.setTimeout(() => {
      sessionStorage.setItem("mwSplashPlayed", "true");
      setShowSplash(false);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [showSplash, authSession, authenticatedProfile]);

  function openActionCenter(filter = "All") {
    setActionCenterFilter(filter);
    setPage("actionCenter");
  }

  function openCallback(callbackId = null) {
    setSelectedCallbackId(callbackId);
    setPage("callbacks");
  }

  function openProject(project) {
    setSelectedProject(project);
    setPage("projectDetails");
  }

  function openCustomerOrder(order) {
    setSelectedCustomerOrder(order);
    setPage("customerOrderDetails");
  }

  function openInventoryItem(item) {
    setSelectedInventoryItem(item);
    setPage("inventoryItemDetails");
  }

  function openInventoryBin(bin) {
    setSelectedInventoryBin(bin);
    setPage("inventoryStorage");
  }

  function renderPage() {
    if (page === "dashboard") {
      return (
        <Dashboard
          setPage={setPage}
          openActionCenter={openActionCenter}
          setSelectedProject={setSelectedProject}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          openProject={openProject}
          openCustomerOrder={openCustomerOrder}
          openCallback={openCallback}
        />
      );
    }

    if (page === "morningHuddleTV") {
      return <MorningHuddleTV setPage={setPage} />;
    }

    if (page === "actionCenter") {
      return (
        <ActionCenter
          setPage={setPage}
          selectedFilter={actionCenterFilter}
          setSelectedProject={setSelectedProject}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          openCallback={openCallback}
        />
      );
    }

    if (page === "callbacks") {
      return (
        <Callbacks
          setPage={setPage}
          selectedCallbackId={selectedCallbackId}
          setSelectedCallbackId={setSelectedCallbackId}
        />
      );
    }

    if (page === "internalChat") {
      return <InternalChat setPage={setPage} activeUser={activeUser} />;
    }

    if (page === "reports") {
      return <Reports setPage={setPage} />;
    }

    if (page === "procurement") {
      return (
        <Procurement
          setPage={setPage}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryDashboard") {
      return (
        <InventoryDashboard
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryItems") {
      return (
        <InventoryItems
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
        />
      );
    }

    if (page === "newInventoryItem") {
      return (
        <NewInventoryItem
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
        />
      );
    }

    if (page === "inventoryScanner") {
      return (
        <InventoryScanner
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryItemDetails") {
      return (
        <InventoryItemDetails
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryAdjustment") {
      return (
        <InventoryQuantityAdjustment
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryReceiving") {
      return (
        <InventoryReceiving
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryStorage") {
      return (
        <InventoryStorageLocations
          setPage={setPage}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryLabels") {
      return (
        <InventoryLabelPrinting
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryHistory") {
      return (
        <InventoryHistory
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
        />
      );
    }

    if (page === "inventoryCount") {
      return <InventoryCountMode setPage={setPage} activeUser={activeUser} />;
    }

    if (page === "inventoryImport") {
      return (
        <InventoryImportWizard setPage={setPage} activeUser={activeUser} />
      );
    }

    if (page === "showSales") {
      return <ShowSales setPage={setPage} activeUser={activeUser} />;
    }

    if (page === "quickTurnaround") {
      return (
        <QuickTurnaroundDashboard setPage={setPage} activeUser={activeUser} />
      );
    }

    if (page === "newJob") {
      return <NewJob setPage={setPage} />;
    }

    if (page === "jobQueue") {
      return <JobQueue setPage={setPage} />;
    }

    if (page === "jobDetails") {
      return <JobDetails selectedJob={selectedJob} setPage={setPage} />;
    }

    if (page === "projects") {
      return (
        <Projects setPage={setPage} setSelectedProject={setSelectedProject} />
      );
    }

    if (page === "newProject") {
      return <NewProject setPage={setPage} />;
    }

    if (page === "editProject") {
      return (
        <EditProject selectedProject={selectedProject} setPage={setPage} />
      );
    }

    if (page === "projectDetails") {
      return (
        <ProjectDetails
          selectedProject={selectedProject}
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "fieldSchedule") {
      return (
        <FieldSchedule
          setPage={setPage}
          setSelectedProject={setSelectedProject}
        />
      );
    }

    if (page === "quoteCenter") {
      return (
        <QuoteCenter
          setPage={setPage}
          setSelectedQuote={setSelectedQuote}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "quoteBuilder") {
      return (
        <QuoteBuilder
          selectedProject={selectedProject}
          selectedQuote={selectedQuote}
          setSelectedQuote={setSelectedQuote}
          setPage={setPage}
        />
      );
    }

    if (page === "quotePreview") {
      return (
        <QuotePreview
          selectedProject={selectedProject}
          selectedQuote={selectedQuote}
          setPage={setPage}
        />
      );
    }

    if (page === "productionBoard") {
      return (
        <ProductionBoard setPage={setPage} setSelectedJob={setSelectedJob} />
      );
    }

    if (page === "productionJobs") {
      return (
        <ProductionJobs
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
        />
      );
    }

    if (page === "productionControl") {
      return (
        <ProductionControlCenter
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "departmentQueue") {
      return (
        <DepartmentQueue
          department={selectedDepartment}
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "productionJobDetails") {
      return (
        <ProductionJobDetails
          selectedProductionJob={selectedProductionJob}
          setPage={setPage}
        />
      );
    }

    if (page === "productTemplates") {
      return <ProductTemplates setPage={setPage} />;
    }

    if (page === "newProductTemplate") {
      return <NewProductTemplate setPage={setPage} />;
    }

    if (page === "workflowTemplates") {
      return <WorkflowTemplates setPage={setPage} />;
    }

    if (page === "pilotFeedback") {
      return <PilotFeedback />;
    }

    if (page === "knowledgeCenter") {
      return <KnowledgeCenter setPage={setPage} />;
    }

    if (page === "employeeLogins") {
      return <EmployeeLoginManagement setPage={setPage} />;
    }

    if (page === "customers") {
      return (
        <Customers
          setPage={setPage}
          setSelectedCustomer={setSelectedCustomer}
        />
      );
    }

    if (page === "customerOrders") {
      return (
        <CustomerOrders
          setPage={setPage}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
        />
      );
    }

    if (page === "designQueue") {
      return (
        <DesignQueue
          setPage={setPage}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "customerOrderDetails") {
      return (
        <CustomerOrderDetails
          selectedCustomerOrder={selectedCustomerOrder}
          setPage={setPage}
        />
      );
    }

    if (page === "orderBuilder") {
      return (
        <OrderBuilder setPage={setPage} selectedCustomer={selectedCustomer} />
      );
    }

    if (page === "customerDetails") {
      return (
        <CustomerDetails
          selectedCustomer={selectedCustomer}
          setPage={setPage}
        />
      );
    }

    /*
     * Inventory pages still to connect:
     *
     * inventoryItemDetails
     * inventoryAdjustment
     * inventoryReceiving
     * inventoryStorage
     * inventoryScanner
     * inventoryLabels
     * inventoryVendors
     * inventoryHistory
     */

    return (
      <Dashboard
        setPage={setPage}
        openActionCenter={openActionCenter}
        setSelectedProject={setSelectedProject}
        setSelectedCustomerOrder={setSelectedCustomerOrder}
        openProject={openProject}
        openCustomerOrder={openCustomerOrder}
        openCallback={openCallback}
      />
    );
  }

  if (isCustomerApprovalPage) {
    return <Suspense fallback={<PageLoading />}><CustomerQuoteApproval /></Suspense>;
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          color: "#ffffff",
          background: "#030405",
          fontFamily: "Inter, Arial, sans-serif",
          fontWeight: 800,
        }}
      >
        Verifying Metal Worx employee access...
      </div>
    );
  }

  if (!authSession || !authenticatedProfile) {
    return (
      <AuthLogin
        session={authSession}
        errorMessage={authError}
        onSignOut={handleSignOut}
      />
    );
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  if (page === "morningHuddleTV") {
    return <WorkspaceErrorBoundary><Suspense fallback={<PageLoading />}><MorningHuddleTV setPage={setPage} /></Suspense></WorkspaceErrorBoundary>;
  }

  return (
    <AppLayout
      page={page}
      activeUser={activeUser}
      setActiveUser={setActiveUser}
      authenticatedProfile={authenticatedProfile}
      onSignOut={handleSignOut}
      setPage={setPage}
      setSelectedDepartment={setSelectedDepartment}
      openCallback={openCallback}
      selectedInventoryItem={selectedInventoryItem}
      selectedInventoryBin={selectedInventoryBin}
      openInventoryItem={openInventoryItem}
      openInventoryBin={openInventoryBin}
    >
      <WorkspaceErrorBoundary><Suspense fallback={<PageLoading />}>{renderPage()}</Suspense></WorkspaceErrorBoundary>
    </AppLayout>
  );
}

export default App;
