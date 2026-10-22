import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="card max-w-md p-10 text-center">
        <h1 className="text-gradient text-3xl font-bold">Page introuvable</h1>
        <p className="mt-4 text-secondary">
          Cette page n&apos;existe pas. Vos données restent en sécurité, chiffrées sur votre
          appareil.
        </p>
        <Link
          href="/"
          className="transition-velora mt-6 inline-block rounded-xl bg-card-elevated px-5 py-2.5 text-sm font-medium text-primary shadow-glow hover:brightness-110"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
