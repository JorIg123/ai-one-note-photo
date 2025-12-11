
import { useEffect, useState } from "react";
import "./App.css";
import { auth, googleProvider, githubProvider,} from "./firebaseConfig";
import { signInWithPopup, signOut, onAuthStateChanged,} from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });


    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Erreur de connexion Google:", err);
      setError("Erreur lors de la connexion avec Google.");
    }
  };

  const handleGithubLogin = async () => {
    setError("");
    try {
      await signInWithPopup(auth, githubProvider);
    } catch (err) {
      console.error("Erreur de connexion GitHub:", err);
      setError("Erreur lors de la connexion avec GitHub.");
    }
  };

  const handleLogout = async () => {
    setError("");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
      setError("Erreur lors de la déconnexion.");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI One-Note + Photo</h1>

      </header>

      <main className="app-main">
        <section className="app-section">
          <h2>Authentification Google &amp; GitHub</h2>

          {authLoading ? (
            <p>Chargement de l&apos;état de connexion...</p>
          ) : user ? (
            <div className="user-card">
              <div className="user-info">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || user.email || "Avatar"}
                    className="user-avatar"
                  />
                )}
                <div>
                  <p className="user-name">
                    {user.displayName || "Utilisateur sans nom"}
                  </p>
                  <p className="user-email">{user.email}</p>
                  <p className="user-provider">
                    Connexion via :{" "}
                    {user.providerData[0]?.providerId === "google.com"
                      ? "Google"
                      : user.providerData[0]?.providerId === "github.com"
                      ? "GitHub"
                      : user.providerData[0]?.providerId}
                  </p>
                </div>
              </div>

              <button className="btn btn-logout" onClick={handleLogout}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <div className="login-buttons">
              <p>Vous n&apos;êtes pas connecté.</p>
              <div className="login-buttons-row">
                <button className="btn btn-google" onClick={handleGoogleLogin}>
                  Se connecter avec Google
                </button>
                <button className="btn btn-github" onClick={handleGithubLogin}>
                  Se connecter avec GitHub
                </button>
              </div>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}
        </section>


      </main>
    </div>
  );
}

export default App;
