import { useState, useCallback } from "react";

import { Landing } from "./Landing";
import { Demo } from "./Demo";

type Page = "home" | "demo";

// App renders the top-level site shell with navigation.
export function App() {
  const [page, setPage] = useState<Page>("home");

  const navigate = useCallback((p: Page) => {
    setPage(p);
  }, []);

  return (
    <>
      <header className="site-header">
        <h1>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
          >
            FlexLayout
          </a>
        </h1>
        <nav className="site-nav">
          <a
            href="#demo"
            className={page === "demo" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigate("demo");
            }}
          >
            Demo
          </a>
          <a href="/typedoc/">Docs</a>
          <a
            href="https://github.com/aperturerobotics/flex-layout"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>
      {page === "home" && <Landing onNavigate={navigate} />}
      {page === "demo" && <Demo />}
    </>
  );
}
