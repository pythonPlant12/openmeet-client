import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBkO8oTwQ2DAG9118HwN4vZClTaPL2U0aY',
  authDomain: 'test-700e0.firebaseapp.com',
  databaseURL: 'https://test-700e0-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'test-700e0',
  storageBucket: 'test-700e0.firebasestorage.app',
  messagingSenderId: '372863036241',
  appId: '1:372863036241:web:e6e62be0361e0b58b68170',
  measurementId: 'G-9EPYZQWXLE',
};

class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
  }

  getFirestore(): Firestore {
    return this.db;
  }

  async createCallDocument(callId: string, offer: RTCSessionDescriptionInit) {
    const callDocRef = doc(this.db, 'calls', callId);
    await setDoc(callDocRef, { offer });
  }

  async getCallDocument(callId: string) {
    const callDocRef = doc(this.db, 'calls', callId);
    const callSnapshot = await getDoc(callDocRef);
    return callSnapshot.data();
  }

  async updateCallDocument(callId: string, answer: RTCSessionDescriptionInit) {
    const callDocRef = doc(this.db, 'calls', callId);
    await updateDoc(callDocRef, { answer });
  }

  async addICECandidate(callId: string, candidateType: 'offer' | 'answer', candidate: RTCIceCandidateInit) {
    const candidatesCollection = collection(this.db, 'calls', callId, `${candidateType}Candidates`);
    await addDoc(candidatesCollection, candidate);
  }

  subscribeToCall(callId: string, callback: (data: any) => void): Unsubscribe {
    const callDocRef = doc(this.db, 'calls', callId);
    return onSnapshot(callDocRef, (snapshot) => {
      callback(snapshot.data());
    });
  }

  subscribeToICECandidates(
    callId: string,
    candidateType: 'offer' | 'answer',
    callback: (candidate: RTCIceCandidateInit) => void,
  ): Unsubscribe {
    const candidatesCollection = collection(this.db, 'calls', callId, `${candidateType}Candidates`);
    return onSnapshot(candidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data() as RTCIceCandidateInit);
        }
      });
    });
  }
}

export const firebaseService = new FirebaseService();
