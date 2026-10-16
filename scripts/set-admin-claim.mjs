/**
 * One-time provisioning utility. Run on a trusted administrator workstation
 * with Google Application Default Credentials for the correct Firebase project.
 * Never ship service account keys in this repository.
 *
 * Usage: node scripts/set-admin-claim.mjs jkillingsworth@electro-mech.com
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'digitgit-93d87';
const email = (process.argv[2] || '').trim().toLowerCase();
const expected = 'jkillingsworth@electro-mech.com';
if (email !== expected) {
  console.error('This bootstrap script grants access only to the designated initial admin.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
if (!user.emailVerified) {
  throw new Error('The Firebase email must be verified before assigning administrator access.');
}
const existing = user.customClaims || {};
await auth.setCustomUserClaims(user.uid, { ...existing, admin: true });
console.log('Administrator claim assigned to the designated verified user.');
console.log('Sign out and sign back in (or refresh the Firebase ID token) before using admin features.');
