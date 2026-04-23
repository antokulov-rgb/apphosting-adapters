// Вставьте сюда ВАШУ конфигурацию из Firebase Console
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiWbcBjw8ywCfHib-43J0DjAHsII1RSV4",
  authDomain: "lift-control-system.firebaseapp.com",
  projectId: "lift-control-system",
  storageBucket: "lift-control-system.firebasestorage.app",
  messagingSenderId: "373060733371",
  appId: "1:373060733371:web:8516e495cf5e88bc4e5c9e"
};


// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Функция для получения текущего пользователя
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject('Не авторизован');
            }
        });
    });
}

// Определяем роль пользователя (храним в Realtime Database)
async function getUserRole(uid) {
    const snapshot = await db.ref(`users/${uid}/role`).once('value');
    return snapshot.val();
}