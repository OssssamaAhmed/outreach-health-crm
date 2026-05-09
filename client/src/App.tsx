import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import NewPatient from "./pages/NewPatient";
import Inventory from "./pages/Inventory";
import Medicines from "./pages/Medicines";
import MedicalCamps from "./pages/MedicalCamps";
import NewCamp from "./pages/NewCamp";
import CampDetail from "./pages/CampDetail";
import Users from "./pages/Users";
import StaffActivity from "./pages/StaffActivity";
import ImportOffline from "./pages/ImportOffline";
import LoggedOut from "./pages/LoggedOut";
import AccessDenied from "./pages/AccessDenied";
import MyRequests from "./pages/MyRequests";
import PendingApprovals from "./pages/PendingApprovals";
import Notifications from "./pages/Notifications";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/patients" component={Patients} />
      <Route path="/patients/new" component={NewPatient} />
      <Route path="/patients/:id" component={PatientDetail} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/medicines" component={Medicines} />
      <Route path="/camps" component={MedicalCamps} />
      <Route path="/camps/new" component={NewCamp} />
      <Route path="/camps/:id" component={CampDetail} />
      <Route path="/users" component={Users} />
      <Route path="/staff-activity" component={StaffActivity} />
      <Route path="/import-offline" component={ImportOffline} />
      <Route path="/logged-out" component={LoggedOut} />
      <Route path="/access-denied" component={AccessDenied} />
      <Route path="/my-requests" component={MyRequests} />
      <Route path="/pending-approvals" component={PendingApprovals} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
