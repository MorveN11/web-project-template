// SessionStorage key used to signal that the user just completed a
// sign-in or sign-up, so `AuthStateSync` can bust the Router Cache on
// the next page load even though Clerk's redirect re-mounts the auth
// state with `prev = null`.
//
// Lives in its own module so the writer (`SignCompletionMarker`) and
// the reader (`AuthStateSync`) share the same constant without
// importing each other.
export const JUST_SIGNED_IN_KEY = 'clerk:just-signed-in';
