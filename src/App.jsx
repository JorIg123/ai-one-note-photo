// src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";
import { auth, googleProvider, githubProvider, db, storage } from "./firebaseConfig";
import { signInWithPopup, signOut,  onAuthStateChanged,} from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc,} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

 
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

 
  const [editingNoteId, setEditingNoteId] = useState(null);

 
  const [noteImageFile, setNoteImageFile] = useState(null);

  const isEditing = Boolean(editingNoteId);

 
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

   
    return () => unsubscribe();
  }, []);

 
  useEffect(() => {
   
    if (!user) {
      setNotes([]);
      return;
    }

    setNotesLoading(true);
    setNotesError("");

    const q = query(
      collection(db, "notes"),
      where("userId", "==", user.uid)
     
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

      resetNoteForm();
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
      setError("Erreur lors de la déconnexion.");
    }
  };

 
  const resetNoteForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setNoteImageFile(null);
    setEditingNoteId(null);
  };

 
  const handleNoteImageChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setNoteImageFile(file);
    } else {
      setNoteImageFile(null);
    }
  };

 
  const handleSubmitNote = async (event) => {
    event.preventDefault();
    setNotesError("");

    if (!user) {
      setNotesError("Vous devez être connecté pour gérer vos notes.");
      return;
    }

    const trimmedTitle = noteTitle.trim();
    const trimmedContent = noteContent.trim();

   
    if (!trimmedTitle && !trimmedContent && !noteImageFile) {
      setNotesError(
        "Veuillez saisir au moins un titre, un contenu ou choisir une image."
      );
      return;
    }

    try {
      let noteRef;

      if (!isEditing) {
        
        noteRef = await addDoc(collection(db, "notes"), {
          userId: user.uid,
          title: trimmedTitle,
          content: trimmedContent,
          imageUrl: "", 
          aiSummary: "", 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        
        noteRef = doc(db, "notes", editingNoteId);
        await updateDoc(noteRef, {
          title: trimmedTitle,
          content: trimmedContent,
          updatedAt: serverTimestamp(),
        });
      }

      
      if (noteImageFile) {
        const storagePath = `notes/${user.uid}/${noteRef.id}/${noteImageFile.name}`;
        const fileRef = ref(storage, storagePath);

        await uploadBytes(fileRef, noteImageFile);
        const downloadUrl = await getDownloadURL(fileRef);

        await updateDoc(noteRef, {
          imageUrl: downloadUrl,
          updatedAt: serverTimestamp(),
        });
      }

     
      resetNoteForm();
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la note:", err);
      setNotesError("Erreur lors de l'enregistrement de la note.");
    }
  };

  
  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
  
    setNoteImageFile(null);
  };

  
  const handleCancelEdit = () => {
    resetNoteForm();
  };


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

          <h2>Notes Firestore (CRUD + Upload Storage)</h2>

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
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNoteImageChange}
                  className="note-file-input"
                />
                <div className="note-form-actions">
                  <button type="submit" className="btn btn-note-submit">
                    {isEditing
                      ? "Mettre à jour la note"
                      : "Enregistrer la note"}
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
                      {note.imageUrl && (
                        <img
                          src={note.imageUrl}
                          alt={note.title || "Image de la note"}
                          className="note-image"
                        />
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

