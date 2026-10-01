const API_URL = import.meta.env.VITE_API_URL

// Messages anglais que NestJS renvoie quand personne n'a écrit de phrase à la
// place : ils ne disent rien à l'officier, on les remplace par une explication
const GENERIC_MESSAGES = [
  'Unauthorized',
  'Forbidden',
  'Forbidden resource',
  'Bad Request',
  'Not Found',
  'Conflict',
  'Internal server error',
  'Service Unavailable',
]

// Dit ce qui s'est passé et quoi faire, d'après le code HTTP de la réponse
function messageForStatus(status: number) {
  if (status === 401) {
    return 'Ta session a expiré ou tu n’es pas connecté. Clique sur « Déconnexion », puis reconnecte-toi.'
  }
  if (status === 403) {
    return 'Tu n’as pas le droit de faire cette action avec ton rôle actuel. Demande à un collègue qui a ce droit de s’en charger.'
  }
  if (status === 404) {
    return 'Cet élément n’existe plus, il a peut-être été supprimé. Recharge la page pour voir la liste à jour.'
  }
  if (status >= 500) {
    return 'Le serveur a rencontré un problème. Réessaie dans quelques instants, et si l’erreur revient préviens un administrateur.'
  }
  return 'Cette demande n’a pas pu être traitée. Vérifie les informations saisies et réessaie.'
}

export const NETWORK_ERROR =
  'Impossible de joindre le serveur. Vérifie ta connexion internet, puis réessaie dans quelques instants.'

// Lit la réponse de l'API et lève une erreur qui est une vraie phrase
export async function readResponse<T = any>(response: Response): Promise<T> {
  let data: any = null
  try {
    data = await response.json()
  } catch {
    // Réponse vide ou qui n'est pas du JSON : on se rabat sur le code HTTP
  }

  if (response.ok) {
    return data as T
  }

  const message = Array.isArray(data?.message)
    ? data.message.join(' ')
    : data?.message
  if (typeof message === 'string' && !GENERIC_MESSAGES.includes(message)) {
    throw new Error(message)
  }
  throw new Error(messageForStatus(response.status))
}

// Appelle l'API (avec le token de l'officier s'il est connecté) et lève une
// erreur lisible si le serveur est injoignable ou refuse la demande
export async function request<T = any>(
  path: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const token = localStorage.getItem('token')
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(NETWORK_ERROR)
  }
  return readResponse<T>(response)
}
