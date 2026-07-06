import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ChatRoom from "./pages/ChatRoom";
import Profile from "./pages/Profile";
import Store from "./pages/Store";
import Admin from "@/pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/chat"} component={ChatRoom} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/store"} component={Store} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // ── Keep-alive: ping server every 10 min so Render.com never sleeps ──────
  useEffect(() => {
    const ping = () =>
      fetch("/ping").catch(() => {/* ignore */});
    ping(); // immediate ping on load
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

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
