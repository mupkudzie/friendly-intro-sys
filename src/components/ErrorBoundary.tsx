import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, RotateCcw, LogOut } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application dashboard:", error, errorInfo);
  }

  private handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    // Redirect to auth after clear
    window.location.href = "/auth";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white selection:bg-rose-500/20 selection:text-rose-400">
          <div className="absolute inset-0 bg-rose-500/5 blur-[120px] pointer-events-none rounded-full max-w-2xl mx-auto my-auto h-[60%]" />
          
          <Card className="max-w-md w-full border border-slate-800 bg-slate-900/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl relative z-10">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500 shadow-lg shadow-rose-500/5">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-white font-heading">
                Dashboard Restored Safely
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                We encountered an unexpected rendering error. To protect your session, the system has suspended drawing the active console.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-rose-950/20 border border-rose-900/35 rounded-xl text-left text-xs font-mono text-rose-400 max-h-40 overflow-y-auto leading-relaxed select-text">
                  {this.state.error.name}: {this.state.error.message}
                </div>
              )}
              
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={this.handleReload}
                  className="w-full h-11 rounded-xl text-sm font-bold bg-white text-slate-950 hover:bg-slate-200 active-shrink shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reload Console
                </Button>
                <Button
                  variant="ghost"
                  onClick={this.handleSignOut}
                  className="w-full h-11 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/40 active-shrink flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Clear Cache & Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
