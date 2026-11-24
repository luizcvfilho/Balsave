import AppBar from "@mui/material/AppBar";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Image from "next/image";
import Link from "next/link";
import logoDark from "../../../../assets/balsave-logo-dark.svg";
import logoLight from "../../../../assets/balsave-logo-light.svg";
import { HomeSignInLink } from "./home-sign-in-link";
import { SignOutForm } from "./sign-out-form";

export function Header({ signedIn, showNavigation, showHomeSignIn }: {
  signedIn: boolean;
  showNavigation: boolean;
  showHomeSignIn: boolean;
}) {
  return (
    <AppBar
      color="transparent"
      elevation={0}
      position="static"
      sx={{ bgcolor: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: "space-between", gap: 1 }}>
          <Link href="/" aria-label="Balsave, início">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet={logoDark.src} />
              <Image src={logoLight} alt="Balsave" width={150} height={50} />
            </picture>
          </Link>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} useFlexGap sx={{ alignItems: "center", minWidth: 0 }}>
            {showNavigation && (
              <nav aria-label="Navegação principal" className="report-filters">
                <Link href="/categorias" className="report-link report-action">Categorias</Link>
                <Link href="/conexoes" className="report-link report-action">Conectar bancos</Link>
                {signedIn && <SignOutForm />}
              </nav>
            )}
            {showHomeSignIn && <HomeSignInLink />}
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
