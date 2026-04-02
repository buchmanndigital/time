/**
 * Schreibt dieselben Zeilen wie generate-vapid-keys, aber aus /tmp/time-push-env.json
 * (nach einmaligem Generieren), für .env.local / Backup — nicht committen.
 */
import { readFileSync } from "node:fs";
const path = process.argv[2] || "/tmp/time-push-env.json";
const j = JSON.parse(readFileSync(path, "utf8"));
console.log(`VAPID_SUBJECT=${j.subject}`);
console.log(`VAPID_PUBLIC_KEY=${j.pub}`);
console.log(`VAPID_PRIVATE_KEY=${j.priv}`);
console.log(`CRON_SECRET=${j.cron}`);
