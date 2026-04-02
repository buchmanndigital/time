/**
 * Schreibt VAPID-Schlüssel für Web-Push auf stdout (.env.local ergänzen).
 * Aufruf: node scripts/generate-vapid-keys.mjs
 */
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nIn .env.local (und auf dem Host, z. B. Vercel) eintragen:\n");
console.log(`VAPID_SUBJECT=mailto:deine@email.de`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`CRON_SECRET=${randomBytes(32).toString("hex")}`);
console.log("\nmailto: durch deine echte Adresse oder https://deine-domain.tld ersetzen.\n");
