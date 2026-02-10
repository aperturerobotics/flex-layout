// Landing renders the homepage with hero section and feature highlights.
export function Landing({ onNavigate }: { onNavigate: (page: "demo") => void }) {
  return (
    <div className="landing">
      <section className="hero">
        <h2>Multi-tab Docking Layout for React</h2>
        <p>
          A flexible layout manager with draggable, resizable tabs, split panes,
          borders, and multiple themes. Build complex IDE-like interfaces with
          ease.
        </p>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            onClick={() => onNavigate("demo")}
          >
            Try the Demo
          </button>
          <a
            className="btn btn-secondary"
            href="https://github.com/aperturerobotics/flex-layout"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
        <div className="install-snippet">npm install @aptre/flex-layout</div>
      </section>
      <section className="features">
        <div className="feature">
          <h3>Drag and Drop</h3>
          <p>
            Move tabs between tab sets, dock to edges, and reorder with smooth
            drag-and-drop interactions that work on desktop and mobile.
          </p>
        </div>
        <div className="feature">
          <h3>Resizable Splits</h3>
          <p>
            Split panes horizontally and vertically with draggable splitters.
            Weighted sizing ensures proportional layouts.
          </p>
        </div>
        <div className="feature">
          <h3>Border Panels</h3>
          <p>
            Dock tabs to any edge of the layout as collapsible border panels,
            similar to IDE tool windows.
          </p>
        </div>
        <div className="feature">
          <h3>OptimizedLayout</h3>
          <p>
            Renders tab content outside the layout DOM for zero re-renders on
            layout changes. State is fully preserved.
          </p>
        </div>
        <div className="feature">
          <h3>Multiple Themes</h3>
          <p>
            Ships with light, dark, gray, underline, and rounded themes. Easily
            customizable via SCSS variables.
          </p>
        </div>
        <div className="feature">
          <h3>TypeScript First</h3>
          <p>
            Written in TypeScript with full type declarations. Works with React
            18 and 19.
          </p>
        </div>
      </section>
      <footer className="site-footer">
        This project is a fork of{" "}
        <a
          href="https://github.com/caplin/FlexLayout"
          target="_blank"
          rel="noopener noreferrer"
        >
          FlexLayout
        </a>{" "}
        by Caplin Systems. Thanks to them for the original implementation.
      </footer>
    </div>
  );
}
