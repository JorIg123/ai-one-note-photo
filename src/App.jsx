// src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";
import { auth, googleProvider, githubProvider, db } from "./firebaseConfig";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  // orderBy, // si quieres luego ordenar por createdAt
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado para notas
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // Estado para saber si estamos editando una nota (Update)
  const [editingNoteId, setEditingNoteId] = useState(null);

  const isEditing = Boolean(editingNoteId);

  // Escuchar cambios de autenticación (login / logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    // Limpieza del listener
    return () => unsubscribe();
  }, []);

  // Escuchar en tiempo real las notes du user connecté
  useEffect(() => {
    // Si no hay usuario, vaciamos la lista y no nos suscribimos a Firestore
    if (!user) {
      setNotes([]);
      return;
    }

    setNotesLoading(true);
    setNotesError("");

    const q = query(
      collection(db, "notes"),
      where("userId", "==", user.uid)
      // orderBy("createdAt", "desc") // puedes reactivarlo si creas el index
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotes(docs);
        setNotesLoading(false);
      },
      (err) => {
        console.error("Erreur de lecture des notes:", err);
        setNotesError("Erreur lors du chargement de vos notes.");
        setNotesLoading(false);
      }
    );

    // Cleanup du listener de Firestore
    return () => unsubscribe();
  }, [user]);

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
      // Al desconectarse, salimos del modo edición si estaba activo
      setEditingNoteId(null);
      setNoteTitle("");
      setNoteContent("");
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
      setError("Erreur lors de la déconnexion.");
    }
  };

  // Reset del formulario y modo edición
  const resetNoteForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setEditingNoteId(null);
  };

  // Submit del formulario: Create o Update según el estado
  const handleSubmitNote = async (event) => {
    event.preventDefault();
    setNotesError("");

    if (!user) {
      setNotesError("Vous devez être connecté pour gérer vos notes.");
      return;
    }

    const trimmedTitle = noteTitle.trim();
    const trimmedContent = noteContent.trim();

    if (!trimmedTitle && !trimmedContent) {
      setNotesError("Veuillez saisir au moins un titre ou un contenu.");
      return;
    }

    try {
      if (!isEditing) {
        // CREATE
        await addDoc(collection(db, "notes"), {
          userId: user.uid,
          title: trimmedTitle,
          content: trimmedContent,
          imageUrl: "", // se rellenará plus tard avec Storage
          aiSummary: "", // se rellenará plus tard avec OpenAI
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // UPDATE
        const noteRef = doc(db, "notes", editingNoteId);
        await updateDoc(noteRef, {
          title: trimmedTitle,
          content: trimmedContent,
          updatedAt: serverTimestamp(),
        });
      }

      // Reset del formulario y modo edición
      resetNoteForm();
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la note:", err);
      setNotesError("Erreur lors de l'enregistrement de la note.");
    }
  };

  // Entrar en modo edición para una nota existente
  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
  };

  // Cancelar la edición
  const handleCancelEdit = () => {
    resetNoteForm();
  };

  // DELETE
  const handleDeleteNote = async (noteId) => {
    setNotesError("");
    if (!user) {
      setNotesError("Vous devez être connecté pour supprimer une note.");
      return;
    }

    const confirmDelete = window.confirm(
      "Voulez-vous vraiment supprimer cette note ?"
    );
    if (!confirmDelete) return;

    try {
      const noteRef = doc(db, "notes", noteId);
      await deleteDoc(noteRef);

      // Si estábamos editando esta nota, salimos del modo edición
      if (editingNoteId === noteId) {
        resetNoteForm();
      }
    } catch (err) {
      console.error("Erreur lors de la suppression de la note:", err);
      setNotesError("Erreur lors de la suppression de la note.");
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

          <hr className="section-divider" />

          <h2>Notes Firestore </h2>

          {!user ? (
            <p className="info-message">
              Connectez-vous pour créer, modifier et supprimer vos notes.
            </p>
          ) : (
            <>
              <form className="note-form" onSubmit={handleSubmitNote}>
                <input
                  type="text"
                  placeholder="Titre de la note"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="note-input"
                />
                <textarea
                  placeholder="Contenu de la note"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="note-textarea"
                  rows={3}
                />
                <div className="note-form-actions">
                  <button type="submit" className="btn btn-note-submit">
                    {isEditing ? "Mettre à jour la note" : "Enregistrer la note"}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn btn-note-cancel"
                      onClick={handleCancelEdit}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>

              {notesLoading ? (
                <p>Chargement de vos notes...</p>
              ) : notes.length === 0 ? (
                <p>Aucune note pour l&apos;instant.</p>
              ) : (
                <ul className="notes-list">
                  {notes.map((note) => (
                    <li key={note.id} className="note-item">
                      <h3 className="note-title">
                        {note.title || "(Sans titre)"}
                      </h3>
                      {note.content && (
                        <p className="note-content">{note.content}</p>
                      )}
                      <p className="note-meta">
                        Créée le{" "}
                        {note.createdAt && note.createdAt.toDate
                          ? note.createdAt.toDate().toLocaleString()
                          : "—"}
                      </p>
                      <div className="note-actions">
                        <button
                          type="button"
                          className="btn btn-note-edit"
                          onClick={() => handleEditNote(note)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-note-delete"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {notesError && (
                <p className="error-message error-notes">{notesError}</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

