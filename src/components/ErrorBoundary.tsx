import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_BASE } from '../lib/url';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Évite une page blanche si un composant plante : affiche l'erreur et un bouton de retour. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TubeCraft — erreur de rendu', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page" style={{ padding: '96px 24px' }}>
        <h1 className="page__title">Oups, un composant a planté</h1>
        <p className="empty">
          {error.message}
          <br />
          <br />
          <a href={`${APP_BASE === '/' ? '' : APP_BASE}/`} onClick={() => this.setState({ error: null })}>
            Recharger l’accueil
          </a>
        </p>
      </div>
    );
  }
}
