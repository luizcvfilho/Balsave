import AppBar from "@mui/material/AppBar";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Image from "next/image";
import Link from "next/link";
import logoDark from "../../../../assets/balsave-logo-dark.svg";
import logoLight from "../../../../assets/balsave-logo-light.svg";
import { signOut } from "../preview/actions";

export function Header({ signedIn }: { signedIn: boolean }) {
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
          <div className="report-filters">
            <Link href="/categorias" className="report-link report-action">Categorias</Link>
            <Link href="/conexoes" className="report-link report-action">Conectar bancos</Link>
            {signedIn && (
              <form action={signOut}>
                <button className="report-button" type="submit">Sair</button>
              </form>
            )}
          </div>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
