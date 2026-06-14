import { Component } from "react";
import { Brand } from "./Brand.jsx";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="error-screen">
        <Brand />
        <h1>Website could not load</h1>
        <p>{this.state.error.message}</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
        >
          Reset and Reload
        </button>
      </main>
    );
  }
}
