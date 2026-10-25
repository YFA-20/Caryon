"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Contenu optionnel à afficher en cas d'erreur (remplace le fallback par défaut) */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Velora — Error Boundary global.
 *
 * Capture les erreurs de rendu React (crash, exception dans un composant)
 * et affiche un écran de récupération au lieu d'un écran blanc/ noir.
 *
 * Cas d'usage principal : F5 sur une page profonde (/candidatures, /calendrier)
 * quand le coffre est verrouillé — le HTML statique est déjà chargé mais
 * l'hydratation React peut crasher si un composant tente d'accéder à des
 * données chiffrées avant que VaultGate ne soit prêt.
 *
 * L'utilisateur peut :
 * - Retourner à l'accueil (où VaultGate affichera le formulaire de déverrouillage)
 * - Recharger la page
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log pour le débogage (visible dans la console DevTools)
    console.error("[ErrorBoundary] Erreur capturée:", error);
    console.error("[ErrorBoundary] Stack composant:", info.componentStack);
  }

  handleGoHome = (): void => {
    // Redirection dure vers la racine — VaultGate y affichera le portail
    // de déverrouillage si le coffre est verrouillé.
    window.location.replace("/");
  };

  handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-danger/10">
                <AlertTriangle className="h-7 w-7 text-danger" aria-hidden="true" />
              </div>
              <CardTitle className="mt-4 font-serif text-2xl">Une erreur est survenue</CardTitle>
              <CardDescription className="mt-2">
                L&apos;application a rencontré un problème inattendu. Vos données chiffrées sont en
                sécurité — aucune donnée n&apos;a été perdue.
              </CardDescription>
            </div>

            {this.state.error && (
              <p className="mb-4 rounded-xl bg-surface px-4 py-2.5 text-xs text-secondary">
                <span className="font-medium text-danger">Détail :</span> {this.state.error.message}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleGoHome} className="w-full">
                <Home className="h-4 w-4" aria-hidden="true" />
                Retour à l&apos;accueil
              </Button>
              <Button variant="outline" onClick={this.handleReload} className="w-full">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Recharger la page
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-secondary">
              Si le problème persiste, verrouillez et déverrouillez votre coffre depuis
              l&apos;accueil.
            </p>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
