# PulseMatch (Dating App)

A simple Firebase-powered dating website with:

- Google login
- Profile creation (name, bio, age, photo)
- Discover other users
- Like users
- Match when likes are mutual

## 1) Firebase setup

1. Create a project in Firebase Console.
2. In **Authentication**, enable **Google** provider.
3. In **Firestore Database**, create a database (start in production or test mode).
4. In **Storage**, create a bucket.
5. Add a **Web App** in project settings and copy the config values.

## 2) App config file

In this folder, copy `firebase-config.example.js` to `firebase-config.js` and fill the values:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3) Security rules

Deploy rules using Firebase CLI:

```bash
firebase init firestore
firebase init storage
firebase deploy --only firestore:rules,storage
```

Use:
- `firestore.rules`
- `storage.rules`

## 4) Run locally

Because this app uses ES modules, serve with a local web server:

```bash
python -m http.server 5500
```

Open:

`http://localhost:5500/dating-app/`

## 5) Optional deploy

You can deploy to Firebase Hosting:

```bash
firebase init hosting
firebase deploy --only hosting
```

