import { io } from 'socket.io-client'

// Connexion unique au serveur temps réel partagée par toutes les pages
export const socket = io(import.meta.env.VITE_API_URL)
