// Placeholder file for Firebase Configuration.
// The user will need to replace these with their actual Firebase Project keys.

const firebaseConfig = {
    apiKey: "AIzaSyDXuFzzISKb9S5t0ETZZDcQ4XBNDwmh5nk",
    authDomain: "modsir-poulty-app.firebaseapp.com",
    projectId: "modsir-poulty-app",
    storageBucket: "modsir-poulty-app.firebasestorage.app",
    messagingSenderId: "605330242979",
    appId: "1:605330242979:web:750592c5ff3af1a383ee16",
    measurementId: "G-EDLJEFWF63"
};

// Initialize Firebase using the Compat libraries for drop-in Vanilla JS usage
firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.firestore();

// Optional: Enable offline persistence for Firestore so it works seamlessly offline
db.enablePersistence().catch(function (err) {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, offline persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        console.warn("Offline persistence not supported by this browser.");
    }
});
