"use client";

import { useColorScheme } from "@mui/material/styles";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logoDark from "../../../../assets/balsave-logo-dark.svg";
import logoLight from "../../../../assets/balsave-logo-light.svg";
import { SignOutForm } from "./sign-out-form";

const sections = [
  { href: "/", label: "Visão geral", mobile: "Início", routes: ["/"], icon: "home" },
  { href: "/lancamentos", label: "Extrato", mobile: "Extrato", routes: ["/lancamentos", "/a-receber"], icon: "statement" },
  { href: "/gastos", label: "Gastos", mobile: "Gastos", routes: ["/gastos"], icon: "spending" },
  { href: "/classificacoes", label: "Classificações", mobile: "Classificações", routes: ["/classificacoes", "/categorias", "/etiquetas"], icon: "classifications" },
  { href: "/contas", label: "Contas", mobile: "Contas", routes: ["/contas", "/cartoes", "/conexoes"], icon: "accounts" },
  { href: "/simulador", label: "Simulador", mobile: "Simular", routes: ["/simulador"], icon: "calculator" },
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5V21H3z" /><path d="M9 21v-7h6v7" /></>,
    statement: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
    spending: <><path d="M12 3v9h9A9 9 0 1 1 12 3Z" /><path d="M15 3.55A8 8 0 0 1 20.45 9H15z" /></>,
    classifications: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
    accounts: <path d="m3 9 9-5 9 5v2H3zm0 11h18M6 11v6m4-6v6m4-6v6m4-6v6" />,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8m-8 5h1m6 0h1m-8 4h1m6 0h1" /></>,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20v-1.7a6.5 5 0 0 1 13 0V20" /></>,
    moon: <path d="M20.8 14A8.9 8.9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  };
  return <svg className="balsave-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Header({ signedIn, showNavigation, showHomeSignIn }: {
  signedIn: boolean;
  showNavigation: boolean;
  showHomeSignIn: boolean;
}) {
  const pathname = usePathname();
  const { mode, systemMode, setMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";
  const links = (mobile: boolean) => sections.map((section) => {
    const active = section.routes.some((route) => route === "/" ? pathname === route : pathname === route || pathname.startsWith(`${route}/`));
    return <Link href={section.href} key={section.href} aria-current={active ? "page" : undefined}>
      <span className="balsave-nav-icon-wrap"><Icon name={section.icon} /></span>
      <span>{mobile ? section.mobile : section.label}</span>
    </Link>;
  });
  return <>
    <header className="balsave-header">
      <div className="balsave-shell balsave-header-inner">
        <Link href="/" className="balsave-brand" aria-label="Balsave, visão geral">
          <Image className="balsave-logo-light" src={logoLight} alt="" width={186} height={48} loading="eager" />
          <Image className="balsave-logo-dark" src={logoDark} alt="" width={186} height={48} loading="eager" />
        </Link>
        {showNavigation && <nav className="balsave-desktop-nav" aria-label="Navegação principal">{links(false)}</nav>}
        <div className="balsave-header-tools">
          <button className="balsave-theme-toggle" type="button" aria-label="Tema escuro" aria-pressed={dark}
            onClick={() => setMode(dark ? "light" : "dark")}>
            <span className="balsave-theme-moon"><Icon name="moon" /></span>
            <span className="balsave-theme-sun"><Icon name="sun" /></span>
          </button>
          {(signedIn || (showHomeSignIn && pathname !== "/acesso")) && <details className="balsave-profile" key={pathname}
            onBlur={event => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}
            onKeyDown={event => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.currentTarget.querySelector("summary")?.focus();
                event.currentTarget.open = false;
              }
            }}>
            <summary className="balsave-avatar" aria-label="Minha conta"><Icon name="profile" /></summary>
            <div className="balsave-profile-links">
              {!signedIn && <Link href="/acesso">Entrar</Link>}
              {signedIn && <SignOutForm />}
            </div>
          </details>}
        </div>
      </div>
    </header>
    {showNavigation && <nav className="balsave-mobile-nav" aria-label="Navegação principal">{links(true)}</nav>}
  </>;
}
