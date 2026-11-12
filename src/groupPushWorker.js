import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';
import { firebaseConfig } from './firebaseConfig.js';

getMessaging(initializeApp(firebaseConfig));
