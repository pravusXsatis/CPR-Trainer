import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

const elements = {
  googleLoginBtn: document.getElementById("googleLoginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  userArea: document.getElementById("userArea"),
  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  profileForm: document.getElementById("profileForm"),
  displayName: document.getElementById("displayName"),
  bio: document.getElementById("bio"),
  age: document.getElementById("age"),
  photoFile: document.getElementById("photoFile"),
  profileStatus: document.getElementById("profileStatus"),
  discoverList: document.getElementById("discoverList"),
  matchesList: document.getElementById("matchesList")
};

let currentUser = null;
let currentProfile = null;

elements.googleLoginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    setStatus(`Login failed: ${error.message}`, true);
  }
});

elements.logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus("Please sign in first.", true);
    return;
  }

  try {
    const photoUrl = await maybeUploadPhoto(currentUser.uid);
    const payload = {
      uid: currentUser.uid,
      displayName: elements.displayName.value.trim(),
      bio: elements.bio.value.trim(),
      age: Number(elements.age.value),
      photoUrl: photoUrl || currentProfile?.photoUrl || "",
      email: currentUser.email || "",
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "profiles", currentUser.uid), payload, { merge: true });
    setStatus("Profile saved.");
    await refreshData();
  } catch (error) {
    setStatus(`Could not save profile: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    elements.userArea.classList.add("hidden");
    elements.googleLoginBtn.classList.remove("hidden");
    clearLists();
    return;
  }

  elements.googleLoginBtn.classList.add("hidden");
  elements.userArea.classList.remove("hidden");
  elements.userAvatar.src = user.photoURL || "";
  elements.userName.textContent = user.displayName || user.email || "User";

  await loadOwnProfile();
  await refreshData();
});

async function maybeUploadPhoto(uid) {
  const file = elements.photoFile.files[0];
  if (!file) return null;
  const photoRef = ref(storage, `profilePhotos/${uid}/${Date.now()}-${file.name}`);
  await uploadBytes(photoRef, file);
  return getDownloadURL(photoRef);
}

async function loadOwnProfile() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, "profiles", currentUser.uid));
  currentProfile = snap.exists() ? snap.data() : null;
  if (!currentProfile) return;

  elements.displayName.value = currentProfile.displayName || "";
  elements.bio.value = currentProfile.bio || "";
  elements.age.value = currentProfile.age || "";
}

async function refreshData() {
  await renderDiscover();
  await renderMatches();
}

async function renderDiscover() {
  if (!currentUser) return;
  elements.discoverList.innerHTML = "";

  const allProfiles = await getDocs(collection(db, "profiles"));
  const outgoingLikes = await getDocs(
    query(collection(db, "likes"), where("fromUid", "==", currentUser.uid))
  );
  const likedSet = new Set(outgoingLikes.docs.map((d) => d.data().toUid));

  for (const docSnap of allProfiles.docs) {
    const profile = docSnap.data();
    if (profile.uid === currentUser.uid) continue;

    const card = document.createElement("article");
    card.className = "person";
    card.innerHTML = `
      ${profile.photoUrl ? `<img src="${profile.photoUrl}" alt="${profile.displayName}">` : ""}
      <strong>${escapeHtml(profile.displayName || "Unknown")}, ${profile.age || "?"}</strong>
      <span>${escapeHtml(profile.bio || "")}</span>
    `;

    const likeBtn = document.createElement("button");
    likeBtn.textContent = likedSet.has(profile.uid) ? "Liked" : "Like";
    likeBtn.disabled = likedSet.has(profile.uid);
    likeBtn.addEventListener("click", async () => {
      await likeUser(profile.uid);
      likeBtn.textContent = "Liked";
      likeBtn.disabled = true;
    });
    card.appendChild(likeBtn);
    elements.discoverList.appendChild(card);
  }
}

async function likeUser(targetUid) {
  const likeId = `${currentUser.uid}_${targetUid}`;
  await setDoc(doc(db, "likes", likeId), {
    fromUid: currentUser.uid,
    toUid: targetUid,
    createdAt: serverTimestamp()
  });

  const reverseLike = await getDoc(doc(db, "likes", `${targetUid}_${currentUser.uid}`));
  if (reverseLike.exists()) {
    const pair = [currentUser.uid, targetUid].sort().join("_");
    await setDoc(doc(db, "matches", pair), {
      users: [currentUser.uid, targetUid],
      createdAt: serverTimestamp()
    });
    setStatus("It is a match!");
  }
}

async function renderMatches() {
  if (!currentUser) return;
  elements.matchesList.innerHTML = "";
  const matchSnaps = await getDocs(
    query(collection(db, "matches"), where("users", "array-contains", currentUser.uid))
  );

  for (const matchDoc of matchSnaps.docs) {
    const users = matchDoc.data().users || [];
    const otherUid = users.find((id) => id !== currentUser.uid);
    if (!otherUid) continue;

    const otherProfileSnap = await getDoc(doc(db, "profiles", otherUid));
    if (!otherProfileSnap.exists()) continue;
    const p = otherProfileSnap.data();

    const card = document.createElement("article");
    card.className = "person";
    card.innerHTML = `
      ${p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.displayName}">` : ""}
      <strong>${escapeHtml(p.displayName || "Unknown")}</strong>
      <span>${escapeHtml(p.bio || "")}</span>
    `;
    elements.matchesList.appendChild(card);
  }
}

function clearLists() {
  elements.discoverList.innerHTML = "";
  elements.matchesList.innerHTML = "";
  elements.profileStatus.textContent = "";
}

function setStatus(message, isError = false) {
  elements.profileStatus.textContent = message;
  elements.profileStatus.style.color = isError ? "#ff8585" : "#80f5b0";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
